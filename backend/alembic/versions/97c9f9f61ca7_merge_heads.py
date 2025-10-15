"""merge heads

Revision ID: 97c9f9f61ca7
Revises: 85e750f5b037, healthcheck_alerts_001
Create Date: 2025-10-07 17:24:49.724953

"""
from typing import Sequence, Union



# revision identifiers, used by Alembic.
revision: str = '97c9f9f61ca7'
down_revision: Union[str, Sequence[str], None] = ('85e750f5b037', 'healthcheck_alerts_001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
