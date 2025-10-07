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
