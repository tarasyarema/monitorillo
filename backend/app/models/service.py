from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.team import Team


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(length=50), nullable=False, index=True)  # healthy, degraded, unhealthy, unknown
    version_url: Mapped[str | None] = mapped_column(String(length=1024), nullable=True)
    version_json_path: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    current_version: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    last_version_check: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="services")
    health_checks: Mapped[List["HealthCheck"]] = relationship(
        "HealthCheck", back_populates="service", cascade="all, delete-orphan"
    )
    version_checks: Mapped[List["VersionCheck"]] = relationship(
        "VersionCheck", back_populates="service", cascade="all, delete-orphan"
    )
    deployments: Mapped[List["Deployment"]] = relationship(
        "Deployment", back_populates="service", cascade="all, delete-orphan"
    )


class HealthCheck(Base):
    __tablename__ = "health_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    url: Mapped[str] = mapped_column(String(length=1024), nullable=False)
    method: Mapped[str] = mapped_column(String(length=10), nullable=False)  # GET, POST, PUT, DELETE
    headers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    check_interval_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    json_path: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    expected_value: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    alert_on_failure: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    service: Mapped["Service"] = relationship("Service", back_populates="health_checks")
    results: Mapped[List["HealthCheckResult"]] = relationship(
        "HealthCheckResult", back_populates="health_check", cascade="all, delete-orphan"
    )


class HealthCheckResult(Base):
    __tablename__ = "health_check_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    health_check_id: Mapped[int] = mapped_column(ForeignKey("health_checks.id"), nullable=False, index=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # Relationships
    health_check: Mapped["HealthCheck"] = relationship("HealthCheck", back_populates="results")


class VersionCheck(Base):
    __tablename__ = "version_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    url: Mapped[str] = mapped_column(String(length=1024), nullable=False)
    json_path: Mapped[str] = mapped_column(String(length=255), nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    check_interval_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    alert_on_failure: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    service: Mapped["Service"] = relationship("Service", back_populates="version_checks")
    results: Mapped[List["VersionCheckResult"]] = relationship(
        "VersionCheckResult", back_populates="version_check", cascade="all, delete-orphan"
    )


class VersionCheckResult(Base):
    __tablename__ = "version_check_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    version_check_id: Mapped[int] = mapped_column(ForeignKey("version_checks.id"), nullable=False, index=True)
    version: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # Relationships
    version_check: Mapped["VersionCheck"] = relationship("VersionCheck", back_populates="results")


class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(length=255), nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True, default=datetime.utcnow)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    service: Mapped["Service"] = relationship("Service", back_populates="deployments")
