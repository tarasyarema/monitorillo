from typing import Annotated
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.users import current_active_user
from app.models.alert import Alert, AlertConfig
from app.models.team import TeamMember
from app.models.user import User

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertConfigUpdate(BaseModel):
    warning_threshold: float | None = None
    critical_threshold: float | None = None
    sustained_minutes: int | None = None
    enabled: bool | None = None


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

    query = query.order_by(Alert.updated_at.desc())

    result = await session.execute(query)
    alerts = result.scalars().all()

    return [
        {
            "id": alert.id,
            "server_id": alert.server_id,
            "service_id": alert.service_id,
            "health_check_id": alert.health_check_id,
            "metric_type": alert.metric_type,
            "severity": alert.severity,
            "state": alert.state,
            "threshold_value": alert.threshold_value,
            "current_value": alert.current_value,
            "message": alert.message,
            "created_at": alert.created_at,
            "updated_at": alert.updated_at,
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


@router.post("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Resolve an alert"""
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

    alert.state = "resolved"
    alert.resolved_at = datetime.utcnow()

    await session.commit()

    return {"status": "ok", "message": "Alert resolved"}


@router.patch("/alert-configs/{config_id}")
async def update_alert_config(
    config_id: int,
    update_data: AlertConfigUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update an alert configuration"""
    result = await session.execute(
        select(AlertConfig).where(AlertConfig.id == config_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert config not found"
        )

    # Check team access
    result = await session.execute(
        select(TeamMember).where(
            TeamMember.user_id == user.id,
            TeamMember.team_id == config.team_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    if update_data.warning_threshold is not None:
        config.warning_threshold = update_data.warning_threshold
    if update_data.critical_threshold is not None:
        config.critical_threshold = update_data.critical_threshold
    if update_data.sustained_minutes is not None:
        config.sustained_minutes = update_data.sustained_minutes
    if update_data.enabled is not None:
        config.enabled = update_data.enabled

    config.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(config)

    return {
        "id": config.id,
        "team_id": config.team_id,
        "server_id": config.server_id,
        "metric_type": config.metric_type,
        "warning_threshold": config.warning_threshold,
        "critical_threshold": config.critical_threshold,
        "sustained_minutes": config.sustained_minutes,
        "enabled": config.enabled,
    }


@router.get("/{alert_id}")
async def get_alert_detail(
    alert_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Get detailed information about an alert"""
    from app.models.server import Server, Metric
    from sqlalchemy import desc

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

    # Get server details
    server = None
    if alert.server_id:
        result = await session.execute(
            select(Server).where(Server.id == alert.server_id)
        )
        server = result.scalar_one_or_none()

    # Get recent metrics for context (last 10)
    recent_metrics = []
    if alert.server_id:
        result = await session.execute(
            select(Metric)
            .where(
                Metric.server_id == alert.server_id,
                Metric.metric_type == "system"
            )
            .order_by(desc(Metric.timestamp))
            .limit(10)
        )
        metrics = result.scalars().all()

        for metric in metrics:
            value = None
            if alert.metric_type == "cpu":
                value = metric.value.get("cpu", {}).get("usage_percent")
            elif alert.metric_type == "memory":
                value = metric.value.get("memory", {}).get("used_percent")
            elif alert.metric_type == "disk":
                partitions = metric.value.get("disk", {}).get("partitions", {})
                root = partitions.get("/") or partitions.get("/System/Volumes/Data")
                if root:
                    value = root.get("used_percent")

            if value is not None:
                recent_metrics.append({
                    "timestamp": metric.timestamp,
                    "value": value
                })

    # Get related alerts
    related_alerts = []
    if alert.server_id:
        result = await session.execute(
            select(Alert)
            .where(
                Alert.server_id == alert.server_id,
                Alert.id != alert.id
            )
            .order_by(desc(Alert.updated_at))
            .limit(5)
        )
        related = result.scalars().all()
        related_alerts = [
            {
                "id": a.id,
                "metric_type": a.metric_type,
                "severity": a.severity,
                "state": a.state,
                "message": a.message,
                "created_at": a.created_at,
            }
            for a in related
        ]

    return {
        "id": alert.id,
        "server_id": alert.server_id,
        "service_id": alert.service_id,
        "health_check_id": alert.health_check_id,
        "server": {
            "id": server.id,
            "name": server.name,
            "hostname": server.hostname,
            "status": server.status,
        } if server else None,
        "metric_type": alert.metric_type,
        "severity": alert.severity,
        "state": alert.state,
        "threshold_value": alert.threshold_value,
        "current_value": alert.current_value,
        "message": alert.message,
        "created_at": alert.created_at,
        "updated_at": alert.updated_at,
        "acknowledged_at": alert.acknowledged_at,
        "resolved_at": alert.resolved_at,
        "recent_metrics": recent_metrics,
        "related_alerts": related_alerts,
    }
