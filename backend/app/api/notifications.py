from typing import Annotated, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.users import current_active_user
from app.models.notification import NotificationChannel
from app.models.team import TeamMember
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationChannelCreate(BaseModel):
    team_id: int
    type: str  # "slack" or "email"
    name: str
    slack_webhook_url: str | None = None
    email_addresses: str | None = None


class NotificationChannelUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    slack_webhook_url: str | None = None
    email_addresses: str | None = None


@router.get("/channels")
async def list_notification_channels(
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    team_id: int | None = None,
):
    """List notification channels"""
    # Get user's team IDs
    result = await session.execute(
        select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    )
    team_ids = [row[0] for row in result.all()]

    query = select(NotificationChannel).where(NotificationChannel.team_id.in_(team_ids))

    if team_id:
        query = query.where(NotificationChannel.team_id == team_id)

    result = await session.execute(query.order_by(NotificationChannel.name))
    channels = result.scalars().all()

    return [
        {
            "id": channel.id,
            "team_id": channel.team_id,
            "type": channel.type,
            "name": channel.name,
            "enabled": channel.enabled,
            "slack_webhook_url": channel.slack_webhook_url if channel.type == "slack" else None,
            "email_addresses": channel.email_addresses if channel.type == "email" else None,
            "created_at": channel.created_at,
        }
        for channel in channels
    ]


@router.post("/channels", status_code=status.HTTP_201_CREATED)
async def create_notification_channel(
    channel_data: NotificationChannelCreate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Create a notification channel"""
    # Check team membership
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == channel_data.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate channel type
    if channel_data.type not in ["slack", "email"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid channel type. Must be 'slack' or 'email'"
        )

    # Validate required fields
    if channel_data.type == "slack" and not channel_data.slack_webhook_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slack webhook URL is required for Slack channels"
        )

    if channel_data.type == "email" and not channel_data.email_addresses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email addresses are required for Email channels"
        )

    channel = NotificationChannel(
        team_id=channel_data.team_id,
        type=channel_data.type,
        name=channel_data.name,
        slack_webhook_url=channel_data.slack_webhook_url,
        email_addresses=channel_data.email_addresses,
    )

    session.add(channel)
    await session.commit()
    await session.refresh(channel)

    return {
        "id": channel.id,
        "team_id": channel.team_id,
        "type": channel.type,
        "name": channel.name,
        "enabled": channel.enabled,
        "slack_webhook_url": channel.slack_webhook_url if channel.type == "slack" else None,
        "email_addresses": channel.email_addresses if channel.type == "email" else None,
    }


@router.patch("/channels/{channel_id}")
async def update_notification_channel(
    channel_id: int,
    channel_data: NotificationChannelUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update a notification channel"""
    result = await session.execute(
        select(NotificationChannel).where(NotificationChannel.id == channel_id)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification channel not found"
        )

    # Check team membership
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == channel.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update fields
    if channel_data.name is not None:
        channel.name = channel_data.name
    if channel_data.enabled is not None:
        channel.enabled = channel_data.enabled
    if channel_data.slack_webhook_url is not None:
        channel.slack_webhook_url = channel_data.slack_webhook_url
    if channel_data.email_addresses is not None:
        channel.email_addresses = channel_data.email_addresses

    channel.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(channel)

    return {
        "id": channel.id,
        "team_id": channel.team_id,
        "type": channel.type,
        "name": channel.name,
        "enabled": channel.enabled,
        "slack_webhook_url": channel.slack_webhook_url if channel.type == "slack" else None,
        "email_addresses": channel.email_addresses if channel.type == "email" else None,
    }


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification_channel(
    channel_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Delete a notification channel"""
    result = await session.execute(
        select(NotificationChannel).where(NotificationChannel.id == channel_id)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification channel not found"
        )

    # Check team membership
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == channel.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    await session.delete(channel)
    await session.commit()
