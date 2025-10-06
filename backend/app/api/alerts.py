from typing import Annotated
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.users import current_active_user
from app.models.alert import Alert, AlertConfig
from app.models.team import TeamMember
from app.models.user import User

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    state: str | None = None,
):
    """List all alerts for user's teams"""
    # Get user's team IDs
    result = await session.execute(
        select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    )
    team_ids = [row[0] for row in result.all()]

    # Build query
    query = select(Alert).where(Alert.team_id.in_(team_ids))

    if state:
        query = query.where(Alert.state == state)

    query = query.order_by(Alert.last_triggered_at.desc())

    result = await session.execute(query)
    alerts = result.scalars().all()

    return [
        {
            "id": alert.id,
            "server_id": alert.server_id,
            "metric_type": alert.metric_type,
            "severity": alert.severity,
            "state": alert.state,
            "threshold_value": alert.threshold_value,
            "current_value": alert.current_value,
            "message": alert.message,
            "first_triggered_at": alert.first_triggered_at,
            "last_triggered_at": alert.last_triggered_at,
            "acknowledged_at": alert.acknowledged_at,
            "resolved_at": alert.resolved_at,
        }
        for alert in alerts
    ]


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Acknowledge an alert"""
    result = await session.execute(
        select(Alert).where(Alert.id == alert_id)
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )

    # Check team access
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == alert.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    alert.state = "acknowledged"
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledged_by = user.id

    await session.commit()

    return {"status": "ok", "message": "Alert acknowledged"}


@router.get("/configs")
async def list_alert_configs(
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List alert configurations for user's teams"""
    # Get user's team IDs
    result = await session.execute(
        select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    )
    team_ids = [row[0] for row in result.all()]

    result = await session.execute(
        select(AlertConfig).where(AlertConfig.team_id.in_(team_ids))
    )
    configs = result.scalars().all()

    return [
        {
            "id": config.id,
            "team_id": config.team_id,
            "server_id": config.server_id,
            "metric_type": config.metric_type,
            "warning_threshold": config.warning_threshold,
            "critical_threshold": config.critical_threshold,
            "sustained_minutes": config.sustained_minutes,
            "enabled": config.enabled,
        }
        for config in configs
    ]


@router.post("/configs")
async def create_alert_config(
    team_id: int,
    metric_type: str,
    warning_threshold: float,
    critical_threshold: float,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    server_id: int | None = None,
):
    """Create an alert configuration"""
    # Check team access
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    config = AlertConfig(
        team_id=team_id,
        server_id=server_id,
        metric_type=metric_type,
        warning_threshold=warning_threshold,
        critical_threshold=critical_threshold,
    )

    session.add(config)
    await session.commit()
    await session.refresh(config)

    return {
        "id": config.id,
        "team_id": config.team_id,
        "server_id": config.server_id,
        "metric_type": config.metric_type,
        "warning_threshold": config.warning_threshold,
        "critical_threshold": config.critical_threshold,
        "enabled": config.enabled,
    }
