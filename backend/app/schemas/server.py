from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ServerBase(BaseModel):
    name: str
    hostname: str | None = None
    tags: dict[str, Any] | None = None


class ServerCreate(ServerBase):
    pass


class ServerUpdate(BaseModel):
    name: str | None = None
    hostname: str | None = None
    tags: dict[str, Any] | None = None


class ServerRead(ServerBase):
    id: int
    team_id: int
    status: str
    last_seen_at: datetime | None
    api_key: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MetricCreate(BaseModel):
    server_name: str
    timestamp: str
    system: dict[str, Any]
    docker: dict[str, Any]


class MetricRead(BaseModel):
    id: int
    server_id: int
    metric_type: str
    value: dict[str, Any]
    timestamp: datetime

    model_config = {"from_attributes": True}
