from datetime import datetime
from typing import List

from pydantic import BaseModel


class TeamMemberBase(BaseModel):
    user_id: int
    role: str = "member"


class TeamMemberCreate(TeamMemberBase):
    pass


class TeamMemberUpdate(BaseModel):
    role: str


class TeamMemberRead(TeamMemberBase):
    id: int
    team_id: int
    joined_at: datetime

    model_config = {"from_attributes": True}


class TeamBase(BaseModel):
    name: str


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: str | None = None


class TeamRead(TeamBase):
    id: int
    slug: str
    created_at: datetime
    members: List[TeamMemberRead] = []

    model_config = {"from_attributes": True}
