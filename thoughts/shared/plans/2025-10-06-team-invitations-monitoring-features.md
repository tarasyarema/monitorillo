# Team Invitations, URL/API Monitoring, and Service Version Tracking Implementation Plan

## Overview

This plan implements three major features for Monitorillo:

1. **Team Invitations**: Email-based invitation system using Resend API for inviting users to teams
2. **URL/API Health Monitoring**: HTTP health check system for monitoring external URLs/APIs with configurable requests and JSON validation
3. **Service Version Tracking**: Automated version detection and deployment history tracking for deployed services

All features maintain the existing multi-tenant architecture with role-based access control and build on established patterns for alerts, metrics, and state management.

## Current State Analysis

### What Exists

**Team Management**:
- Complete CRUD operations for teams (`backend/app/api/teams.py`)
- Role-based access control (OWNER, ADMIN, MEMBER, VIEWER) in `backend/app/core/rbac.py`
- Team member management API
- Frontend team listing and creation UI

**Monitoring System**:
- Server infrastructure monitoring via daemon agents
- Alert system with threshold-based evaluation (`backend/app/services/alert_evaluator.py`)
- Notification tracking schema (email/slack channels)
- Time-series metric storage with JSON values

**Infrastructure Ready**:
- Resend API configured (`RESEND_API_KEY` in settings) but not implemented
- httpx v0.26.0 installed for async HTTP requests
- React Query for frontend data fetching
- PostgreSQL with Alembic migrations

### What's Missing

**For Team Invitations**:
- No invitations database table or model
- No email sending service implementation
- No invitation token generation/validation
- No invitation UI components

**For URL/API Monitoring**:
- No "services" concept (only "servers" for infrastructure)
- No HTTP health check configuration storage
- No background worker for executing checks
- No JSON path validation capability

**For Version Tracking**:
- No deployment/version history table
- No version detection logic
- No version comparison or change detection

## Desired End State

### Team Invitations
Users can invite people to teams via email:
- Team admins can create invitations with email and role
- System sends invitation email with secure token link (48-hour expiry)
- Invited users can accept invitations (creates TeamMember record)
- Invitations can be listed, revoked, and expire automatically

**Verification**: Create invitation → receive email → click link → verify team membership created

### URL/API Monitoring
Users can monitor external services via HTTP health checks:
- Create "services" (distinct from "servers") with name and description
- Configure health checks with: URL, HTTP method, headers, expected status code, JSON path validation
- Background worker executes checks every 5 minutes
- Failed checks trigger alerts following existing alert system patterns
- Health check results stored as time-series data

**Verification**: Configure health check → see results in UI → trigger failure → verify alert created

### Service Version Tracking
Users can track deployments and version changes:
- Configure version endpoint (URL + JSON path to version field)
- System periodically queries endpoint and extracts version
- Version changes create deployment records with timestamp
- Full deployment history available with pagination
- Supports rollbacks (version change in any direction)

**Verification**: Configure version endpoint → verify version detected → change deployment → verify new deployment record created

## What We're NOT Doing

- Slack notification implementation (email only for now)
- Email template customization (using simple HTML templates)
- Advanced scheduling (fixed 5-minute intervals only)
- Health check authentication UI (headers can be manually entered)
- Real-time health check execution (scheduled checks only)
- Notification alerts for version changes (tracking only)
- Multiple version endpoints per service (one endpoint per service)
- Migration of existing server monitoring to service model
- Frontend E2E tests (backend unit tests only)

## Implementation Approach

**Database-First Strategy**: Start with schema migrations to establish data models, then build backend logic, API endpoints, and finally frontend UI.

**Background Workers**: Use Python's asyncio for background workers that execute health checks and version detection independently of API requests.

**Email Integration**: Implement minimal Resend integration with simple HTML templates for invitation emails.

**Pattern Consistency**: Follow existing patterns for:
- Multi-tenancy (team_id foreign keys on all entities)
- RBAC (admin/owner requirements for configuration)
- Alert integration (reuse alert evaluation patterns)
- Time-series storage (following metrics table pattern)

---

## Phase 1: Team Invitation System

### Overview
Implement email-based team invitations with token authentication, 48-hour expiry, and role assignment. This phase is independent and can be completed without affecting other features.

### Changes Required

#### 1.1 Database Migration - Invitations Table

**File**: `backend/alembic/versions/{new}_add_invitations_table.py`

**Changes**: Create new migration with invitations table

```python
def upgrade() -> None:
    op.create_table('invitations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('invited_by', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),  # pending, accepted, revoked, expired
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invitations_id'), 'invitations', ['id'], unique=False)
    op.create_index(op.f('ix_invitations_team_id'), 'invitations', ['team_id'], unique=False)
    op.create_index(op.f('ix_invitations_token'), 'invitations', ['token'], unique=True)
    op.create_index(op.f('ix_invitations_email'), 'invitations', ['email'], unique=False)
    op.create_index(op.f('ix_invitations_status'), 'invitations', ['status'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_invitations_status'), table_name='invitations')
    op.drop_index(op.f('ix_invitations_email'), table_name='invitations')
    op.drop_index(op.f('ix_invitations_token'), table_name='invitations')
    op.create_index(op.f('ix_invitations_team_id'), 'invitations', ['team_id'], unique=False)
    op.drop_index(op.f('ix_invitations_id'), table_name='invitations')
    op.drop_table('invitations')
```

**Key design decisions**:
- `token` is unique and indexed for fast lookup
- `status` is indexed for filtering active invitations
- `expires_at` enables automatic expiry (48 hours from creation)
- `invited_by` tracks audit trail
- Follows existing enum-like VARCHAR pattern (status: pending/accepted/revoked/expired)

#### 1.2 Database Model

**File**: `backend/app/models/invitation.py` (new file)

**Changes**: Create Invitation model

```python
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
```

**File**: `backend/app/models/team.py`

**Changes**: Add invitations relationship to Team model (after line 31)

```python
invitations: Mapped[List["Invitation"]] = relationship(
    "Invitation", back_populates="team", cascade="all, delete-orphan"
)
```

#### 1.3 Pydantic Schemas

**File**: `backend/app/schemas/invitation.py` (new file)

**Changes**: Create schemas for invitation operations

```python
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
```

#### 1.4 Email Service Implementation

**File**: `backend/app/services/email_service.py` (new file)

**Changes**: Create email service using Resend API

```python
import resend
from app.core.config import settings


class EmailService:
    def __init__(self):
        resend.api_key = settings.RESEND_API_KEY

    def send_invitation_email(
        self,
        to_email: str,
        team_name: str,
        inviter_name: str,
        invitation_token: str,
    ) -> None:
        """Send team invitation email"""

        # Construct invitation URL (frontend base URL + token)
        invitation_url = f"{settings.FRONTEND_URL}/invitations/accept?token={invitation_token}"

        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">You've been invited to join {team_name}</h2>
                    <p>{inviter_name} has invited you to join their team on Monitorillo.</p>
                    <p style="margin: 30px 0;">
                        <a href="{invitation_url}"
                           style="background-color: #2563eb; color: white; padding: 12px 24px;
                                  text-decoration: none; border-radius: 6px; display: inline-block;">
                            Accept Invitation
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        This invitation will expire in 48 hours.
                    </p>
                    <p style="color: #666; font-size: 12px; margin-top: 40px;">
                        If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                </div>
            </body>
        </html>
        """

        params = {
            "from": settings.ALERT_EMAIL_FROM,
            "to": [to_email],
            "subject": f"Invitation to join {team_name} on Monitorillo",
            "html": html_content,
        }

        try:
            resend.Emails.send(params)
        except Exception as e:
            # Log error but don't fail the invitation creation
            print(f"Failed to send invitation email: {e}")
```

