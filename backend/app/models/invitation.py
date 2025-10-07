from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.team import Team
    from app.models.user import User


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(length=320), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(length=50), nullable=False)  # owner, admin, member, viewer
    token: Mapped[str] = mapped_column(String(length=255), nullable=False, unique=True, index=True)
    invited_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(length=20), nullable=False, index=True)  # pending, accepted, revoked, expired
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="invitations")
    inviter: Mapped["User"] = relationship("User", foreign_keys=[invited_by])
