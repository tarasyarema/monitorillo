"""add alert_on_failure to health checks

Revision ID: healthcheck_alerts_001
Revises: notification_channels_001
Create Date: 2025-01-07

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'healthcheck_alerts_001'
down_revision = 'notification_channels_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('health_checks', sa.Column('alert_on_failure', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    op.drop_column('health_checks', 'alert_on_failure')