**File**: `backend/app/core/config.py`

**Changes**: Add FRONTEND_URL setting (after line 28)

```python
FRONTEND_URL: str = "http://localhost:5173"  # Default for development
```

**File**: `.env.example`

**Changes**: Add FRONTEND_URL to environment template (after line 24)

```bash
FRONTEND_URL=http://localhost:5173
```

#### 1.5 Invitations API Endpoints

**File**: `backend/app/api/invitations.py` (new file)

**Changes**: Create invitation CRUD endpoints

```python
import secrets
from datetime import datetime, timedelta
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.rbac import TeamRole, require_team_admin
from app.core.users import current_active_user
from app.models.invitation import Invitation
from app.models.team import Team, TeamMember
from app.models.user import User
from app.schemas.invitation import InvitationAccept, InvitationCreate, InvitationRead
from app.services.email_service import EmailService

router = APIRouter()


@router.post("/teams/{team_id}/invitations", response_model=InvitationRead, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    team_id: int,
    invitation_data: InvitationCreate,
    user: Annotated[User, Depends(require_team_admin)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Create a new team invitation (requires admin role)"""

    # Validate role
    try:
        TeamRole(invitation_data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {invitation_data.role}"
        )

    # Get team for email
    result = await session.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Check if user is already a member
    result = await session.execute(
        select(TeamMember).where(
            and_(
                TeamMember.team_id == team_id,
                TeamMember.user_id.in_(
                    select(User.id).where(User.email == invitation_data.email)
                )
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this team"
        )

    # Check for existing pending invitation
    result = await session.execute(
        select(Invitation).where(
            and_(
                Invitation.team_id == team_id,
                Invitation.email == invitation_data.email,
                Invitation.status == "pending",
                Invitation.expires_at > datetime.utcnow()
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active invitation already exists for this email"
        )

    # Create invitation
    invitation = Invitation(
        team_id=team_id,
        email=invitation_data.email,
        role=invitation_data.role,
        token=secrets.token_urlsafe(32),
        invited_by=user.id,
        status="pending",
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=48),
    )
    session.add(invitation)
    await session.commit()
    await session.refresh(invitation)

    # Send invitation email
    email_service = EmailService()
    email_service.send_invitation_email(
        to_email=invitation_data.email,
        team_name=team.name,
        inviter_name=user.email,
        invitation_token=invitation.token,
    )

    return invitation


@router.get("/teams/{team_id}/invitations", response_model=List[InvitationRead])
async def list_invitations(
    team_id: int,
    user: Annotated[User, Depends(require_team_admin)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List all invitations for a team (requires admin role)"""

    result = await session.execute(
        select(Invitation)
        .where(Invitation.team_id == team_id)
        .order_by(Invitation.created_at.desc())
    )
    invitations = result.scalars().all()
    return invitations


@router.post("/invitations/accept", status_code=status.HTTP_201_CREATED)
async def accept_invitation(
    accept_data: InvitationAccept,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Accept a team invitation"""

    # Find invitation by token
    result = await session.execute(
        select(Invitation).where(Invitation.token == accept_data.token)
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    # Validate invitation status
    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation is {invitation.status}"
        )

    # Check expiry
    if invitation.expires_at < datetime.utcnow():
        invitation.status = "expired"
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )

    # Verify email matches (if user exists, email must match)
    if user.email != invitation.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is for a different email address"
        )

    # Check if already a member
    result = await session.execute(
        select(TeamMember).where(
            and_(
                TeamMember.team_id == invitation.team_id,
                TeamMember.user_id == user.id
            )
        )
    )
    if result.scalar_one_or_none():
        invitation.status = "accepted"
        invitation.accepted_at = datetime.utcnow()
        await session.commit()
        return {"message": "You are already a member of this team"}

    # Create team membership
    membership = TeamMember(
        user_id=user.id,
        team_id=invitation.team_id,
        role=invitation.role,
    )
    session.add(membership)

    # Update invitation status
    invitation.status = "accepted"
    invitation.accepted_at = datetime.utcnow()

    await session.commit()

    return {"message": "Invitation accepted successfully"}


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Revoke a pending invitation (requires admin role for the team)"""

    # Get invitation
    result = await session.execute(
        select(Invitation).where(Invitation.id == invitation_id)
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found"
        )

    # Check admin access to team
    from app.core.rbac import get_user_team_role
    user_role = await get_user_team_role(invitation.team_id, user, session)

    if not user_role or user_role not in [TeamRole.ADMIN, TeamRole.OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin role to revoke invitations"
        )

    # Only revoke pending invitations
    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending invitations can be revoked"
        )

    invitation.status = "revoked"
    await session.commit()
```

**File**: `backend/app/main.py`

**Changes**: Register invitations router (after line 73)

```python
from app.api import invitations

app.include_router(
    invitations.router,
    prefix="/api/v1",
    tags=["invitations"],
)
```

#### 1.6 Frontend API Client

**File**: `frontend/src/lib/api.ts`

**Changes**: Add invitations API methods (after teams methods around line 91)

```typescript
export const invitationsApi = {
  create: async (teamId: number, email: string, role: string) => {
    const response = await api.post(`/api/v1/teams/${teamId}/invitations`, {
      email,
      role,
    });
    return response.data;
  },

  list: async (teamId: number) => {
    const response = await api.get(`/api/v1/teams/${teamId}/invitations`);
    return response.data;
  },

  accept: async (token: string) => {
    const response = await api.post('/api/v1/invitations/accept', {
      token,
    });
    return response.data;
  },

  revoke: async (invitationId: number) => {
    await api.delete(`/api/v1/invitations/${invitationId}`);
  },
};
```

#### 1.7 Frontend Types

**File**: `frontend/src/types/index.ts`

**Changes**: Add Invitation type (after TeamMember type around line 24)

```typescript
export interface Invitation {
  id: number;
  team_id: number;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  invited_by: number;
}
```

#### 1.8 Frontend - Team Invitations Component

**File**: `frontend/src/components/TeamInvitations.tsx` (new file)

**Changes**: Create invitation management component

```typescript
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invitationsApi } from '../lib/api';
import { Invitation } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

interface TeamInvitationsProps {
  teamId: number;
}

export const TeamInvitations: React.FC<TeamInvitationsProps> = ({ teamId }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: invitations, isLoading } = useQuery({
    queryKey: ['invitations', teamId],
    queryFn: () => invitationsApi.list(teamId),
  });

  const createMutation = useMutation({
    mutationFn: () => invitationsApi.create(teamId, email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', teamId] });
      setEmail('');
      setRole('member');
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create invitation');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: number) => invitationsApi.revoke(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', teamId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    createMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'destructive'> = {
      pending: 'default',
      accepted: 'success',
      revoked: 'destructive',
      expired: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
          <CardDescription>Send an invitation to join this team</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading...</div>
          ) : invitations && invitations.length > 0 ? (
            <div className="space-y-2">
              {invitations.map((invitation: Invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex-1">
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-gray-600">
                      Role: {invitation.role} • Created:{' '}
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(invitation.status)}
                    {invitation.status === 'pending' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeMutation.mutate(invitation.id)}
                        disabled={revokeMutation.isPending}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
              No invitations yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

#### 1.9 Frontend - Accept Invitation Page

**File**: `frontend/src/pages/AcceptInvitation.tsx` (new file)

**Changes**: Create page for accepting invitations via token

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { invitationsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';

export const AcceptInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = searchParams.get('token');

  const acceptMutation = useMutation({
    mutationFn: (token: string) => invitationsApi.accept(token),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        navigate('/teams');
      }, 2000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to accept invitation');
    },
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
    }
  }, [token]);

  const handleAccept = () => {
    if (token) {
      acceptMutation.mutate(token);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Team Invitation</CardTitle>
          <CardDescription>
            You've been invited to join a team on Monitorillo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>
                Invitation accepted! Redirecting to teams...
              </AlertDescription>
            </Alert>
          )}

          {!error && !success && (
            <>
              <p className="text-sm text-gray-600">
                Click the button below to accept this invitation and join the team.
              </p>
              <Button
                onClick={handleAccept}
                disabled={acceptMutation.isPending || !token}
                className="w-full"
              >
                {acceptMutation.isPending ? 'Accepting...' : 'Accept Invitation'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

#### 1.10 Frontend Routing

**File**: `frontend/src/App.tsx`

**Changes**: Add route for invitation acceptance (add to routes)

```typescript
import { AcceptInvitation } from './pages/AcceptInvitation';

