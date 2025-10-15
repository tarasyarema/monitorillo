from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_async_session
from app.core.users import current_active_user
from app.models.service import Deployment, Service
from app.models.user import User
from app.schemas.service import DeploymentRead, DeploymentUpdate

router = APIRouter()


@router.get("/services/{service_id}/deployments", response_model=List[DeploymentRead])
async def list_deployments(
    service_id: int,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    """Get deployment history for a service (paginated)"""

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

    # Get deployments
    result = await session.execute(
        select(Deployment)
        .where(Deployment.service_id == service_id)
        .order_by(desc(Deployment.detected_at))
        .limit(limit)
        .offset(offset)
    )
    deployments = result.scalars().all()
    return deployments


@router.patch("/deployments/{deployment_id}", response_model=DeploymentRead)
async def update_deployment(
    deployment_id: int,
    deployment_data: DeploymentUpdate,
    user: Annotated[User, Depends(current_active_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
):
    """Update deployment notes (e.g., add release notes or comments)"""

    result = await session.execute(
        select(Deployment).where(Deployment.id == deployment_id)
    )
    deployment = result.scalar_one_or_none()

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deployment not found"
        )

    # Get service for team_id
    result = await session.execute(
        select(Service).where(Service.id == deployment.service_id)
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

    # Update notes
    if deployment_data.notes is not None:
        deployment.notes = deployment_data.notes

    await session.commit()
    await session.refresh(deployment)

    return deployment
