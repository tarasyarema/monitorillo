from datetime import datetime
from pydantic import BaseModel, EmailStr


class InvitationCreate(BaseModel):
    email: EmailStr
    role: str  # owner, admin, member, viewer


class InvitationRead(BaseModel):
    id: int
    team_id: int
    email: str
    role: str
    status: str
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None
    invited_by: int

    model_config = {"from_attributes": True}


class InvitationAccept(BaseModel):
    token: str
