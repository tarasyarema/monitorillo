from typing import Annotated
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.users import current_active_user
from app.models.server import Server, Metric
from app.models.user import User
from app.schemas.server import MetricCreate, ServerRead

router = APIRouter(prefix="/metrics", tags=["metrics"])


async def verify_api_key(
    x_api_key: Annotated[str, Header()],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> Server:
    """Verify daemon API key and return associated server"""
    result = await session.execute(
        select(Server).where(Server.api_key == x_api_key)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )

    return server


@router.post("", status_code=status.HTTP_201_CREATED)
async def ingest_metrics(
    payload: MetricCreate,
    server: Annotated[Server, Depends(verify_api_key)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Receive metrics from daemon"""

    # Update server status and last_seen_at
    server.last_seen_at = datetime.utcnow()
    server.status = "online"
    server.name = payload.server_name  # Update name if it changed

    # Store system metrics
    system_metric = Metric(
        server_id=server.id,
        metric_type="system",
        value=payload.system,
        timestamp=datetime.fromisoformat(payload.timestamp.replace('Z', '+00:00'))
    )
    session.add(system_metric)

    # Store Docker metrics
    docker_metric = Metric(
        server_id=server.id,
        metric_type="docker",
        value=payload.docker,
        timestamp=datetime.fromisoformat(payload.timestamp.replace('Z', '+00:00'))
    )
    session.add(docker_metric)

    await session.commit()

    # Alert evaluation is now handled by the worker
    return {"status": "ok", "message": "Metrics received"}


@router.get("/servers", response_model=list[ServerRead])
async def list_servers(
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List all servers for user's teams"""
    # Get user's team IDs
    from app.models.team import TeamMember

    result = await session.execute(
        select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    )
    team_ids = [row[0] for row in result.all()]

    # Get servers for those teams
    result = await session.execute(
        select(Server)
        .where(Server.team_id.in_(team_ids))
        .order_by(Server.name)
    )
    servers = result.scalars().all()

    # Mark servers as offline if not seen in 2 minutes
    for server in servers:
        if server.last_seen_at:
            if datetime.utcnow() - server.last_seen_at > timedelta(minutes=2):
                server.status = "offline"

    await session.commit()

    return servers


@router.get("/servers/{server_id}/latest")
async def get_latest_metrics(
    server_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Get latest metrics for a server"""
    # Verify user has access to this server
    from app.models.team import TeamMember

    result = await session.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )

    # Check team membership
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

    # Get latest system metric
    result = await session.execute(
        select(Metric)
        .where(
            Metric.server_id == server_id,
            Metric.metric_type == "system"
        )
        .order_by(desc(Metric.timestamp))
        .limit(1)
    )
    system_metric = result.scalar_one_or_none()

    # Get latest docker metric
    result = await session.execute(
        select(Metric)
        .where(
            Metric.server_id == server_id,
            Metric.metric_type == "docker"
        )
        .order_by(desc(Metric.timestamp))
        .limit(1)
    )
    docker_metric = result.scalar_one_or_none()

    return {
        "server": {
            "id": server.id,
            "name": server.name,
            "status": server.status,
            "last_seen_at": server.last_seen_at,
        },
        "system": system_metric.value if system_metric else None,
        "docker": docker_metric.value if docker_metric else None,
        "timestamp": system_metric.timestamp if system_metric else None,
    }


@router.get("/servers/{server_id}/history")
async def get_metrics_history(
    server_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    hours: int = 24,
    granularity_minutes: int | None = None,
):
    """Get historical metrics for a server with optional granularity for downsampling"""
    # Verify access (same as above)
    from app.models.team import TeamMember

    result = await session.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )

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

    # Get metrics from the last N hours
    since = datetime.utcnow() - timedelta(hours=hours)

    result = await session.execute(
        select(Metric)
        .where(
            Metric.server_id == server_id,
            Metric.timestamp >= since
        )
        .order_by(Metric.timestamp)
    )
    metrics = result.scalars().all()

    # Group by type
    system_metrics = []
    docker_metrics = []

    for metric in metrics:
        if metric.metric_type == "system":
            system_metrics.append({
                "timestamp": metric.timestamp,
                "value": metric.value
            })
        else:
            docker_metrics.append({
                "timestamp": metric.timestamp,
                "value": metric.value
            })

    # Apply downsampling if granularity is specified
    if granularity_minutes:
        system_metrics = _downsample_metrics(system_metrics, granularity_minutes)
        docker_metrics = _downsample_metrics(docker_metrics, granularity_minutes)

    return {
        "server_id": server_id,
        "period_hours": hours,
        "system": system_metrics,
        "docker": docker_metrics,
    }


def _downsample_metrics(metrics: list[dict], granularity_minutes: int) -> list[dict]:
    """Downsample metrics by averaging values within granularity windows"""
    if not metrics or granularity_minutes <= 0:
        return metrics

    from collections import defaultdict

    # Group metrics by time buckets
    buckets = defaultdict(list)
    granularity_seconds = granularity_minutes * 60

    for metric in metrics:
        timestamp = metric["timestamp"]
        # Round timestamp to granularity bucket
        bucket_timestamp = timestamp.replace(second=0, microsecond=0)
        bucket_key = int(bucket_timestamp.timestamp() / granularity_seconds) * granularity_seconds
        buckets[bucket_key].append(metric)

    # Average values in each bucket
    downsampled = []
    for bucket_key, bucket_metrics in sorted(buckets.items()):
        if not bucket_metrics:
            continue

        # Average the metric values
        avg_value = _average_metric_values([m["value"] for m in bucket_metrics])

        downsampled.append({
            "timestamp": datetime.fromtimestamp(bucket_key),
            "value": avg_value
        })

    return downsampled


def _average_metric_values(values: list[dict]) -> dict:
    """Average metric values (handles nested structures)"""
    if not values:
        return {}

    # For system metrics
    if "cpu" in values[0]:
        cpu_usages = [v.get("cpu", {}).get("usage_percent", 0) for v in values if v.get("cpu")]
        cpu_loads = [v.get("cpu", {}).get("load_avg_1", 0) for v in values if v.get("cpu")]

        memory_used = [v.get("memory", {}).get("used_percent", 0) for v in values if v.get("memory")]

        result = {
            "cpu": {
                "usage_percent": sum(cpu_usages) / len(cpu_usages) if cpu_usages else 0,
                "load_avg_1": sum(cpu_loads) / len(cpu_loads) if cpu_loads else 0,
            },
            "memory": {
                "used_percent": sum(memory_used) / len(memory_used) if memory_used else 0,
            },
        }

        # Handle disk partitions (just use the first value's structure for simplicity)
        if values[0].get("disk", {}).get("partitions"):
            result["disk"] = values[0]["disk"]

        # Handle network (just use the latest value)
        if values[-1].get("network"):
            result["network"] = values[-1]["network"]

        return result

    # For docker metrics, return the latest value (averaging container metrics is complex)
    return values[-1] if values else {}
