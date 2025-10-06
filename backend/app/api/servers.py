from typing import Annotated
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.rbac import require_team_admin
from app.core.users import current_active_user
from app.models.server import Server
from app.models.team import TeamMember
from app.models.user import User
from app.models.alert import AlertConfig
from app.schemas.server import ServerCreate, ServerRead, ServerUpdate

router = APIRouter(prefix="/servers", tags=["servers"])


def generate_api_key() -> str:
    """Generate a secure random API key"""
    return secrets.token_urlsafe(32)


@router.get("", response_model=list[ServerRead])
async def list_servers(
    team_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List all servers for a team"""
    # Check team membership
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this team"
        )

    # Get all servers for the team
    result = await session.execute(
        select(Server).where(Server.team_id == team_id).order_by(Server.created_at.desc())
    )
    servers = result.scalars().all()
    return servers


@router.post("", response_model=ServerRead, status_code=status.HTTP_201_CREATED)
async def create_server(
    server_data: ServerCreate,
    team_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Create a new server (requires team membership)"""
    # Check team membership
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this team"
        )

    # Create server with generated API key
    server = Server(
        team_id=team_id,
        name=server_data.name,
        hostname=server_data.hostname,
        tags=server_data.tags or {},
        api_key=generate_api_key(),
        status="offline"
    )

    session.add(server)
    await session.flush()

    # Create default alert configs
    default_configs = [
        AlertConfig(
            team_id=team_id,
            server_id=server.id,
            metric_type="cpu",
            warning_threshold=80.0,
            critical_threshold=90.0,
        ),
        AlertConfig(
            team_id=team_id,
            server_id=server.id,
            metric_type="memory",
            warning_threshold=85.0,
            critical_threshold=95.0,
        ),
        AlertConfig(
            team_id=team_id,
            server_id=server.id,
            metric_type="disk",
            warning_threshold=80.0,
            critical_threshold=90.0,
        ),
    ]

    for config in default_configs:
        session.add(config)

    await session.commit()
    await session.refresh(server)

    return server


@router.get("/{server_id}", response_model=ServerRead)
async def get_server(
    server_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Get server details"""
    result = await session.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )

    # Check team access
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == server.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return server


@router.patch("/{server_id}", response_model=ServerRead)
async def update_server(
    server_id: int,
    server_data: ServerUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update server details"""
    result = await session.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )

    # Check team access
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == server.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update fields
    if server_data.name is not None:
        server.name = server_data.name
    if server_data.hostname is not None:
        server.hostname = server_data.hostname
    if server_data.tags is not None:
        server.tags = server_data.tags

    await session.commit()
    await session.refresh(server)

    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Delete a server"""
    result = await session.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )

    # Check team access
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == server.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    await session.delete(server)
    await session.commit()


@router.post("/{server_id}/regenerate-key", response_model=ServerRead)
async def regenerate_api_key(
    server_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Regenerate server API key"""
    result = await session.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )

    # Check team access
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == server.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    server.api_key = generate_api_key()

    await session.commit()
    await session.refresh(server)

    return server
