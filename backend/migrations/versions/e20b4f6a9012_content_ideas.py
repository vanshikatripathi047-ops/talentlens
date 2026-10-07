"""Add persisted creator content ideas and hashtags."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "e20b4f6a9012"
down_revision = "d8f412c0a901"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "content_ideas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("creator_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sample_key", sa.String(60)),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("hashtags", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default="false", nullable=False),
        sa.UniqueConstraint("creator_id", "sample_key", name="uq_content_ideas_creator_sample_key"),
        sa.CheckConstraint("length(trim(title)) > 0", name="ck_content_ideas_title"),
        sa.CheckConstraint("jsonb_typeof(hashtags) = 'array'", name="ck_content_ideas_hashtags"),
    )
    op.create_index("ix_content_ideas_creator_id", "content_ideas", ["creator_id"])


def downgrade():
    op.drop_index("ix_content_ideas_creator_id", table_name="content_ideas")
    op.drop_table("content_ideas")
