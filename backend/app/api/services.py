from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.rbac import require_team_member, require_team_admin
from app.core.users import current_active_user
from app.models.service import Service
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter()


@router.post("/teams/{team_id}/services", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
async def create_service(
    team_id: int,
    service_data: ServiceCreate,
    user: Annotated[User, Depends(require_team_admin)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Create a new service (requires admin role)"""

    service = Service(
        team_id=team_id,
        name=service_data.name,
        description=service_data.description,
        version_url=service_data.version_url,
        version_json_path=service_data.version_json_path,
        status="unknown",
    )
    session.add(service)
    await session.commit()
    await session.refresh(service)

    return service


@router.get("/teams/{team_id}/services", response_model=List[ServiceRead])
async def list_services(
    team_id: int,
    user: Annotated[User, Depends(require_team_member)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """List all services for a team"""

    result = await session.execute(
        select(Service)
        .where(Service.team_id == team_id)
        .order_by(Service.name)
    )
    services = result.scalars().all()
    return services


@router.get("/services/{service_id}", response_model=ServiceRead)
async def get_service(
    service_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Get service details"""

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

    return service


@router.patch("/services/{service_id}", response_model=ServiceRead)
async def update_service(
    service_id: int,
    service_data: ServiceUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update service (requires admin role)"""

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
            detail="You need admin role to update services"
        )

    # Update fields
    if service_data.name is not None:
        service.name = service_data.name
    if service_data.description is not None:
        service.description = service_data.description
    if service_data.version_url is not None:
        service.version_url = service_data.version_url
    if service_data.version_json_path is not None:
        service.version_json_path = service_data.version_json_path

    await session.commit()
    await session.refresh(service)

    return service


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Delete service (requires admin role)"""

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
            detail="You need admin role to delete services"
        )

    await session.delete(service)
    await session.commit()
