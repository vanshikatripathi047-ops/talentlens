"""Company workspace and creator analytics persistence."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer,
    Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Record:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Company(Record, Base):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_companies_name"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_companies_currency"),
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    industry: Mapped[str] = mapped_column(String(80))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")


class CreatorProfile(Record, Base):
    __tablename__ = "creator_profiles"
    __table_args__ = (
        CheckConstraint("length(trim(display_name)) > 0", name="ck_creator_profiles_name"),
        CheckConstraint("indicative_fee IS NULL OR indicative_fee >= 0", name="ck_creator_profiles_fee"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_creator_profiles_currency"),
        Index("ix_creator_profiles_category_city", "category", "city"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    sample_key: Mapped[str | None] = mapped_column(String(60), unique=True)
    display_name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(80))
    city: Mapped[str | None] = mapped_column(String(100))
    country_code: Mapped[str] = mapped_column(String(2), default="IN", server_default="IN")
    bio: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(Text)
    indicative_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class SocialAccount(Record, Base):
    __tablename__ = "social_accounts"
    __table_args__ = (
        CheckConstraint("platform IN ('instagram', 'youtube')", name="ck_social_accounts_platform"),
        CheckConstraint("connection_status IN ('not_connected', 'connected', 'expired')", name="ck_social_accounts_status"),
        UniqueConstraint("platform", "handle", name="uq_social_accounts_platform_handle"),
        UniqueConstraint("platform", "platform_user_id", name="uq_social_accounts_platform_user"),
    )

    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    platform: Mapped[str] = mapped_column(String(20))
    handle: Mapped[str] = mapped_column(String(120))
    platform_user_id: Mapped[str | None] = mapped_column(String(120))
    connection_status: Mapped[str] = mapped_column(String(20), default="not_connected", server_default="not_connected")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MetricSnapshot(Record, Base):
    __tablename__ = "metric_snapshots"
    __table_args__ = (
        UniqueConstraint("account_id", "observed_on", name="uq_metric_snapshots_account_date"),
        CheckConstraint("followers >= 0 AND average_reach >= 0", name="ck_metric_snapshots_counts"),
        CheckConstraint("engagement_rate >= 0", name="ck_metric_snapshots_engagement"),
        CheckConstraint("growth_rate >= -100", name="ck_metric_snapshots_growth"),
    )

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("social_accounts.id", ondelete="CASCADE"))
    observed_on: Mapped[date] = mapped_column(Date)
    followers: Mapped[int] = mapped_column(Integer)
    engagement_rate: Mapped[Decimal] = mapped_column(Numeric(8, 3))
    growth_rate: Mapped[Decimal] = mapped_column(Numeric(8, 3))
    average_reach: Mapped[int] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(40), default="platform", server_default="platform")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class AudienceSnapshot(Record, Base):
    __tablename__ = "audience_snapshots"
    __table_args__ = (
        UniqueConstraint("account_id", "observed_on", name="uq_audience_snapshots_account_date"),
        CheckConstraint("jsonb_typeof(locations) = 'array' AND jsonb_typeof(age_groups) = 'array'", name="ck_audience_snapshots_arrays"),
    )

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("social_accounts.id", ondelete="CASCADE"))
    observed_on: Mapped[date] = mapped_column(Date)
    locations: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    age_groups: Mapped[list[dict]] = mapped_column(JSONB, default=list, server_default="[]")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class ContentItem(Record, Base):
    __tablename__ = "content_items"
    __table_args__ = (
        UniqueConstraint("account_id", "platform_content_id", name="uq_content_items_account_platform_id"),
        CheckConstraint("reach IS NULL OR reach >= 0", name="ck_content_items_reach"),
        CheckConstraint("engagements IS NULL OR engagements >= 0", name="ck_content_items_engagements"),
        Index("ix_content_items_account_published", "account_id", "published_at"),
    )

    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("social_accounts.id", ondelete="CASCADE"))
    platform_content_id: Mapped[str] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(30))
    media_url: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reach: Mapped[int | None] = mapped_column(Integer)
    engagements: Mapped[int | None] = mapped_column(Integer)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class ContentIdea(Record, Base):
    __tablename__ = "content_ideas"
    __table_args__ = (
        UniqueConstraint("creator_id", "sample_key", name="uq_content_ideas_creator_sample_key"),
        CheckConstraint("length(trim(title)) > 0", name="ck_content_ideas_title"),
        CheckConstraint("jsonb_typeof(hashtags) = 'array'", name="ck_content_ideas_hashtags"),
    )

    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    sample_key: Mapped[str | None] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(300))
    rationale: Mapped[str] = mapped_column(Text)
    hashtags: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class ShortlistEntry(Record, Base):
    __tablename__ = "shortlist_entries"
    __table_args__ = (UniqueConstraint("company_id", "creator_id", name="uq_shortlist_entries_company_creator"),)

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    notes: Mapped[str | None] = mapped_column(Text)


class Campaign(Record, Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_campaigns_name"),
        CheckConstraint("budget > 0", name="ck_campaigns_budget"),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_campaigns_currency"),
        CheckConstraint("status IN ('draft', 'planning', 'active', 'completed')", name="ck_campaigns_status"),
        CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date >= start_date", name="ck_campaigns_dates"),
        UniqueConstraint("company_id", "sample_key", name="uq_campaigns_company_sample_key"),
        Index("ix_campaigns_company_status", "company_id", "status"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"))
    sample_key: Mapped[str | None] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(120))
    objective: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(80))
    budget: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    brief: Mapped[str] = mapped_column(Text, default="", server_default="")
    deliverables: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class CampaignCreator(Record, Base):
    __tablename__ = "campaign_creators"
    __table_args__ = (
        UniqueConstraint("campaign_id", "creator_id", name="uq_campaign_creators_campaign_creator"),
        CheckConstraint("agreed_fee IS NULL OR agreed_fee >= 0", name="ck_campaign_creators_fee"),
    )

    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"))
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("creator_profiles.id", ondelete="RESTRICT"), index=True)
    agreed_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    deliverables: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class CampaignMilestone(Record, Base):
    __tablename__ = "campaign_milestones"
    __table_args__ = (UniqueConstraint("campaign_id", "name", name="uq_campaign_milestones_campaign_name"),)

    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CampaignResult(Record, Base):
    __tablename__ = "campaign_results"
    __table_args__ = (
        UniqueConstraint("assignment_id", "observed_on", name="uq_campaign_results_assignment_date"),
        CheckConstraint("reach >= 0 AND engagements >= 0 AND clicks >= 0 AND spend >= 0", name="ck_campaign_results_nonnegative"),
    )

    assignment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaign_creators.id", ondelete="CASCADE"))
    observed_on: Mapped[date] = mapped_column(Date)
    reach: Mapped[int] = mapped_column(Integer)
    engagements: Mapped[int] = mapped_column(Integer)
    clicks: Mapped[int] = mapped_column(Integer)
    spend: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
