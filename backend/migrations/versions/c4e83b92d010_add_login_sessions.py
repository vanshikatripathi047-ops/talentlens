"""Add revocable login sessions."""
from alembic import op
import sqlalchemy as sa

revision = "c4e83b92d010"
down_revision = "b603faf76369"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("login_sessions",
                    sa.Column("token_hash", sa.String(64), primary_key=True),
                    sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
                    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_login_sessions_user_id", "login_sessions", ["user_id"])


def downgrade():
    op.drop_table("login_sessions")
