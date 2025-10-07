"""add_deployments_table

Revision ID: 4c61e8fdb47e
Revises: d05d37ffa8ed
Create Date: 2025-10-07 01:22:10.142214

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c61e8fdb47e'
down_revision: Union[str, Sequence[str], None] = 'd05d37ffa8ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add version tracking fields to services table
    op.add_column('services', sa.Column('version_url', sa.String(length=1024), nullable=True))
    op.add_column('services', sa.Column('version_json_path', sa.String(length=255), nullable=True))
    op.add_column('services', sa.Column('current_version', sa.String(length=255), nullable=True))
    op.add_column('services', sa.Column('last_version_check', sa.DateTime(), nullable=True))

    # Create deployments table
    op.create_table('deployments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.String(length=255), nullable=False),
        sa.Column('detected_at', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deployments_id'), 'deployments', ['id'], unique=False)
    op.create_index(op.f('ix_deployments_service_id'), 'deployments', ['service_id'], unique=False)
    op.create_index(op.f('ix_deployments_detected_at'), 'deployments', ['detected_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_deployments_detected_at'), table_name='deployments')
    op.drop_index(op.f('ix_deployments_service_id'), table_name='deployments')
    op.drop_index(op.f('ix_deployments_id'), table_name='deployments')
    op.drop_table('deployments')

    op.drop_column('services', 'last_version_check')
    op.drop_column('services', 'current_version')
    op.drop_column('services', 'version_json_path')
    op.drop_column('services', 'version_url')
