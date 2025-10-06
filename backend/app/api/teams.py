from typing import Annotated, List
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_async_session
from app.core.rbac import TeamRole, require_team_admin, require_team_owner
from app.core.users import current_active_user
from app.models.team import Team, TeamMember
from app.models.user import User
from app.schemas.team import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberRead,
    TeamMemberUpdate,
    TeamRead,
    TeamUpdate,
)

router = APIRouter(prefix="/teams", tags=["teams"])


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    text = re.sub(r'^-+|-+$', '', text)
    return text


@router.post("", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Create a new team. Creator becomes the owner."""
    # Generate slug from name
    slug = slugify(team_data.name)

    # Check if slug already exists
    result = await session.execute(select(Team).where(Team.slug == slug))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A team with this name already exists"
        )

    # Create team
    team = Team(name=team_data.name, slug=slug)
    session.add(team)
    await session.flush()

    # Add creator as owner
    membership = TeamMember(
        user_id=user.id,
        team_id=team.id,
        role=TeamRole.OWNER.value
    )
    session.add(membership)
    await session.commit()

    # Refresh with members loaded
    await session.refresh(team, ["members"])

    return team


@router.get("", response_model=List[TeamRead])
async def list_teams(
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List all teams the current user is a member of"""
    result = await session.execute(
        select(Team)
        .options(selectinload(Team.members))
        .join(TeamMember)
        .where(TeamMember.user_id == user.id)
    )
    teams = result.scalars().all()
    return teams


@router.get("/{team_id}", response_model=TeamRead)
async def get_team(
    team_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Get team details. User must be a member."""
    # Check membership
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )

    # Get team with members
    result = await session.execute(
        select(Team)
        .options(selectinload(Team.members))
        .where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    return team


@router.patch("/{team_id}", response_model=TeamRead)
async def update_team(
    team_id: int,
    team_data: TeamUpdate,
    user: Annotated[User, Depends(require_team_admin)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update team. Requires admin role."""
    result = await session.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    if team_data.name:
        team.name = team_data.name
        team.slug = slugify(team_data.name)

    await session.commit()
    await session.refresh(team, ["members"])
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: int,
    user: Annotated[User, Depends(require_team_owner)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Delete team. Requires owner role."""
    result = await session.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()

    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )

    await session.delete(team)
    await session.commit()


@router.post("/{team_id}/members", response_model=TeamMemberRead, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: int,
    member_data: TeamMemberCreate,
    user: Annotated[User, Depends(require_team_admin)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Add a member to the team. Requires admin role."""
    # Check if user is already a member
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == member_data.user_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this team"
        )

    # Verify user exists
    result = await session.execute(select(User).where(User.id == member_data.user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Create membership
    membership = TeamMember(
        user_id=member_data.user_id,
        team_id=team_id,
        role=member_data.role
    )
    session.add(membership)
    await session.commit()
    await session.refresh(membership)

    return membership


@router.patch("/{team_id}/members/{member_id}", response_model=TeamMemberRead)
async def update_team_member(
    team_id: int,
    member_id: int,
    member_data: TeamMemberUpdate,
    user: Annotated[User, Depends(require_team_admin)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update team member role. Requires admin role."""
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team_id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found"
        )

    membership.role = member_data.role
    await session.commit()
    await session.refresh(membership)

    return membership


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    team_id: int,
    member_id: int,
    user: Annotated[User, Depends(require_team_admin)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Remove a member from the team. Requires admin role."""
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.team_id == team_id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found"
        )

    # Prevent removing the last owner
    if membership.role == TeamRole.OWNER.value:
        result = await session.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.role == TeamRole.OWNER.value
            )
        )
        owner_count = len(result.scalars().all())

        if owner_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner from the team"
            )

    await session.delete(membership)
    await session.commit()
