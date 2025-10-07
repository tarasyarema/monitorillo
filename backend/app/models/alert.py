from datetime import datetime
from typing import List

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    server_id: Mapped[int | None] = mapped_column(ForeignKey("servers.id"), nullable=True, index=True)
    metric_type: Mapped[str] = mapped_column(String(length=50), nullable=False)  # cpu, memory, disk
    warning_threshold: Mapped[float] = mapped_column(Float, nullable=False)
    critical_threshold: Mapped[float] = mapped_column(Float, nullable=False)
    sustained_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="alert_configs")
    server: Mapped["Server"] = relationship("Server", back_populates="alert_configs")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)

    # Server metric alerts
    server_id: Mapped[int | None] = mapped_column(ForeignKey("servers.id"), nullable=True, index=True)
    metric_type: Mapped[str | None] = mapped_column(String(length=50), nullable=True)
    threshold_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_value: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Healthcheck alerts
    health_check_id: Mapped[int | None] = mapped_column(ForeignKey("health_checks.id"), nullable=True, index=True)
    version_check_id: Mapped[int | None] = mapped_column(ForeignKey("version_checks.id"), nullable=True, index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id"), nullable=True, index=True)

    # Common fields
    severity: Mapped[str] = mapped_column(String(length=20), nullable=False)  # warning, critical
    state: Mapped[str] = mapped_column(String(length=20), nullable=False, index=True)  # new, acknowledged, resolved
    message: Mapped[str] = mapped_column(Text, nullable=True)
    first_triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    acknowledged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="alerts")
    server: Mapped["Server"] = relationship("Server", back_populates="alerts")
    health_check: Mapped["HealthCheck"] = relationship("HealthCheck", foreign_keys=[health_check_id])
    version_check: Mapped["VersionCheck"] = relationship("VersionCheck", foreign_keys=[version_check_id])
    service: Mapped["Service"] = relationship("Service", foreign_keys=[service_id])
    acknowledger: Mapped["User"] = relationship("User", foreign_keys=[acknowledged_by])
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification", back_populates="alert", cascade="all, delete-orphan"
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(length=50), nullable=False)  # email, slack
    recipient: Mapped[str] = mapped_column(String(length=255), nullable=False)
    status: Mapped[str] = mapped_column(String(length=20), nullable=False)  # pending, sent, failed
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    alert: Mapped["Alert"] = relationship("Alert", back_populates="notifications")
