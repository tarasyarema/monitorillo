"""add healthcheck support to alerts

Revision ID: dfb7988b9f33
Revises: 97c9f9f61ca7
Create Date: 2025-10-07 17:35:41.200384

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dfb7988b9f33'
down_revision: Union[str, Sequence[str], None] = '97c9f9f61ca7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Make server metric fields nullable
    op.alter_column('alerts', 'server_id', nullable=True, existing_type=sa.Integer())
    op.alter_column('alerts', 'metric_type', nullable=True, existing_type=sa.String(length=50))
    op.alter_column('alerts', 'threshold_value', nullable=True, existing_type=sa.Float())
    op.alter_column('alerts', 'current_value', nullable=True, existing_type=sa.Float())

    # Add healthcheck alert fields
    op.add_column('alerts', sa.Column('health_check_id', sa.Integer(), nullable=True))
    op.add_column('alerts', sa.Column('service_id', sa.Integer(), nullable=True))
    op.add_column('alerts', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.add_column('alerts', sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))

    # Create indexes
    op.create_index(op.f('ix_alerts_health_check_id'), 'alerts', ['health_check_id'], unique=False)
    op.create_index(op.f('ix_alerts_service_id'), 'alerts', ['service_id'], unique=False)

    # Create foreign keys
    op.create_foreign_key('fk_alerts_health_check_id', 'alerts', 'health_checks', ['health_check_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('fk_alerts_service_id', 'alerts', 'services', ['service_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema."""
    # Remove foreign keys
    op.drop_constraint('fk_alerts_service_id', 'alerts', type_='foreignkey')
    op.drop_constraint('fk_alerts_health_check_id', 'alerts', type_='foreignkey')

    # Remove indexes
    op.drop_index(op.f('ix_alerts_service_id'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_health_check_id'), table_name='alerts')

    # Remove columns
    op.drop_column('alerts', 'updated_at')
    op.drop_column('alerts', 'created_at')
    op.drop_column('alerts', 'service_id')
    op.drop_column('alerts', 'health_check_id')

    # Make server metric fields non-nullable again
    op.alter_column('alerts', 'current_value', nullable=False, existing_type=sa.Float())
    op.alter_column('alerts', 'threshold_value', nullable=False, existing_type=sa.Float())
    op.alter_column('alerts', 'metric_type', nullable=False, existing_type=sa.String(length=50))
    op.alter_column('alerts', 'server_id', nullable=False, existing_type=sa.Integer())
