from datetime import datetime
from typing import List

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    hostname: Mapped[str] = mapped_column(String(length=255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(length=50), nullable=False, default="offline"
    )  # online, offline, warning, critical
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    tags: Mapped[dict] = mapped_column(JSON, nullable=True, default=dict)
    api_key: Mapped[str] = mapped_column(String(length=255), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="servers")
    metrics: Mapped[List["Metric"]] = relationship(
        "Metric", back_populates="server", cascade="all, delete-orphan"
    )
    alert_configs: Mapped[List["AlertConfig"]] = relationship(
        "AlertConfig", back_populates="server", cascade="all, delete-orphan"
    )
    alerts: Mapped[List["Alert"]] = relationship(
        "Alert", back_populates="server", cascade="all, delete-orphan"
    )


class Metric(Base):
    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    server_id: Mapped[int] = mapped_column(ForeignKey("servers.id"), nullable=False, index=True)
    metric_type: Mapped[str] = mapped_column(
        String(length=50), nullable=False
    )  # system, docker
    value: Mapped[dict] = mapped_column(JSON, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, index=True
    )

    # Relationships
    server: Mapped["Server"] = relationship("Server", back_populates="metrics")