// Add to routes:
<Route path="/invitations/accept" element={<AcceptInvitation />} />
```

**File**: `frontend/src/pages/Teams.tsx`

**Changes**: Import and render TeamInvitations component for selected team (after team selection logic around line 120)

```typescript
import { TeamInvitations } from '../components/TeamInvitations';

// Add after team cards grid:
{currentTeam && (
  <div className="mt-8">
    <TeamInvitations teamId={currentTeam.id} />
  </div>
)}
```

### Success Criteria

#### Automated Verification:
- [x] Database migration runs successfully: `cd backend && alembic upgrade head`
- [ ] Backend tests pass: `cd backend && pytest tests/test_invitations.py` (to be created)
- [ ] No linting errors: `cd backend && ruff check app/`
- [ ] Frontend builds without errors: `cd frontend && npm run build`
- [ ] TypeScript type checking passes: `cd frontend && npm run typecheck`

#### Manual Verification:
- [ ] Create invitation as team admin → invitation appears in pending list
- [ ] Invitation email received with correct team name and link
- [ ] Click invitation link → redirects to accept page with token
- [ ] Accept invitation → team membership created, redirected to teams page
- [ ] Invitation status changes from "pending" to "accepted"
- [ ] Cannot accept expired invitation (test with modified expires_at)
- [ ] Cannot create duplicate invitation for same email
- [ ] Revoke invitation → status changes to "revoked", cannot be accepted
- [ ] Non-admin users cannot create/revoke invitations (403 error)
- [ ] Deleting team cascades to invitations

---

## Phase 2: Services Foundation & Health Check System

### Overview
Introduce "services" as a core concept distinct from "servers", implement HTTP health check configuration and execution, integrate with existing alert system. Services represent deployed applications, while servers represent infrastructure.

### Changes Required

#### 2.1 Database Migration - Services and Health Checks Tables

**File**: `backend/alembic/versions/{new}_add_services_and_health_checks.py`

**Changes**: Create services, health_checks, and health_check_results tables

```python
def upgrade() -> None:
    # Services table
    op.create_table('services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),  # healthy, degraded, unhealthy, unknown
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_services_id'), 'services', ['id'], unique=False)
    op.create_index(op.f('ix_services_team_id'), 'services', ['team_id'], unique=False)
    op.create_index(op.f('ix_services_status'), 'services', ['status'], unique=False)

    # Health checks table
    op.create_table('health_checks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('url', sa.String(length=1024), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False),  # GET, POST, PUT, DELETE
        sa.Column('headers', sa.JSON(), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('expected_status_code', sa.Integer(), nullable=False),
        sa.Column('timeout_seconds', sa.Integer(), nullable=False),
        sa.Column('check_interval_minutes', sa.Integer(), nullable=False),  # Fixed interval for simplicity
        sa.Column('json_path', sa.String(length=255), nullable=True),  # JSONPath expression
        sa.Column('expected_value', sa.String(length=255), nullable=True),  # Expected value at json_path
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_health_checks_id'), 'health_checks', ['id'], unique=False)
    op.create_index(op.f('ix_health_checks_service_id'), 'health_checks', ['service_id'], unique=False)
    op.create_index(op.f('ix_health_checks_enabled'), 'health_checks', ['enabled'], unique=False)

    # Health check results table (time-series)
    op.create_table('health_check_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('health_check_id', sa.Integer(), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('checked_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['health_check_id'], ['health_checks.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_health_check_results_id'), 'health_check_results', ['id'], unique=False)
    op.create_index(op.f('ix_health_check_results_health_check_id'), 'health_check_results', ['health_check_id'], unique=False)
    op.create_index(op.f('ix_health_check_results_checked_at'), 'health_check_results', ['checked_at'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_health_check_results_checked_at'), table_name='health_check_results')
    op.drop_index(op.f('ix_health_check_results_health_check_id'), table_name='health_check_results')
    op.drop_index(op.f('ix_health_check_results_id'), table_name='health_check_results')
    op.drop_table('health_check_results')

    op.drop_index(op.f('ix_health_checks_enabled'), table_name='health_checks')
    op.drop_index(op.f('ix_health_checks_service_id'), table_name='health_checks')
    op.drop_index(op.f('ix_health_checks_id'), table_name='health_checks')
    op.drop_table('health_checks')

    op.drop_index(op.f('ix_services_status'), table_name='services')
    op.drop_index(op.f('ix_services_team_id'), table_name='services')
    op.drop_index(op.f('ix_services_id'), table_name='services')
    op.drop_table('services')
```

#### 2.2 Database Models

**File**: `backend/app/models/service.py` (new file)

**Changes**: Create Service, HealthCheck, and HealthCheckResult models

```python
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="services")
    health_checks: Mapped[List["HealthCheck"]] = relationship(
        "HealthCheck", back_populates="service", cascade="all, delete-orphan"
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
    check_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    json_path: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    expected_value: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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
```

**File**: `backend/app/models/team.py`

**Changes**: Add services relationship (after invitations relationship)

```python
services: Mapped[List["Service"]] = relationship(
    "Service", back_populates="team", cascade="all, delete-orphan"
)
```

#### 2.3 Pydantic Schemas

**File**: `backend/app/schemas/service.py` (new file)

**Changes**: Create schemas for services and health checks

```python
from datetime import datetime
from pydantic import BaseModel
from typing import Optional


# Service schemas
class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ServiceRead(ServiceBase):
    id: int
    team_id: int
    status: str
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
```

#### 2.4 Health Check Executor Service

**File**: `backend/app/services/health_checker.py` (new file)

**Changes**: Create HTTP health check executor with JSON path validation

```python
import asyncio
import json
from datetime import datetime
from typing import Dict, Any

import httpx
from jsonpath_ng import parse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import HealthCheck, HealthCheckResult, Service


class HealthCheckExecutor:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute_check(self, health_check: HealthCheck) -> Dict[str, Any]:
        """Execute a single health check and return result"""

        start_time = datetime.utcnow()
        result = {
            "success": False,
            "status_code": None,
            "response_time_ms": None,
            "error_message": None,
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=health_check.method,
                    url=health_check.url,
                    headers=health_check.headers or {},
                    content=health_check.body,
                    timeout=health_check.timeout_seconds,
                )

                end_time = datetime.utcnow()
                response_time_ms = int((end_time - start_time).total_seconds() * 1000)

                result["status_code"] = response.status_code
                result["response_time_ms"] = response_time_ms

                # Check status code
                if response.status_code != health_check.expected_status_code:
                    result["error_message"] = (
                        f"Expected status {health_check.expected_status_code}, "
                        f"got {response.status_code}"
                    )
                    return result

                # Check JSON path if configured
                if health_check.json_path and health_check.expected_value:
                    try:
                        response_json = response.json()
                        jsonpath_expr = parse(health_check.json_path)
                        matches = jsonpath_expr.find(response_json)

                        if not matches:
                            result["error_message"] = f"JSON path '{health_check.json_path}' not found"
                            return result

                        actual_value = str(matches[0].value)
                        if actual_value != health_check.expected_value:
                            result["error_message"] = (
                                f"Expected '{health_check.expected_value}' at '{health_check.json_path}', "
                                f"got '{actual_value}'"
                            )
                            return result
                    except json.JSONDecodeError:
                        result["error_message"] = "Response is not valid JSON"
                        return result
                    except Exception as e:
                        result["error_message"] = f"JSON path validation failed: {str(e)}"
                        return result

                # All checks passed
                result["success"] = True

        except httpx.TimeoutException:
            result["error_message"] = f"Request timed out after {health_check.timeout_seconds}s"
        except httpx.RequestError as e:
            result["error_message"] = f"Request failed: {str(e)}"
        except Exception as e:
            result["error_message"] = f"Unexpected error: {str(e)}"

        return result

    async def execute_and_store(self, health_check: HealthCheck) -> HealthCheckResult:
        """Execute check and store result in database"""

        result_data = await self.execute_check(health_check)

        # Create result record
        result = HealthCheckResult(
            health_check_id=health_check.id,
            success=result_data["success"],
            status_code=result_data["status_code"],
            response_time_ms=result_data["response_time_ms"],
            error_message=result_data["error_message"],
            checked_at=datetime.utcnow(),
        )
        self.session.add(result)

        # Update service status based on health check results
        await self._update_service_status(health_check.service_id)

        await self.session.commit()
        await self.session.refresh(result)

        return result

    async def _update_service_status(self, service_id: int) -> None:
        """Update service status based on recent health check results"""

        # Get service
        result = await self.session.execute(
            select(Service).where(Service.id == service_id)
        )
        service = result.scalar_one_or_none()
        if not service:
            return

        # Get all health checks for this service
        result = await self.session.execute(
            select(HealthCheck).where(
                HealthCheck.service_id == service_id,
                HealthCheck.enabled == True
            )
        )
        health_checks = result.scalars().all()

        if not health_checks:
            service.status = "unknown"
            return

        # Check latest result for each health check
        failed_checks = 0
        total_checks = len(health_checks)

        for check in health_checks:
            result = await self.session.execute(
                select(HealthCheckResult)
                .where(HealthCheckResult.health_check_id == check.id)
                .order_by(HealthCheckResult.checked_at.desc())
                .limit(1)
            )
            latest_result = result.scalar_one_or_none()

            if not latest_result or not latest_result.success:
                failed_checks += 1

        # Determine service status
        if failed_checks == 0:
            service.status = "healthy"
        elif failed_checks == total_checks:
            service.status = "unhealthy"
        else:
            service.status = "degraded"

        service.updated_at = datetime.utcnow()

    async def execute_all_enabled_checks(self) -> None:
        """Execute all enabled health checks (called by background worker)"""

        # Get all enabled health checks
        result = await self.session.execute(
            select(HealthCheck).where(HealthCheck.enabled == True)
        )
        health_checks = result.scalars().all()

        # Execute checks concurrently
        tasks = [self.execute_and_store(check) for check in health_checks]
        await asyncio.gather(*tasks, return_exceptions=True)
```

**File**: `requirements.txt`

**Changes**: Add jsonpath-ng for JSON path parsing (after line 15)

```
jsonpath-ng==1.6.1
```

#### 2.5 Background Worker for Health Checks

**File**: `backend/app/worker.py` (new file)

**Changes**: Create background worker that runs health checks periodically

```python
import asyncio
from datetime import datetime

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.services.health_checker import HealthCheckExecutor


async def health_check_worker():
    """Background worker that executes health checks every minute"""

    # Create async engine and session maker
    engine = create_async_engine(
        settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
        echo=False,
    )
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    print("Health check worker started")

    while True:
        try:
            async with async_session() as session:
                executor = HealthCheckExecutor(session)
                await executor.execute_all_enabled_checks()
                print(f"[{datetime.utcnow().isoformat()}] Executed health checks")
        except Exception as e:
            print(f"Error in health check worker: {e}")

        # Wait 1 minute before next execution
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(health_check_worker())
```

#### 2.6 Services API Endpoints

**File**: `backend/app/api/services.py` (new file)

**Changes**: Create service CRUD endpoints

```python
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.rbac import require_team_member, require_team_admin
from app.core.users import current_active_user
from app.models.service import Service
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter()


@router.post("/teams/{team_id}/services", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
async def create_service(
    team_id: int,
    service_data: ServiceCreate,
    user: Annotated[User, Depends(require_team_admin)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Create a new service (requires admin role)"""

    service = Service(
        team_id=team_id,
        name=service_data.name,
        description=service_data.description,
        status="unknown",
    )
    session.add(service)
    await session.commit()
    await session.refresh(service)

    return service


@router.get("/teams/{team_id}/services", response_model=List[ServiceRead])
async def list_services(
    team_id: int,
    user: Annotated[User, Depends(require_team_member)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List all services for a team"""

    result = await session.execute(
        select(Service)
        .where(Service.team_id == team_id)
        .order_by(Service.name)
    )
    services = result.scalars().all()
    return services


@router.get("/services/{service_id}", response_model=ServiceRead)
async def get_service(
    service_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Get service details"""

    result = await session.execute(
        select(Service).where(Service.id == service_id)
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    # Check team membership
    from app.core.rbac import get_user_team_role
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )

    return service


@router.patch("/services/{service_id}", response_model=ServiceRead)
async def update_service(
    service_id: int,
    service_data: ServiceUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update service (requires admin role)"""

    result = await session.execute(
        select(Service).where(Service.id == service_id)
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    # Check admin access
    from app.core.rbac import get_user_team_role, TeamRole, ROLE_HIERARCHY
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role or ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[TeamRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin role to update services"
        )

    # Update fields
    if service_data.name is not None:
        service.name = service_data.name
    if service_data.description is not None:
        service.description = service_data.description

    await session.commit()
    await session.refresh(service)

    return service


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Delete service (requires admin role)"""

    result = await session.execute(
        select(Service).where(Service.id == service_id)
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    # Check admin access
    from app.core.rbac import get_user_team_role, TeamRole, ROLE_HIERARCHY
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role or ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[TeamRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin role to delete services"
        )

    await session.delete(service)
    await session.commit()
```

#### 2.7 Health Checks API Endpoints

**File**: `backend/app/api/health_checks.py` (new file)

**Changes**: Create health check CRUD and execution endpoints

```python
from datetime import datetime, timedelta
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.rbac import require_team_admin
from app.core.users import current_active_user
from app.models.service import HealthCheck, HealthCheckResult, Service
from app.models.user import User
from app.schemas.service import (
    HealthCheckCreate,
    HealthCheckRead,
    HealthCheckResultRead,
    HealthCheckUpdate,
)
from app.services.health_checker import HealthCheckExecutor

router = APIRouter()


@router.post("/services/{service_id}/health-checks", response_model=HealthCheckRead, status_code=status.HTTP_201_CREATED)
async def create_health_check(
    service_id: int,
    check_data: HealthCheckCreate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Create a health check for a service (requires admin role)"""

    # Get service and verify access
    result = await session.execute(
        select(Service).where(Service.id == service_id)
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    # Check admin access
    from app.core.rbac import get_user_team_role, TeamRole, ROLE_HIERARCHY
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role or ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[TeamRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin role to create health checks"
        )

    # Create health check
    health_check = HealthCheck(
        service_id=service_id,
        name=check_data.name,
        url=check_data.url,
        method=check_data.method,
        headers=check_data.headers,
        body=check_data.body,
        expected_status_code=check_data.expected_status_code,
        timeout_seconds=check_data.timeout_seconds,
        check_interval_minutes=check_data.check_interval_minutes,
        json_path=check_data.json_path,
        expected_value=check_data.expected_value,
        enabled=check_data.enabled,
    )
    session.add(health_check)
    await session.commit()
    await session.refresh(health_check)

    return health_check


@router.get("/services/{service_id}/health-checks", response_model=List[HealthCheckRead])
async def list_health_checks(
    service_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List health checks for a service"""

    # Get service and verify access
    result = await session.execute(
        select(Service).where(Service.id == service_id)
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    # Check team membership
    from app.core.rbac import get_user_team_role
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )

    # Get health checks
    result = await session.execute(
        select(HealthCheck)
        .where(HealthCheck.service_id == service_id)
        .order_by(HealthCheck.name)
    )
    health_checks = result.scalars().all()
    return health_checks


@router.patch("/health-checks/{check_id}", response_model=HealthCheckRead)
async def update_health_check(
    check_id: int,
    check_data: HealthCheckUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update health check (requires admin role)"""

    result = await session.execute(
        select(HealthCheck).where(HealthCheck.id == check_id)
    )
    health_check = result.scalar_one_or_none()

    if not health_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health check not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == health_check.service_id)
    )
    service = result.scalar_one()

    # Check admin access
    from app.core.rbac import get_user_team_role, TeamRole, ROLE_HIERARCHY
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role or ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[TeamRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin role to update health checks"
        )

    # Update fields
    update_data = check_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(health_check, field, value)

    health_check.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(health_check)

    return health_check


@router.delete("/health-checks/{check_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_health_check(
    check_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Delete health check (requires admin role)"""

    result = await session.execute(
        select(HealthCheck).where(HealthCheck.id == check_id)
    )
    health_check = result.scalar_one_or_none()

    if not health_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health check not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == health_check.service_id)
    )
    service = result.scalar_one()

    # Check admin access
    from app.core.rbac import get_user_team_role, TeamRole, ROLE_HIERARCHY
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role or ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[TeamRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin role to delete health checks"
        )

    await session.delete(health_check)
    await session.commit()


@router.post("/health-checks/{check_id}/execute", response_model=HealthCheckResultRead)
async def execute_health_check_now(
    check_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Execute a health check immediately (manual trigger)"""

    result = await session.execute(
        select(HealthCheck).where(HealthCheck.id == check_id)
    )
    health_check = result.scalar_one_or_none()

    if not health_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health check not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == health_check.service_id)
    )
    service = result.scalar_one()

    # Check team membership
    from app.core.rbac import get_user_team_role
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )

    # Execute check
    executor = HealthCheckExecutor(session)
    result = await executor.execute_and_store(health_check)

    return result


@router.get("/health-checks/{check_id}/results", response_model=List[HealthCheckResultRead])
async def get_health_check_results(
    check_id: int,
    hours: int = 24,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Get health check results history"""

    result = await session.execute(
        select(HealthCheck).where(HealthCheck.id == check_id)
    )
    health_check = result.scalar_one_or_none()

    if not health_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Health check not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == health_check.service_id)
    )
    service = result.scalar_one()

    # Check team membership
    from app.core.rbac import get_user_team_role
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )

    # Get results
    since = datetime.utcnow() - timedelta(hours=hours)
    result = await session.execute(
        select(HealthCheckResult)
        .where(
            HealthCheckResult.health_check_id == check_id,
            HealthCheckResult.checked_at >= since
        )
        .order_by(desc(HealthCheckResult.checked_at))
    )
    results = result.scalars().all()
    return results
```

**File**: `backend/app/main.py`

**Changes**: Register services and health_checks routers (after invitations router)

```python
from app.api import services, health_checks

app.include_router(
    services.router,
    prefix="/api/v1",
    tags=["services"],
)

app.include_router(
    health_checks.router,
    prefix="/api/v1",
    tags=["health-checks"],
)
```

#### 2.8 Docker Compose Worker Service

**File**: `docker-compose.yml`

**Changes**: Add worker service for background health checks (after backend service)

```yaml
  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: python -m app.worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - db
    restart: unless-stopped
```

### Success Criteria

#### Automated Verification:
- [x] Database migration runs successfully: `cd backend && alembic upgrade head`
- [ ] Worker starts without errors: `cd backend && python -m app.worker`
- [ ] Backend tests pass: `cd backend && pytest tests/test_services.py tests/test_health_checks.py`
- [ ] No linting errors: `cd backend && ruff check app/`
- [ ] Health check can be executed: `curl -X POST http://localhost:8000/api/v1/health-checks/1/execute`

#### Manual Verification:
- [ ] Create service via API → service appears in list with "unknown" status
- [ ] Create health check for service → check appears in list
- [ ] Execute health check manually → result recorded with success/failure
- [ ] Health check succeeds → service status becomes "healthy"
- [ ] Health check fails → service status becomes "unhealthy"
- [ ] Multiple checks, some fail → service status becomes "degraded"
- [ ] Worker executes checks every minute → new results appear automatically
- [ ] JSON path validation works → fails when expected value doesn't match
- [ ] Timeout works → check fails after configured timeout
- [ ] Disable health check → worker skips it
- [ ] Delete service → cascades to health checks and results
- [ ] Non-admin users cannot create/update/delete health checks (403 error)

---

## Phase 3: Service Version Tracking & Deployments

### Overview
Add version detection and deployment history tracking. System periodically queries configured endpoints, extracts version from JSON response, and creates deployment records when version changes.

### Changes Required

#### 3.1 Database Migration - Deployments Table

**File**: `backend/alembic/versions/{new}_add_deployments_table.py`

**Changes**: Create deployments table and add version tracking to services

```python
def upgrade() -> None:
    # Add version tracking fields to services table
    op.add_column('services', sa.Column('version_url', sa.String(length=1024), nullable=True))
    op.add_column('services', sa.Column('version_json_path', sa.String(length=255), nullable=True))
    op.add_column('services', sa.Column('current_version', sa.String(length=255), nullable=True))
    op.add_column('services', sa.Column('last_version_check', sa.DateTime(), nullable=True))

    # Create deployments table
    op.create_table('deployments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.String(length=255), nullable=False),
        sa.Column('detected_at', sa.DateTime(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['service_id'], ['services.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deployments_id'), 'deployments', ['id'], unique=False)
    op.create_index(op.f('ix_deployments_service_id'), 'deployments', ['service_id'], unique=False)
    op.create_index(op.f('ix_deployments_detected_at'), 'deployments', ['detected_at'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_deployments_detected_at'), table_name='deployments')
    op.drop_index(op.f('ix_deployments_service_id'), table_name='deployments')
    op.drop_index(op.f('ix_deployments_id'), table_name='deployments')
    op.drop_table('deployments')

    op.drop_column('services', 'last_version_check')
    op.drop_column('services', 'current_version')
    op.drop_column('services', 'version_json_path')
    op.drop_column('services', 'version_url')
```

#### 3.2 Database Models

**File**: `backend/app/models/service.py`

**Changes**: Add version tracking fields to Service model and create Deployment model

```python
# Add to Service class (after status field around line 21):
version_url: Mapped[str | None] = mapped_column(String(length=1024), nullable=True)
version_json_path: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
current_version: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
last_version_check: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

# Add to Service relationships (after health_checks):
deployments: Mapped[List["Deployment"]] = relationship(
    "Deployment", back_populates="service", cascade="all, delete-orphan"
)

# Add new Deployment model at end of file:
class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(length=255), nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    service: Mapped["Service"] = relationship("Service", back_populates="deployments")
```

#### 3.3 Pydantic Schemas

**File**: `backend/app/schemas/service.py`

**Changes**: Add deployment schemas and update service schemas

```python
# Add to ServiceBase (after description):
version_url: Optional[str] = None
version_json_path: Optional[str] = None

# Add to ServiceRead (after updated_at):
current_version: Optional[str] = None
last_version_check: Optional[datetime] = None

# Add to ServiceUpdate (at end):
version_url: Optional[str] = None
version_json_path: Optional[str] = None

# Add new deployment schemas at end of file:
class DeploymentRead(BaseModel):
    id: int
    service_id: int
    version: str
    detected_at: datetime
    notes: Optional[str]

    model_config = {"from_attributes": True}


class DeploymentUpdate(BaseModel):
    notes: Optional[str] = None
```

#### 3.4 Version Checker Service

**File**: `backend/app/services/version_checker.py` (new file)

**Changes**: Create version detection service

```python
import httpx
from datetime import datetime
from jsonpath_ng import parse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Deployment, Service


class VersionChecker:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def check_version(self, service: Service) -> str | None:
        """Query version endpoint and extract version from JSON response"""

        if not service.version_url or not service.version_json_path:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(service.version_url, timeout=30)

                if response.status_code != 200:
                    print(f"Service {service.id}: Version endpoint returned {response.status_code}")
                    return None

                response_json = response.json()
                jsonpath_expr = parse(service.version_json_path)
                matches = jsonpath_expr.find(response_json)

                if not matches:
                    print(f"Service {service.id}: JSON path '{service.version_json_path}' not found")
                    return None

                version = str(matches[0].value)
                return version

        except httpx.RequestError as e:
            print(f"Service {service.id}: Request failed: {e}")
            return None
        except Exception as e:
            print(f"Service {service.id}: Version check failed: {e}")
            return None

    async def check_and_record(self, service: Service) -> Deployment | None:
        """Check version and create deployment record if version changed"""

        version = await self.check_version(service)

        # Update last check time
        service.last_version_check = datetime.utcnow()

        if not version:
            return None

        # Check if version changed
        if service.current_version == version:
            # No change, just update timestamp
            await self.session.commit()
            return None

        # Version changed - create deployment record
        deployment = Deployment(
            service_id=service.id,
            version=version,
            detected_at=datetime.utcnow(),
        )
        self.session.add(deployment)

        # Update service's current version
        service.current_version = version

        await self.session.commit()
        await self.session.refresh(deployment)

        print(f"Service {service.id}: New deployment detected - version {version}")

        return deployment

    async def check_all_services(self) -> None:
        """Check versions for all services with version tracking configured"""

        result = await self.session.execute(
            select(Service).where(
                Service.version_url.isnot(None),
                Service.version_json_path.isnot(None)
            )
        )
        services = result.scalars().all()

        for service in services:
            try:
                await self.check_and_record(service)
            except Exception as e:
                print(f"Error checking version for service {service.id}: {e}")
```

#### 3.5 Update Background Worker

**File**: `backend/app/worker.py`

**Changes**: Add version checking to background worker

```python
# Add import at top:
from app.services.version_checker import VersionChecker

# Update health_check_worker function to also check versions:
async def health_check_worker():
    """Background worker that executes health checks and version checks every minute"""

    # ... existing code ...

    while True:
        try:
            async with async_session() as session:
                # Execute health checks
                executor = HealthCheckExecutor(session)
                await executor.execute_all_enabled_checks()

                # Check versions
                version_checker = VersionChecker(session)
                await version_checker.check_all_services()

                print(f"[{datetime.utcnow().isoformat()}] Executed health checks and version checks")
        except Exception as e:
            print(f"Error in worker: {e}")

        # Wait 1 minute before next execution
        await asyncio.sleep(60)
```

#### 3.6 Deployments API Endpoints

**File**: `backend/app/api/deployments.py` (new file)

**Changes**: Create deployment history endpoints

```python
from datetime import datetime
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.users import current_active_user
from app.models.service import Deployment, Service
from app.models.user import User
from app.schemas.service import DeploymentRead, DeploymentUpdate

router = APIRouter()


@router.get("/services/{service_id}/deployments", response_model=List[DeploymentRead])
async def list_deployments(
    service_id: int,
    limit: int = Query(50, le=200),
    offset: int = 0,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Get deployment history for a service (paginated)"""

    # Get service and verify access
    result = await session.execute(
        select(Service).where(Service.id == service_id)
    )
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )

    # Check team membership
    from app.core.rbac import get_user_team_role
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )

    # Get deployments
    result = await session.execute(
        select(Deployment)
        .where(Deployment.service_id == service_id)
        .order_by(desc(Deployment.detected_at))
        .limit(limit)
        .offset(offset)
    )
    deployments = result.scalars().all()
    return deployments


@router.patch("/deployments/{deployment_id}", response_model=DeploymentRead)
async def update_deployment(
    deployment_id: int,
    deployment_data: DeploymentUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update deployment notes (e.g., add release notes or comments)"""

    result = await session.execute(
        select(Deployment).where(Deployment.id == deployment_id)
    )
    deployment = result.scalar_one_or_none()

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == deployment.service_id)
    )
    service = result.scalar_one()

    # Check team membership
    from app.core.rbac import get_user_team_role
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )

    # Update notes
    if deployment_data.notes is not None:
        deployment.notes = deployment_data.notes

    await session.commit()
    await session.refresh(deployment)

    return deployment
```

**File**: `backend/app/main.py`

**Changes**: Register deployments router (after health_checks router)

```python
from app.api import deployments

app.include_router(
    deployments.router,
    prefix="/api/v1",
    tags=["deployments"],
)
```

### Success Criteria

#### Automated Verification:
- [x] Database migration runs successfully: `cd backend && alembic upgrade head`
- [ ] Worker starts and runs version checks: `cd backend && python -m app.worker`
- [ ] Backend tests pass: `cd backend && pytest tests/test_deployments.py`
- [ ] No linting errors: `cd backend && ruff check app/`

#### Manual Verification:
- [ ] Update service with version_url and version_json_path → fields saved
- [ ] Worker detects version → current_version updated, deployment record created
- [ ] Change deployed version → new deployment record created automatically
- [ ] Rollback (version goes backward) → new deployment record created (not just forward changes)
- [ ] View deployment history → shows all versions in reverse chronological order
- [ ] Pagination works → limit and offset parameters work correctly
- [ ] Add notes to deployment → notes saved and displayed
- [ ] Delete service → cascades to deployments
- [ ] Non-team members cannot view deployments (403 error)

---

## Phase 4: Frontend Implementation

### Overview
Build frontend UI for all new features: Services page with health checks and deployments tabs, invitation management in Teams page, navigation updates.

### Changes Required

#### 4.1 Frontend Types

**File**: `frontend/src/types/index.ts`

**Changes**: Add Service, HealthCheck, and Deployment types (after Invitation type)

```typescript
export interface Service {
  id: number;
  team_id: number;
  name: string;
  description: string | null;
  status: string;
  version_url: string | null;
  version_json_path: string | null;
  current_version: string | null;
  last_version_check: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthCheck {
  id: number;
  service_id: number;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string> | null;
  body: string | null;
  expected_status_code: number;
  timeout_seconds: number;
  check_interval_minutes: number;
  json_path: string | null;
  expected_value: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResult {
  id: number;
  health_check_id: number;
  success: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  checked_at: string;
}

export interface Deployment {
  id: number;
  service_id: number;
  version: string;
  detected_at: string;
  notes: string | null;
}
```

#### 4.2 Frontend API Client

**File**: `frontend/src/lib/api.ts`

**Changes**: Add services, health checks, and deployments API methods (after invitations)

```typescript
export const servicesApi = {
  create: async (teamId: number, name: string, description: string) => {
    const response = await api.post(`/api/v1/teams/${teamId}/services`, {
      name,
      description,
    });
    return response.data;
  },

  list: async (teamId: number) => {
    const response = await api.get(`/api/v1/teams/${teamId}/services`);
    return response.data;
  },

  get: async (serviceId: number) => {
    const response = await api.get(`/api/v1/services/${serviceId}`);
    return response.data;
  },

  update: async (serviceId: number, data: any) => {
    const response = await api.patch(`/api/v1/services/${serviceId}`, data);
    return response.data;
  },

  delete: async (serviceId: number) => {
    await api.delete(`/api/v1/services/${serviceId}`);
  },
};

export const healthChecksApi = {
  create: async (serviceId: number, data: any) => {
    const response = await api.post(`/api/v1/services/${serviceId}/health-checks`, data);
    return response.data;
  },

  list: async (serviceId: number) => {
    const response = await api.get(`/api/v1/services/${serviceId}/health-checks`);
    return response.data;
  },

  update: async (checkId: number, data: any) => {
    const response = await api.patch(`/api/v1/health-checks/${checkId}`, data);
    return response.data;
  },

  delete: async (checkId: number) => {
    await api.delete(`/api/v1/health-checks/${checkId}`);
  },

  execute: async (checkId: number) => {
    const response = await api.post(`/api/v1/health-checks/${checkId}/execute`);
    return response.data;
  },

  getResults: async (checkId: number, hours: number = 24) => {
    const response = await api.get(`/api/v1/health-checks/${checkId}/results`, {
      params: { hours },
    });
    return response.data;
  },
};

export const deploymentsApi = {
  list: async (serviceId: number, limit: number = 50, offset: number = 0) => {
    const response = await api.get(`/api/v1/services/${serviceId}/deployments`, {
      params: { limit, offset },
    });
    return response.data;
  },

  update: async (deploymentId: number, notes: string) => {
    const response = await api.patch(`/api/v1/deployments/${deploymentId}`, {
      notes,
    });
    return response.data;
  },
};
```

#### 4.3 Services List Page

**File**: `frontend/src/pages/Services.tsx` (new file)

**Changes**: Create services listing page

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Service } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';

export const Services: React.FC = () => {
  const navigate = useNavigate();
  const { currentTeam } = useAppStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', currentTeam?.id],
    queryFn: () => servicesApi.list(currentTeam!.id),
    enabled: !!currentTeam,
  });

  const createMutation = useMutation({
    mutationFn: () => servicesApi.create(currentTeam!.id, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', currentTeam?.id] });
      setName('');
      setDescription('');
      setError('');
      setShowCreateForm(false);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create service');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Service name is required');
      return;
    }
    createMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'destructive'> = {
      healthy: 'success',
      degraded: 'default',
      unhealthy: 'destructive',
      unknown: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  if (!currentTeam) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Please select a team first</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-gray-600 mt-1">Monitor your deployed applications</p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : 'New Service'}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Service</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="My API"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Production API server"
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Service'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12">Loading services...</div>
      ) : services && services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service: Service) => (
            <Card
              key={service.id}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => navigate(`/services/${service.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{service.name}</CardTitle>
                  {getStatusBadge(service.status)}
                </div>
                {service.description && (
                  <CardDescription className="mt-2">{service.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {service.current_version && (
                  <div className="text-sm">
                    <span className="font-medium">Version:</span> {service.current_version}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">No services yet. Create your first service to start monitoring!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

#### 4.4 Service Detail Page (with tabs)

**File**: `frontend/src/pages/ServiceDetail.tsx` (new file)

**Changes**: Create service detail page with Health Checks and Deployments tabs

```typescript
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { servicesApi } from '../lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { HealthChecksTab } from '../components/HealthChecksTab';
import { DeploymentsTab } from '../components/DeploymentsTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export const ServiceDetail: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [activeTab, setActiveTab] = useState('health-checks');

  const { data: service, isLoading } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesApi.get(Number(serviceId)),
    enabled: !!serviceId,
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'destructive'> = {
      healthy: 'success',
      degraded: 'default',
      unhealthy: 'destructive',
      unknown: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!service) {
    return <div className="p-6">Service not found</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{service.name}</CardTitle>
              {service.description && (
                <CardDescription className="mt-2">{service.description}</CardDescription>
              )}
            </div>
            {getStatusBadge(service.status)}
          </div>
        </CardHeader>
        {service.current_version && (
          <CardContent>
            <div className="text-sm">
              <span className="font-medium">Current Version:</span> {service.current_version}
            </div>
          </CardContent>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="health-checks">Health Checks</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>

        <TabsContent value="health-checks">
          <HealthChecksTab serviceId={Number(serviceId)} />
        </TabsContent>

        <TabsContent value="deployments">
          <DeploymentsTab serviceId={Number(serviceId)} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

#### 4.5 Health Checks Tab Component

**File**: `frontend/src/components/HealthChecksTab.tsx` (new file)

**Changes**: Create health checks tab with CRUD and manual execution

```typescript
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { healthChecksApi } from '../lib/api';
import { HealthCheck } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

interface HealthChecksTabProps {
  serviceId: number;
}

export const HealthChecksTab: React.FC<HealthChecksTabProps> = ({ serviceId }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    method: 'GET',
    expected_status_code: 200,
    timeout_seconds: 30,
  });
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: healthChecks, isLoading } = useQuery({
    queryKey: ['health-checks', serviceId],
    queryFn: () => healthChecksApi.list(serviceId),
  });

  const createMutation = useMutation({
    mutationFn: () => healthChecksApi.create(serviceId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-checks', serviceId] });
      setFormData({
        name: '',
        url: '',
        method: 'GET',
        expected_status_code: 200,
        timeout_seconds: 30,
      });
      setError('');
      setShowCreateForm(false);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create health check');
    },
  });

  const executeMutation = useMutation({
    mutationFn: (checkId: number) => healthChecksApi.execute(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service', serviceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (checkId: number) => healthChecksApi.delete(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-checks', serviceId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      setError('Name and URL are required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Health Checks</h2>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : 'New Health Check'}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Health Check</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="API Health Check"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="https://api.example.com/health"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Expected Status</label>
                  <input
                    type="number"
                    value={formData.expected_status_code}
                    onChange={(e) => setFormData({ ...formData, expected_status_code: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>

              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Health Check'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div>Loading...</div>
      ) : healthChecks && healthChecks.length > 0 ? (
        <div className="space-y-4">
          {healthChecks.map((check: HealthCheck) => (
            <Card key={check.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{check.name}</CardTitle>
                    <div className="text-sm text-gray-600 mt-1">{check.url}</div>
                  </div>
                  <Badge variant={check.enabled ? 'success' : 'default'}>
                    {check.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => executeMutation.mutate(check.id)}
                    disabled={executeMutation.isPending}
                  >
                    Run Now
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(check.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">No health checks configured yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

#### 4.6 Deployments Tab Component

**File**: `frontend/src/components/DeploymentsTab.tsx` (new file)

**Changes**: Create deployments tab with version history

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { deploymentsApi } from '../lib/api';
import { Deployment } from '../types';
import { Card, CardContent } from './ui/card';

interface DeploymentsTabProps {
  serviceId: number;
}

export const DeploymentsTab: React.FC<DeploymentsTabProps> = ({ serviceId }) => {
  const { data: deployments, isLoading } = useQuery({
    queryKey: ['deployments', serviceId],
    queryFn: () => deploymentsApi.list(serviceId),
  });

  if (isLoading) {
    return <div>Loading deployments...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Deployment History</h2>

      {deployments && deployments.length > 0 ? (
        <div className="space-y-4">
          {deployments.map((deployment: Deployment) => (
            <Card key={deployment.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-lg">{deployment.version}</div>
                    <div className="text-sm text-gray-600">
                      Detected {new Date(deployment.detected_at).toLocaleString()}
                    </div>
                    {deployment.notes && (
                      <div className="text-sm mt-2">{deployment.notes}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">No deployments tracked yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

#### 4.7 Navigation Updates

**File**: `frontend/src/App.tsx`

**Changes**: Add Services routes and navigation link

```typescript
import { Services } from './pages/Services';
import { ServiceDetail } from './pages/ServiceDetail';

// Add to routes:
<Route path="/services" element={<Services />} />
<Route path="/services/:serviceId" element={<ServiceDetail />} />
```

**File**: `frontend/src/components/Sidebar.tsx` (or equivalent navigation component)

**Changes**: Add Services link to navigation (after Teams link)

```typescript
<NavLink to="/services">Services</NavLink>
```

### Success Criteria

#### Automated Verification:
- [ ] Frontend builds without errors: `cd frontend && npm run build`
- [ ] TypeScript type checking passes: `cd frontend && npm run typecheck`
- [ ] No linting errors: `cd frontend && npm run lint`

#### Manual Verification:
- [ ] Services page loads and displays services list
- [ ] Create service form works → service appears in list
- [ ] Click service → navigates to detail page with tabs
- [ ] Health Checks tab shows configured checks
- [ ] Create health check → appears in list
- [ ] "Run Now" button executes check → result appears
- [ ] Delete health check → removed from list
- [ ] Deployments tab shows version history
- [ ] Versions appear in reverse chronological order
- [ ] Service status badge updates based on health check results
- [ ] Team invitations UI works in Teams page
- [ ] All CRUD operations work without errors
- [ ] Navigation between pages works smoothly

---

## Testing Strategy

### Unit Tests

**Backend Tests** (create files in `backend/tests/`):

1. `test_invitations.py`:
   - Token generation is unique
   - Invitation expiry validation
   - Cannot accept expired invitation
   - Cannot create duplicate invitation
   - Email validation

2. `test_services.py`:
   - Service CRUD operations
   - Team scoping (cannot access other team's services)
   - Cascade delete to health checks and deployments

3. `test_health_checks.py`:
   - Health check execution with various response scenarios
   - JSON path extraction
   - Timeout handling
   - Service status calculation

4. `test_deployments.py`:
   - Version detection logic
   - Deployment record creation on version change
   - No duplicate deployments for same version

**Test Example** (`backend/tests/test_invitations.py`):
```python
import pytest
from datetime import datetime, timedelta
from app.models.invitation import Invitation

@pytest.mark.asyncio
async def test_create_invitation(async_session, test_team, test_user):
    """Test creating a team invitation"""
    invitation = Invitation(
        team_id=test_team.id,
        email="test@example.com",
        role="member",
        token="test-token-123",
        invited_by=test_user.id,
        status="pending",
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(hours=48),
    )
    async_session.add(invitation)
    await async_session.commit()

    assert invitation.id is not None
    assert invitation.status == "pending"

@pytest.mark.asyncio
async def test_expired_invitation(async_session, test_team, test_user):
    """Test that expired invitations cannot be accepted"""
    invitation = Invitation(
        team_id=test_team.id,
        email="test@example.com",
        role="member",
        token="test-token-123",
        invited_by=test_user.id,
        status="pending",
        created_at=datetime.utcnow() - timedelta(hours=49),
        expires_at=datetime.utcnow() - timedelta(hours=1),  # Expired
    )
    async_session.add(invitation)
    await async_session.commit()

    # Acceptance should fail
    assert invitation.expires_at < datetime.utcnow()
```

### Integration Tests

**Health Check Execution Flow**:
1. Create service via API
2. Create health check with real test endpoint
3. Execute health check manually
4. Verify result is stored correctly
5. Verify service status is updated

**Version Tracking Flow**:
1. Create service with version endpoint
2. Worker detects initial version
3. Change version on test endpoint
4. Worker detects new version
5. Verify deployment record created

### Manual Testing Steps

**Phase 1 - Team Invitations**:
1. Log in as team admin
2. Navigate to Teams page
3. Create invitation for test email
4. Check email inbox for invitation
5. Click invitation link (in incognito/different browser)
6. Verify redirected to accept page
7. Accept invitation
8. Verify team membership created
9. Test revoke invitation flow
10. Test expired invitation behavior

**Phase 2 - Health Checks**:
1. Create new service
2. Add health check with public URL (e.g., https://httpstat.us/200)
3. Click "Run Now" and verify success
4. Change expected status code to mismatch
5. Run again and verify failure
6. Check service status changes to "unhealthy"
7. Fix configuration and verify status returns to "healthy"
8. Test JSON path validation with JSONPlaceholder API

**Phase 3 - Deployments**:
1. Create service
2. Configure version endpoint (test endpoint that returns JSON with version)
3. Wait for worker to detect version
4. Verify current_version populated
5. Change version on endpoint
6. Wait for worker to detect change
7. Verify new deployment record created
8. View deployment history in UI

## Performance Considerations

**Health Check Execution**:
- Checks run concurrently using `asyncio.gather()`
- Each check has configurable timeout (default 30s)
- Failed checks don't block other checks
- Worker runs every 1 minute (configurable)

**Database Queries**:
- Indexes on foreign keys for fast lookups
- Timestamp indexes for time-range queries
- Status indexes for filtering active/inactive records

**Frontend**:
- React Query caching reduces API calls
- Query invalidation on mutations keeps data fresh
- Lazy loading for large deployment histories

**Scalability Notes**:
- Health checks scale horizontally (multiple workers)
- Each worker processes all checks (stateless)
- For large deployments, consider message queue (future enhancement)

## Migration Notes

**Backward Compatibility**:
- Existing server monitoring remains unchanged
- No migration of servers to services
- Teams, users, alerts continue working as before

**Data Retention**:
- Health check results: Consider retention policy (e.g., 30 days)
- Deployment history: Keep indefinitely (small data size)

**Running Migrations**:
```bash
cd backend
alembic upgrade head
```

**Starting Worker**:
```bash
# Development
cd backend
python -m app.worker

# Production (Docker Compose)
docker-compose up -d worker
```

## References

- Original research: `thoughts/shared/research/2025-10-06-team-invitations-monitoring-features.md`
- Team management patterns: `backend/app/api/teams.py:35-280`
- Alert system patterns: `backend/app/services/alert_evaluator.py:15-159`
- Database migration patterns: `backend/alembic/versions/`
- RBAC patterns: `backend/app/core/rbac.py:14-104`
- Frontend patterns: `frontend/src/pages/Teams.tsx`, `frontend/src/lib/api.ts`
