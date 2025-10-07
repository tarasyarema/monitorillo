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
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    hours: int = 24,
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
