"""add_services_and_health_checks

Revision ID: d05d37ffa8ed
Revises: a114e5d03dad
Create Date: 2025-10-06 22:55:48.129348

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd05d37ffa8ed'
down_revision: Union[str, Sequence[str], None] = 'a114e5d03dad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Services table
    op.create_table('services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),  # healthy, degraded, unhealthy, unknown
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_services_id'), 'services', ['id'], unique=False)
    op.create_index(op.f('ix_services_team_id'), 'services', ['team_id'], unique=False)
    op.create_index(op.f('ix_services_status'), 'services', ['status'], unique=False)

    # Health checks table
    op.create_table('health_checks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('url', sa.String(length=1024), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False),  # GET, POST, PUT, DELETE
        sa.Column('headers', sa.JSON(), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('expected_status_code', sa.Integer(), nullable=False),
        sa.Column('timeout_seconds', sa.Integer(), nullable=False),
        sa.Column('check_interval_minutes', sa.Integer(), nullable=False),  # Fixed interval for simplicity
        sa.Column('json_path', sa.String(length=255), nullable=True),  # JSONPath expression
        sa.Column('expected_value', sa.String(length=255), nullable=True),  # Expected value at json_path
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_health_checks_id'), 'health_checks', ['id'], unique=False)
    op.create_index(op.f('ix_health_checks_service_id'), 'health_checks', ['service_id'], unique=False)
    op.create_index(op.f('ix_health_checks_enabled'), 'health_checks', ['enabled'], unique=False)

    # Health check results table (time-series)
    op.create_table('health_check_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('health_check_id', sa.Integer(), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('checked_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['health_check_id'], ['health_checks.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_health_check_results_id'), 'health_check_results', ['id'], unique=False)
    op.create_index(op.f('ix_health_check_results_health_check_id'), 'health_check_results', ['health_check_id'], unique=False)
    op.create_index(op.f('ix_health_check_results_checked_at'), 'health_check_results', ['checked_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_health_check_results_checked_at'), table_name='health_check_results')
    op.drop_index(op.f('ix_health_check_results_health_check_id'), table_name='health_check_results')
    op.drop_index(op.f('ix_health_check_results_id'), table_name='health_check_results')
    op.drop_table('health_check_results')

    op.drop_index(op.f('ix_health_checks_enabled'), table_name='health_checks')
    op.drop_index(op.f('ix_health_checks_service_id'), table_name='health_checks')
    op.drop_index(op.f('ix_health_checks_id'), table_name='health_checks')
    op.drop_table('health_checks')

    op.drop_index(op.f('ix_services_status'), table_name='services')
    op.drop_index(op.f('ix_services_team_id'), table_name='services')
    op.drop_index(op.f('ix_services_id'), table_name='services')
    op.drop_table('services')
