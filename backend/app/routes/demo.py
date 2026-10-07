"""Public sample data only; never exposes a signed-in company's workspace."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Campaign, Company, User
from app.routes.workspace import campaign_response, creator_directory, get_results
from app.seed import DEMO_EMAIL

router = APIRouter(prefix="/demo", tags=["Read-only demo"])


@router.get("/workspace")
def workspace(database: Session = Depends(get_db)):
    company = database.scalar(select(Company).join(User, Company.owner_id == User.id)
                              .where(User.email == DEMO_EMAIL, User.is_active.is_(False)))
    if not company:
        raise HTTPException(status_code=503, detail="Sample workspace has not been seeded.")
    campaigns = database.scalars(select(Campaign).where(Campaign.company_id == company.id,
                                                       Campaign.is_sample.is_(True)).order_by(Campaign.sample_key)).all()
    ids = {campaign.id for campaign in campaigns}
    return {"company": {"name": company.name, "industry": company.industry, "contact": ""},
            "creators": creator_directory(database, sample_only=True),
            "campaigns": [campaign_response(campaign, database) for campaign in campaigns],
            "results": [result for result in get_results(company, database)
                        if result["is_sample"] and result["campaign_id"] in ids]}
