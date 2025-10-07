from datetime import datetime
from pydantic import BaseModel
from typing import Optional


# Service schemas
class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    version_url: Optional[str] = None
    version_json_path: Optional[str] = None


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version_url: Optional[str] = None
    version_json_path: Optional[str] = None


class ServiceRead(ServiceBase):
    id: int
    team_id: int
    status: str
    current_version: Optional[str] = None
    last_version_check: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Health Check schemas
class HealthCheckBase(BaseModel):
    name: str
    url: str
    method: str
    headers: Optional[dict] = None
    body: Optional[str] = None
    expected_status_code: int
    timeout_seconds: int = 30
    check_interval_minutes: int = 5
    json_path: Optional[str] = None
    expected_value: Optional[str] = None
    enabled: bool = True


class HealthCheckCreate(HealthCheckBase):
    pass


class HealthCheckUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    method: Optional[str] = None
    headers: Optional[dict] = None
    body: Optional[str] = None
    expected_status_code: Optional[int] = None
    timeout_seconds: Optional[int] = None
    check_interval_minutes: Optional[int] = None
    json_path: Optional[str] = None
    expected_value: Optional[str] = None
    enabled: Optional[bool] = None


class HealthCheckRead(HealthCheckBase):
    id: int
    service_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Health Check Result schemas
class HealthCheckResultRead(BaseModel):
    id: int
    health_check_id: int
    success: bool
    status_code: Optional[int]
    response_time_ms: Optional[int]
    error_message: Optional[str]
    checked_at: datetime

    model_config = {"from_attributes": True}


# Version Check schemas
class VersionCheckBase(BaseModel):
    name: str
    url: str
    json_path: str
    timeout_seconds: int = 30
    check_interval_minutes: int = 5
    enabled: bool = True


class VersionCheckCreate(VersionCheckBase):
    pass


class VersionCheckUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    json_path: Optional[str] = None
    timeout_seconds: Optional[int] = None
    check_interval_minutes: Optional[int] = None
    enabled: Optional[bool] = None


class VersionCheckRead(VersionCheckBase):
    id: int
    service_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Version Check Result schemas
class VersionCheckResultRead(BaseModel):
    id: int
    version_check_id: int
    version: Optional[str]
    success: bool
    response_time_ms: Optional[int]
    error_message: Optional[str]
    checked_at: datetime

    model_config = {"from_attributes": True}


# Deployment schemas
class DeploymentRead(BaseModel):
    id: int
    service_id: int
    version: str
    detected_at: datetime
    notes: Optional[str]

    model_config = {"from_attributes": True}


class DeploymentUpdate(BaseModel):
    notes: Optional[str] = None
