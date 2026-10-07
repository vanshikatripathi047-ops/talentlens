"""Authenticated company-owned workspace operations."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AudienceSnapshot, Campaign, CampaignCreator, CampaignMilestone, CampaignResult,
    Company, ContentIdea, ContentItem, CreatorProfile, MetricSnapshot, ShortlistEntry, SocialAccount,
    User, UserRole,
)
from app.routes.auth import current_user
from app.schemas.workspace import CampaignProgress, CampaignWrite, CompanyResponse, CompanyWrite
from app.seed import MILESTONES, seed

router = APIRouter(prefix="/workspace", tags=["Company workspace"])


def brand_user(user: User = Depends(current_user)) -> User:
    if user.role != UserRole.BRAND:
        raise HTTPException(status_code=403, detail="A company account is required.")
    return user


def current_company(user: User = Depends(brand_user), database: Session = Depends(get_db)) -> Company:
    company = database.scalar(select(Company).where(Company.owner_id == user.id))
    if not company:
        raise HTTPException(status_code=404, detail="Set up your company profile first.")
    return company


def owned_campaign(campaign_id: uuid.UUID, company: Company, database: Session) -> Campaign:
    campaign = database.scalar(select(Campaign).where(Campaign.id == campaign_id, Campaign.company_id == company.id))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return campaign


def campaign_response(campaign: Campaign, database: Session) -> dict:
    assignments = database.scalars(select(CampaignCreator).where(CampaignCreator.campaign_id == campaign.id)).all()
    milestones = database.scalars(select(CampaignMilestone).where(CampaignMilestone.campaign_id == campaign.id)).all()
    return {
        "id": campaign.id, "name": campaign.name, "budget": str(campaign.budget), "currency": campaign.currency,
        "status": campaign.status, "objective": campaign.objective, "category": campaign.category,
        "start_date": campaign.start_date, "end_date": campaign.end_date, "brief": campaign.brief,
        "deliverables": campaign.deliverables, "is_sample": campaign.is_sample,
        "creator_ids": [item.creator_id for item in assignments],
        "completed_milestones": [item.name for item in milestones if item.completed_at],
    }


@router.get("/company", response_model=CompanyResponse)
def get_company(company: Company = Depends(current_company)):
    return company


@router.get("/snapshot")
def workspace_snapshot(company: Company = Depends(current_company), database: Session = Depends(get_db)):
    return {"company": {"name": company.name, "industry": company.industry, "contact": company.contact_email or ""},
            "creators": creator_directory(database), "campaigns": list_campaigns(company, database),
            "results": get_results(company, database), "saved": get_shortlist(company, database)}


@router.post("/sample-data")
def add_sample_data(company: Company = Depends(current_company), database: Session = Depends(get_db)):
    database.scalar(select(Company).where(Company.id == company.id).with_for_update())
    counts = seed(database, company.id)
    database.commit()
    return counts


@router.put("/company", response_model=CompanyResponse)
def save_company(values: CompanyWrite, user: User = Depends(brand_user), database: Session = Depends(get_db)):
    # Lock the owner row so simultaneous onboarding requests cannot create duplicates.
    database.scalar(select(User).where(User.id == user.id).with_for_update())
    company = database.scalar(select(Company).where(Company.owner_id == user.id))
    if not company:
        company = Company(owner_id=user.id, **values.model_dump())
        database.add(company)
    else:
        for key, value in values.model_dump().items():
            setattr(company, key, value)
    database.commit()
    database.refresh(company)
    return company


@router.get("/creators")
def list_creators(user: User = Depends(brand_user), database: Session = Depends(get_db)):
    return creator_directory(database)


def creator_directory(database: Session, sample_only: bool = False):
    query = select(CreatorProfile).order_by(CreatorProfile.sample_key, CreatorProfile.display_name)
    if sample_only:
        query = query.where(CreatorProfile.is_sample.is_(True))
    profiles = database.scalars(query).all()
    results = []
    for profile in profiles:
        accounts = database.scalars(select(SocialAccount).where(SocialAccount.creator_id == profile.id)).all()
        channels = []
        for account in accounts:
            metric_query = select(MetricSnapshot).where(MetricSnapshot.account_id == account.id)
            audience_query = select(AudienceSnapshot).where(AudienceSnapshot.account_id == account.id)
            if sample_only:
                metric_query = metric_query.where(MetricSnapshot.is_sample.is_(True))
                audience_query = audience_query.where(AudienceSnapshot.is_sample.is_(True))
            metric = database.scalar(metric_query.order_by(MetricSnapshot.observed_on.desc()).limit(1))
            audience = database.scalar(audience_query.order_by(AudienceSnapshot.observed_on.desc()).limit(1))
            channels.append({"id": account.id, "platform": account.platform, "handle": account.handle,
                             "connection_status": account.connection_status,
                             "metrics": {"observed_on": metric.observed_on, "followers": metric.followers,
                                         "engagement_rate": metric.engagement_rate, "growth_rate": metric.growth_rate,
                                         "average_reach": metric.average_reach, "is_sample": metric.is_sample} if metric else None,
                             "audience": {"observed_on": audience.observed_on, "locations": audience.locations,
                                          "age_groups": audience.age_groups, "is_sample": audience.is_sample} if audience else None})
        content_query = select(ContentItem).join(SocialAccount, SocialAccount.id == ContentItem.account_id).where(SocialAccount.creator_id == profile.id)
        idea_query = select(ContentIdea).where(ContentIdea.creator_id == profile.id)
        if sample_only:
            content_query = content_query.where(ContentItem.is_sample.is_(True))
            idea_query = idea_query.where(ContentIdea.is_sample.is_(True))
        content = database.scalars(content_query.order_by(ContentItem.published_at.desc().nulls_last()).limit(20)).all()
        ideas = database.scalars(idea_query.order_by(ContentIdea.sample_key, ContentIdea.created_at)).all()
        results.append({"id": profile.id, "sample_key": profile.sample_key, "name": profile.display_name,
                        "category": profile.category, "city": profile.city, "country_code": profile.country_code,
                        "bio": profile.bio, "photo_url": profile.photo_url, "cover_url": profile.cover_url,
                        "indicative_fee": str(profile.indicative_fee) if profile.indicative_fee is not None else None, "currency": profile.currency,
                        "is_sample": profile.is_sample, "accounts": channels,
                        "content": [{"id": item.id, "title": item.title, "type": item.content_type,
                                     "media_url": item.media_url, "published_at": item.published_at,
                                     "reach": item.reach, "engagements": item.engagements, "is_sample": item.is_sample} for item in content],
                        "ideas": [{"id": item.id, "title": item.title, "rationale": item.rationale,
                                   "hashtags": item.hashtags, "is_sample": item.is_sample} for item in ideas]})
    return results


@router.get("/shortlist")
def get_shortlist(company: Company = Depends(current_company), database: Session = Depends(get_db)):
    return database.scalars(select(ShortlistEntry.creator_id).where(ShortlistEntry.company_id == company.id)).all()


@router.put("/shortlist/{creator_id}", status_code=204)
def save_shortlist(creator_id: uuid.UUID, company: Company = Depends(current_company), database: Session = Depends(get_db)):
    if not database.get(CreatorProfile, creator_id):
        raise HTTPException(status_code=404, detail="Creator not found.")
    database.execute(insert(ShortlistEntry).values(id=uuid.uuid4(), company_id=company.id, creator_id=creator_id).on_conflict_do_nothing(constraint="uq_shortlist_entries_company_creator"))
    database.commit()
    return Response(status_code=204)


@router.delete("/shortlist/{creator_id}", status_code=204)
def remove_shortlist(creator_id: uuid.UUID, company: Company = Depends(current_company), database: Session = Depends(get_db)):
    database.execute(delete(ShortlistEntry).where(ShortlistEntry.company_id == company.id, ShortlistEntry.creator_id == creator_id))
    database.commit()
    return Response(status_code=204)


@router.get("/campaigns")
def list_campaigns(company: Company = Depends(current_company), database: Session = Depends(get_db)):
    return [campaign_response(item, database) for item in database.scalars(select(Campaign).where(Campaign.company_id == company.id).order_by(Campaign.created_at.desc()))]


@router.post("/campaigns", status_code=201)
def create_campaign(values: CampaignWrite, company: Company = Depends(current_company), database: Session = Depends(get_db)):
    profiles = database.scalars(select(CreatorProfile).where(CreatorProfile.id.in_(values.creator_ids))).all()
    if len(profiles) != len(values.creator_ids):
        raise HTTPException(status_code=422, detail="One or more creators do not exist.")
    if any(profile.currency != company.currency for profile in profiles):
        raise HTTPException(status_code=422, detail="Creator fees must use the company currency.")
    total_fees = sum((profile.indicative_fee or Decimal("0") for profile in profiles), Decimal("0"))
    if total_fees > values.budget:
        raise HTTPException(status_code=422, detail="Indicative placement fees exceed the campaign budget.")
    campaign = Campaign(company_id=company.id, currency=company.currency, **values.model_dump(exclude={"creator_ids"}))
    database.add(campaign)
    database.flush()
    for profile in profiles:
        database.add(CampaignCreator(campaign_id=campaign.id, creator_id=profile.id, deliverables=values.deliverables))
    for milestone in MILESTONES:
        database.add(CampaignMilestone(campaign_id=campaign.id, name=milestone))
    database.commit()
    return campaign_response(campaign, database)


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: uuid.UUID, company: Company = Depends(current_company), database: Session = Depends(get_db)):
    return campaign_response(owned_campaign(campaign_id, company, database), database)


@router.patch("/campaigns/{campaign_id}")
def update_campaign(campaign_id: uuid.UUID, values: CampaignProgress, company: Company = Depends(current_company), database: Session = Depends(get_db)):
    campaign = owned_campaign(campaign_id, company, database)
    if values.status is not None:
        campaign.status = values.status
    if values.completed_milestones is not None:
        for milestone in database.scalars(select(CampaignMilestone).where(CampaignMilestone.campaign_id == campaign.id)):
            milestone.completed_at = (milestone.completed_at or datetime.now(timezone.utc)) if milestone.name in values.completed_milestones else None
    database.commit()
    return campaign_response(campaign, database)


@router.delete("/campaigns/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: uuid.UUID, company: Company = Depends(current_company), database: Session = Depends(get_db)):
    database.delete(owned_campaign(campaign_id, company, database))
    database.commit()
    return Response(status_code=204)


@router.get("/results")
def get_results(company: Company = Depends(current_company), database: Session = Depends(get_db)):
    query = (select(CampaignResult, CampaignCreator, Campaign)
             .join(CampaignCreator, CampaignResult.assignment_id == CampaignCreator.id)
             .join(Campaign, CampaignCreator.campaign_id == Campaign.id)
             .where(Campaign.company_id == company.id)
             .distinct(CampaignResult.assignment_id)
             .order_by(CampaignResult.assignment_id, CampaignResult.observed_on.desc()))
    return [{"campaign_id": campaign.id, "creator_id": assignment.creator_id, "observed_on": result.observed_on,
             "reach": result.reach, "engagements": result.engagements, "clicks": result.clicks,
             "spend": str(result.spend), "currency": campaign.currency, "is_sample": result.is_sample}
            for result, assignment, campaign in database.execute(query)]
