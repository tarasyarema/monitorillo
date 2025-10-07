from datetime import datetime, timedelta
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.users import current_active_user
from app.models.service import Service, VersionCheck, VersionCheckResult
from app.models.user import User
from app.schemas.service import (
    VersionCheckCreate,
    VersionCheckRead,
    VersionCheckResultRead,
    VersionCheckUpdate,
)
from app.services.version_checker import VersionCheckExecutor

router = APIRouter()


@router.post("/services/{service_id}/version-checks", response_model=VersionCheckRead, status_code=status.HTTP_201_CREATED)
async def create_version_check(
    service_id: int,
    check_data: VersionCheckCreate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Create a version check for a service (requires admin role)"""

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
            detail="You need admin role to create version checks"
        )

    # Create version check
    version_check = VersionCheck(
        service_id=service_id,
        name=check_data.name,
        url=check_data.url,
        json_path=check_data.json_path,
        timeout_seconds=check_data.timeout_seconds,
        check_interval_minutes=check_data.check_interval_minutes,
        enabled=check_data.enabled,
    )
    session.add(version_check)
    await session.commit()
    await session.refresh(version_check)

    return version_check


@router.get("/services/{service_id}/version-checks", response_model=List[VersionCheckRead])
async def list_version_checks(
    service_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List version checks for a service"""

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

    # Get version checks
    result = await session.execute(
        select(VersionCheck)
        .where(VersionCheck.service_id == service_id)
        .order_by(VersionCheck.name)
    )
    version_checks = result.scalars().all()
    return version_checks


@router.patch("/version-checks/{check_id}", response_model=VersionCheckRead)
async def update_version_check(
    check_id: int,
    check_data: VersionCheckUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update version check (requires admin role)"""

    result = await session.execute(
        select(VersionCheck).where(VersionCheck.id == check_id)
    )
    version_check = result.scalar_one_or_none()

    if not version_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version check not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == version_check.service_id)
    )
    service = result.scalar_one()

    # Check admin access
    from app.core.rbac import get_user_team_role, TeamRole, ROLE_HIERARCHY
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role or ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[TeamRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin role to update version checks"
        )

    # Update fields
    update_data = check_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(version_check, field, value)

    version_check.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(version_check)

    return version_check


@router.delete("/version-checks/{check_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version_check(
    check_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Delete version check (requires admin role)"""

    result = await session.execute(
        select(VersionCheck).where(VersionCheck.id == check_id)
    )
    version_check = result.scalar_one_or_none()

    if not version_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version check not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == version_check.service_id)
    )
    service = result.scalar_one()

    # Check admin access
    from app.core.rbac import get_user_team_role, TeamRole, ROLE_HIERARCHY
    user_role = await get_user_team_role(service.team_id, user, session)

    if not user_role or ROLE_HIERARCHY[user_role] < ROLE_HIERARCHY[TeamRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need admin role to delete version checks"
        )

    await session.delete(version_check)
    await session.commit()


@router.post("/version-checks/{check_id}/execute", response_model=VersionCheckResultRead)
async def execute_version_check_now(
    check_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Execute a version check immediately (manual trigger)"""

    result = await session.execute(
        select(VersionCheck).where(VersionCheck.id == check_id)
    )
    version_check = result.scalar_one_or_none()

    if not version_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version check not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == version_check.service_id)
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
    executor = VersionCheckExecutor(session)
    result = await executor.execute_and_store(version_check)

    return result


@router.get("/version-checks/{check_id}/results", response_model=List[VersionCheckResultRead])
async def get_version_check_results(
    check_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    hours: int = 24,
):
    """Get version check results history"""

    result = await session.execute(
        select(VersionCheck).where(VersionCheck.id == check_id)
    )
    version_check = result.scalar_one_or_none()

    if not version_check:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version check not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == version_check.service_id)
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
        select(VersionCheckResult)
        .where(
            VersionCheckResult.version_check_id == check_id,
            VersionCheckResult.checked_at >= since
        )
        .order_by(desc(VersionCheckResult.checked_at))
    )
    results = result.scalars().all()
    return results
