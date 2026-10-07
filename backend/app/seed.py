"""Idempotent sample data: python -m app.seed [--company-id UUID]."""

import argparse
from datetime import date, datetime, timezone
from decimal import Decimal
import uuid
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    AudienceSnapshot, Campaign, CampaignCreator, CampaignMilestone, CampaignResult,
    Company, ContentIdea, ContentItem, CreatorProfile, MetricSnapshot, SocialAccount, User, UserRole,
)

SAMPLE_DATE = date(2026, 9, 30)
DEMO_EMAIL = "demo@talentlens.invalid"
CREATORS = [
    (1, "Aanya Mehta", "aanya.creates", "Lifestyle", "instagram", "Mumbai", 128400, "6.8", "12.4", 35000, 42600, 78, "photo-1534528741775-53994a69daeb", "photo-1490481651871-ab68de25d43d"),
    (2, "Kabir Shah", "kabir.tech", "Technology", "youtube", "Bengaluru", 246000, "5.2", "8.1", 65000, 98400, 71, "photo-1500648767791-00dcc994a43e", "photo-1496181133206-80ce9b88a853"),
    (3, "Riya Kapoor", "riya.moves", "Fitness", "instagram", "Delhi", 86400, "8.4", "16.2", 28000, 38800, 84, "photo-1524504388940-b1c1722653e1", "photo-1517836357463-d25dfeac3438"),
    (4, "Arjun Rao", "arjun.explores", "Travel", "youtube", "Hyderabad", 192800, "4.9", "6.7", 52000, 73200, 69, "photo-1506794778202-cad84cf45f1d", "photo-1469474968028-56623f02e42e"),
    (5, "Sana Ali", "sana.skinnotes", "Beauty", "instagram", "Mumbai", 164200, "7.1", "10.8", 42000, 56800, 81, "photo-1524250502761-1ac6f2e30d43", "photo-1596462502278-27bfdc403348"),
    (6, "Dev Malhotra", "dev.table", "Food", "youtube", "Pune", 112600, "6.4", "9.3", 32000, 48100, 88, "photo-1519085360753-af0119f7cbe7", "photo-1547592180-85f173990554"),
]
MILESTONES = ["Brief approved", "Creators confirmed", "Content approved", "Published", "Results reviewed"]


