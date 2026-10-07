"""Add company workspace, creator analytics, and campaign persistence."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d8f412c0a901"
down_revision = "c4e83b92d010"
branch_labels = None
depends_on = None


def record_columns():
    return [
        sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def reference(name, table, ondelete):
    return sa.Column(name, sa.UUID(), sa.ForeignKey(f"{table}.id", ondelete=ondelete), nullable=False)


def currency():
    return sa.Column("currency", sa.String(3), server_default="INR", nullable=False)


def sample():
    return sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False)


def upgrade():
    op.create_table("companies", *record_columns(),
        reference("owner_id", "users", "RESTRICT"),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("industry", sa.String(80), nullable=False),
        sa.Column("contact_email", sa.String(320)), currency(),
        sa.UniqueConstraint("owner_id"),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_companies_name"),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_companies_currency"))
    op.create_table("creator_profiles", *record_columns(),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("sample_key", sa.String(60)),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("city", sa.String(100)),
        sa.Column("country_code", sa.String(2), server_default="IN", nullable=False),
        sa.Column("bio", sa.Text()), sa.Column("photo_url", sa.Text()),
        sa.Column("cover_url", sa.Text()), sa.Column("indicative_fee", sa.Numeric(14, 2)),
        currency(), sample(), sa.UniqueConstraint("user_id"), sa.UniqueConstraint("sample_key"),
        sa.CheckConstraint("length(trim(display_name)) > 0", name="ck_creator_profiles_name"),
        sa.CheckConstraint("indicative_fee IS NULL OR indicative_fee >= 0", name="ck_creator_profiles_fee"),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_creator_profiles_currency"))
    op.create_index("ix_creator_profiles_category_city", "creator_profiles", ["category", "city"])
    op.create_table("social_accounts", *record_columns(),
        reference("creator_id", "creator_profiles", "CASCADE"),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("handle", sa.String(120), nullable=False),
        sa.Column("platform_user_id", sa.String(120)),
        sa.Column("connection_status", sa.String(20), server_default="not_connected", nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("platform IN ('instagram', 'youtube')", name="ck_social_accounts_platform"),
        sa.CheckConstraint("connection_status IN ('not_connected', 'connected', 'expired')", name="ck_social_accounts_status"),
        sa.UniqueConstraint("platform", "handle", name="uq_social_accounts_platform_handle"),
        sa.UniqueConstraint("platform", "platform_user_id", name="uq_social_accounts_platform_user"))
    op.create_index("ix_social_accounts_creator_id", "social_accounts", ["creator_id"])
    op.create_table("metric_snapshots", *record_columns(),
        reference("account_id", "social_accounts", "CASCADE"),
        sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("followers", sa.Integer(), nullable=False),
        sa.Column("engagement_rate", sa.Numeric(8, 3), nullable=False),
        sa.Column("growth_rate", sa.Numeric(8, 3), nullable=False),
        sa.Column("average_reach", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(40), server_default="platform", nullable=False), sample(),
        sa.UniqueConstraint("account_id", "observed_on", name="uq_metric_snapshots_account_date"),
        sa.CheckConstraint("followers >= 0 AND average_reach >= 0", name="ck_metric_snapshots_counts"),
        sa.CheckConstraint("engagement_rate >= 0", name="ck_metric_snapshots_engagement"),
        sa.CheckConstraint("growth_rate >= -100", name="ck_metric_snapshots_growth"))
    op.create_table("audience_snapshots", *record_columns(),
        reference("account_id", "social_accounts", "CASCADE"),
        sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("locations", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("age_groups", postgresql.JSONB(), server_default="[]", nullable=False), sample(),
        sa.UniqueConstraint("account_id", "observed_on", name="uq_audience_snapshots_account_date"),
        sa.CheckConstraint("jsonb_typeof(locations) = 'array' AND jsonb_typeof(age_groups) = 'array'", name="ck_audience_snapshots_arrays"))
    op.create_table("content_items", *record_columns(),
        reference("account_id", "social_accounts", "CASCADE"),
        sa.Column("platform_content_id", sa.String(160), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("content_type", sa.String(30), nullable=False),
        sa.Column("media_url", sa.Text()), sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("reach", sa.Integer()), sa.Column("engagements", sa.Integer()), sample(),
        sa.UniqueConstraint("account_id", "platform_content_id", name="uq_content_items_account_platform_id"),
        sa.CheckConstraint("reach IS NULL OR reach >= 0", name="ck_content_items_reach"),
        sa.CheckConstraint("engagements IS NULL OR engagements >= 0", name="ck_content_items_engagements"))
    op.create_index("ix_content_items_account_published", "content_items", ["account_id", "published_at"])
    op.create_table("shortlist_entries", *record_columns(),
        reference("company_id", "companies", "CASCADE"),
        reference("creator_id", "creator_profiles", "CASCADE"), sa.Column("notes", sa.Text()),
        sa.UniqueConstraint("company_id", "creator_id", name="uq_shortlist_entries_company_creator"))
    op.create_index("ix_shortlist_entries_creator_id", "shortlist_entries", ["creator_id"])
    op.create_table("campaigns", *record_columns(),
        reference("company_id", "companies", "CASCADE"), sa.Column("sample_key", sa.String(60)),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("objective", sa.String(80), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("budget", sa.Numeric(14, 2), nullable=False), currency(),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("start_date", sa.Date()), sa.Column("end_date", sa.Date()),
        sa.Column("brief", sa.Text(), server_default="", nullable=False),
        sa.Column("deliverables", sa.Text(), server_default="", nullable=False), sample(),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_campaigns_name"),
        sa.CheckConstraint("budget > 0", name="ck_campaigns_budget"),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name="ck_campaigns_currency"),
        sa.CheckConstraint("status IN ('draft', 'planning', 'active', 'completed')", name="ck_campaigns_status"),
        sa.CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date >= start_date", name="ck_campaigns_dates"),
        sa.UniqueConstraint("company_id", "sample_key", name="uq_campaigns_company_sample_key"))
    op.create_index("ix_campaigns_company_status", "campaigns", ["company_id", "status"])
    op.create_table("campaign_creators", *record_columns(),
        reference("campaign_id", "campaigns", "CASCADE"),
        reference("creator_id", "creator_profiles", "RESTRICT"),
        sa.Column("agreed_fee", sa.Numeric(14, 2)), sa.Column("deliverables", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.UniqueConstraint("campaign_id", "creator_id", name="uq_campaign_creators_campaign_creator"),
        sa.CheckConstraint("agreed_fee IS NULL OR agreed_fee >= 0", name="ck_campaign_creators_fee"))
    op.create_index("ix_campaign_creators_creator_id", "campaign_creators", ["creator_id"])
    op.create_table("campaign_milestones", *record_columns(),
        reference("campaign_id", "campaigns", "CASCADE"),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("campaign_id", "name", name="uq_campaign_milestones_campaign_name"))
    op.create_table("campaign_results", *record_columns(),
        reference("assignment_id", "campaign_creators", "CASCADE"),
        sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("reach", sa.Integer(), nullable=False),
        sa.Column("engagements", sa.Integer(), nullable=False),
        sa.Column("clicks", sa.Integer(), nullable=False),
        sa.Column("spend", sa.Numeric(14, 2), nullable=False), sample(),
        sa.UniqueConstraint("assignment_id", "observed_on", name="uq_campaign_results_assignment_date"),
        sa.CheckConstraint("reach >= 0 AND engagements >= 0 AND clicks >= 0 AND spend >= 0", name="ck_campaign_results_nonnegative"))


def downgrade():
    for table in ["campaign_results", "campaign_milestones", "campaign_creators", "campaigns",
                  "shortlist_entries", "content_items", "audience_snapshots", "metric_snapshots",
                  "social_accounts", "creator_profiles", "companies"]:
        op.drop_table(table)
