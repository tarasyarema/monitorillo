from datetime import datetime
from typing import List

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    slug: Mapped[str] = mapped_column(String(length=255), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    members: Mapped[List["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )
    servers: Mapped[List["Server"]] = relationship(
        "Server", back_populates="team", cascade="all, delete-orphan"
    )
    alert_configs: Mapped[List["AlertConfig"]] = relationship(
        "AlertConfig", back_populates="team", cascade="all, delete-orphan"
    )
    alerts: Mapped[List["Alert"]] = relationship(
        "Alert", back_populates="team", cascade="all, delete-orphan"
    )
    invitations: Mapped[List["Invitation"]] = relationship(
        "Invitation", back_populates="team", cascade="all, delete-orphan"
    )
    services: Mapped[List["Service"]] = relationship(
        "Service", back_populates="team", cascade="all, delete-orphan"
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(
        String(length=50), nullable=False, default="member"
    )  # owner, admin, member, viewer
    joined_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="team_memberships")
    team: Mapped["Team"] = relationship("Team", back_populates="members")