def seed(database: Session, company_id: uuid.UUID | None = None) -> dict[str, int]:
    if company_id and not database.get(Company, company_id):
        raise ValueError("Company does not exist. Create a company before seeding its campaigns.")
    inserted = 0
    profiles = {}
    for number, name, handle, category, platform, city, followers, engagement, growth, fee, reach, india, photo, cover in CREATORS:
        profile = database.scalar(select(CreatorProfile).where(CreatorProfile.sample_key == f"demo-{number}"))
        if not profile:
            if database.scalar(select(SocialAccount).where(SocialAccount.platform == platform, SocialAccount.handle == handle)):
                raise ValueError(f"Cannot seed {handle}: an existing account uses this handle.")
            profile = CreatorProfile(sample_key=f"demo-{number}", display_name=name, category=category,
                                     city=city, country_code="IN", bio=f"Illustrative {category.lower()} creator profile.",
                                     photo_url=f"https://images.unsplash.com/{photo}",
                                     cover_url=f"https://images.unsplash.com/{cover}", indicative_fee=Decimal(fee), is_sample=True)
            database.add(profile)
            database.flush()
            account = SocialAccount(creator_id=profile.id, platform=platform, handle=handle)
            database.add(account)
            database.flush()
            database.add(MetricSnapshot(account_id=account.id, observed_on=SAMPLE_DATE, followers=followers,
                                        engagement_rate=Decimal(engagement), growth_rate=Decimal(growth),
                                        average_reach=reach, source="sample", is_sample=True))
            us = round((100 - india) / 2)
            database.add(AudienceSnapshot(account_id=account.id, observed_on=SAMPLE_DATE,
                                          locations=[{"country": "IN", "percent": india}, {"country": "US", "percent": us}, {"country": "other", "percent": 100 - india - us}],
                                          age_groups=[{"range": "18-24", "percent": 46}, {"range": "25-34", "percent": 34}, {"range": "other", "percent": 20}], is_sample=True))
            database.add(ContentItem(account_id=account.id, platform_content_id=f"sample-concept-{number}",
                                     title="An everyday story (sample concept)", content_type="concept",
                                     media_url=profile.cover_url, is_sample=True))
            inserted += 1
        if not profile.is_sample:
            raise ValueError(f"Sample key demo-{number} belongs to a non-sample profile.")
        profiles[number] = profile
        account = database.scalar(select(SocialAccount).where(SocialAccount.creator_id == profile.id,
                                                              SocialAccount.platform == platform))
        if not account:
            raise ValueError(f"Sample profile demo-{number} is missing its social account.")
        for index, title in enumerate([f"My everyday {category.lower()} routine", "Three things I wish I knew earlier", "Behind the process"], start=1):
            key = f"sample-post-{number}-{index}"
            if not database.scalar(select(ContentItem.id).where(ContentItem.account_id == account.id, ContentItem.platform_content_id == key)):
                post_reach = round(reach * [1.22, 0.9, 0.65][index - 1])
                database.add(ContentItem(account_id=account.id, platform_content_id=key, title=title,
                                         content_type="video" if platform == "youtube" else "reel",
                                         media_url=profile.cover_url,
                                         published_at=datetime(2026, 9, 10 + index * 5, tzinfo=timezone.utc),
                                         reach=post_reach, engagements=round(post_reach * float(engagement) / 100), is_sample=True))
        for index, (title, rationale) in enumerate([
            (f"A beginner's guide to {category.lower()}", "Sample editorial idea: answer a practical question for a new viewer."),
            ("What I would do differently next time", "Sample editorial idea: follow your routine content with a reflective behind-the-scenes story."),
        ], start=1):
            key = f"sample-idea-{index}"
            if not database.scalar(select(ContentIdea.id).where(ContentIdea.creator_id == profile.id, ContentIdea.sample_key == key)):
                database.add(ContentIdea(creator_id=profile.id, sample_key=key, title=title, rationale=rationale,
                                         hashtags=[f"#{category.lower()}", "#creatordiaries", "#behindthescenes"], is_sample=True))

    campaign_count = 0
    if company_id:
        samples = [
            ("sample-1", "Everyday, elevated", 150000, "active", [1, 5], "Brand awareness", "Lifestyle", date(2026, 9, 15), date(2026, 10, 20), 2),
            ("sample-2", "Move your way", 100000, "completed", [3], "Engagement", "Fitness", date(2026, 8, 1), date(2026, 8, 31), 5),
            ("sample-3", "Made for the everyday", 200000, "planning", [2, 6], "Product consideration", "Technology", date(2026, 10, 10), date(2026, 11, 10), 1),
        ]
        sample_results = {("sample-1", 1): (48600, 3500, 912, 35000), ("sample-1", 5): (62400, 4820, 1280, 42000), ("sample-2", 3): (116400, 9780, 1640, 28000)}
        for key, name, budget, status, participants, objective, category, start, end, completed in samples:
            if database.scalar(select(Campaign).where(Campaign.company_id == company_id, Campaign.sample_key == key)):
                continue
            campaign = Campaign(company_id=company_id, sample_key=key, name=name, budget=Decimal(budget),
                                status=status, objective=objective, category=category, start_date=start, end_date=end,
                                brief="Illustrative campaign brief. Not a real company campaign.",
                                deliverables="Sample placements; terms not agreed.", is_sample=True)
            database.add(campaign)
            database.flush()
            for index, milestone in enumerate(MILESTONES):
                database.add(CampaignMilestone(campaign_id=campaign.id, name=milestone,
                                               completed_at=datetime(2026, 9, 30, tzinfo=timezone.utc) if index < completed else None))
            for participant in participants:
                profile = profiles[participant]
                assignment = CampaignCreator(campaign_id=campaign.id, creator_id=profile.id, agreed_fee=profile.indicative_fee)
                database.add(assignment)
                database.flush()
                result = sample_results.get((key, participant))
                if result:
                    result_reach, engagements, clicks, spend = result
                    database.add(CampaignResult(assignment_id=assignment.id, observed_on=SAMPLE_DATE,
                                                 reach=result_reach, engagements=engagements, clicks=clicks,
                                                 spend=Decimal(spend), is_sample=True))
            campaign_count += 1
    database.flush()
    return {"creators_added": inserted, "campaigns_added": campaign_count}


def demo_company(database: Session) -> Company:
    owner = database.scalar(select(User).where(User.email == DEMO_EMAIL))
    if owner and (owner.is_active or owner.role != UserRole.BRAND):
        raise ValueError("Reserved demo identity must be inactive and brand-owned.")
    if not owner:
        from app.security.password import hash_password
        owner = User(email=DEMO_EMAIL, full_name="Demo workspace", role=UserRole.BRAND,
                     is_active=False, hashed_password=hash_password(secrets.token_urlsafe(48)))
        database.add(owner)
        database.flush()
    company = database.scalar(select(Company).where(Company.owner_id == owner.id))
    if not company:
        company = Company(owner_id=owner.id, name="Northstar Studio", industry="Lifestyle")
        database.add(company)
        database.flush()
    return company


def main():
    parser = argparse.ArgumentParser(description="Insert explicitly labeled TalentLens sample data.")
    parser.add_argument("--company-id", type=uuid.UUID, help="Optional existing company receiving sample campaigns.")
    parser.add_argument("--demo-workspace", action="store_true", help="Create a public read-only sample workspace.")
    arguments = parser.parse_args()
    with SessionLocal.begin() as database:
        if arguments.demo_workspace and arguments.company_id:
            parser.error("Choose --company-id or --demo-workspace, not both.")
        company_id = demo_company(database).id if arguments.demo_workspace else arguments.company_id
        counts = seed(database, company_id)
    print(counts)


if __name__ == "__main__":
    main()
