"""add_version_check_alerts_and_alert_on_failure

Revision ID: 9e714965f159
Revises: dfb7988b9f33
Create Date: 2025-10-07 17:41:35.630277

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e714965f159'
down_revision: Union[str, Sequence[str], None] = 'dfb7988b9f33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add version_check_id to alerts table
    op.add_column('alerts', sa.Column('version_check_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_alerts_version_check_id'), 'alerts', ['version_check_id'], unique=False)
    op.create_foreign_key('fk_alerts_version_check_id', 'alerts', 'version_checks', ['version_check_id'], ['id'], ondelete='CASCADE')

    # Add alert_on_failure to version_checks table
    op.add_column('version_checks', sa.Column('alert_on_failure', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove alert_on_failure from version_checks
    op.drop_column('version_checks', 'alert_on_failure')

    # Remove version_check_id from alerts
    op.drop_constraint('fk_alerts_version_check_id', 'alerts', type_='foreignkey')
    op.drop_index(op.f('ix_alerts_version_check_id'), table_name='alerts')
    op.drop_column('alerts', 'version_check_id')
