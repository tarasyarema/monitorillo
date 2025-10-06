from enum import Enum
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.users import current_active_user
from app.models.team import TeamMember
from app.models.user import User
from sqlalchemy import select


class TeamRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


# Permission hierarchy: owner > admin > member > viewer
ROLE_HIERARCHY = {
    TeamRole.OWNER: 4,
    TeamRole.ADMIN: 3,
    TeamRole.MEMBER: 2,
    TeamRole.VIEWER: 1,
}


async def get_user_team_role(
    team_id: int,
    user: User,
    session: AsyncSession,
) -> TeamRole | None:
    """Get user's role in a team"""
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user.id
        )
    )
    membership = result.scalar_one_or_none()

    if not membership:
        return None

    return TeamRole(membership.role)


async def require_team_role(
    team_id: int,
    min_role: TeamRole,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> User:
    """Require user to have at least the specified role in a team"""
    user_role = await get_user_team_role(team_id, user, session)

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team"
        )

    if ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[min_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You need at least {min_role.value} role to perform this action"
        )

    return user


# Convenience dependencies for common role requirements
async def require_team_viewer(
    team_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> User:
    return await require_team_role(team_id, TeamRole.VIEWER, user, session)


async def require_team_member(
    team_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> User:
    return await require_team_role(team_id, TeamRole.MEMBER, user, session)


async def require_team_admin(
    team_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> User:
    return await require_team_role(team_id, TeamRole.ADMIN, user, session)


async def require_team_owner(
    team_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> User:
    return await require_team_role(team_id, TeamRole.OWNER, user, session)
