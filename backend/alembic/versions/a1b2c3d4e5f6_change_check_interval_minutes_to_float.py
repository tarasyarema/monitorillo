"""change check_interval_minutes to float

Revision ID: a1b2c3d4e5f6
Revises: 9e714965f159
Create Date: 2025-11-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9e714965f159'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Change check_interval_minutes from Integer to Float in health_checks table
    op.alter_column('health_checks', 'check_interval_minutes',
                    existing_type=sa.Integer(),
                    type_=sa.Float(),
                    existing_nullable=False)

    # Change check_interval_minutes from Integer to Float in version_checks table
    op.alter_column('version_checks', 'check_interval_minutes',
                    existing_type=sa.Integer(),
                    type_=sa.Float(),
                    existing_nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Revert check_interval_minutes back to Integer in version_checks table
    op.alter_column('version_checks', 'check_interval_minutes',
                    existing_type=sa.Float(),
                    type_=sa.Integer(),
                    existing_nullable=False)

    # Revert check_interval_minutes back to Integer in health_checks table
    op.alter_column('health_checks', 'check_interval_minutes',
                    existing_type=sa.Float(),
                    type_=sa.Integer(),
                    existing_nullable=False)
