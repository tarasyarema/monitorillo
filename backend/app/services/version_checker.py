import asyncio
from datetime import datetime
from typing import Dict, Any

import httpx
from jsonpath_ng import parse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Deployment, Service, VersionCheck, VersionCheckResult


class VersionCheckExecutor:
    """New version check executor that works with VersionCheck models"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute_check(self, version_check: VersionCheck) -> Dict[str, Any]:
        """Execute a single version check and return result"""

        start_time = datetime.utcnow()
        result = {
            "success": False,
            "version": None,
            "response_time_ms": None,
            "error_message": None,
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url=version_check.url,
                    timeout=version_check.timeout_seconds,
                )

                end_time = datetime.utcnow()
                response_time_ms = int((end_time - start_time).total_seconds() * 1000)

                result["response_time_ms"] = response_time_ms

                if response.status_code != 200:
                    result["error_message"] = f"Expected status 200, got {response.status_code}"
                    return result

                # Parse JSON and extract version
                try:
                    response_json = response.json()
                    jsonpath_expr = parse(version_check.json_path)
                    matches = jsonpath_expr.find(response_json)

                    if not matches:
                        result["error_message"] = f"JSON path '{version_check.json_path}' not found"
                        return result

                    version = str(matches[0].value)
                    result["version"] = version
                    result["success"] = True

                except Exception as e:
                    result["error_message"] = f"Failed to parse version: {str(e)}"
                    return result

        except httpx.TimeoutException:
            result["error_message"] = f"Request timed out after {version_check.timeout_seconds}s"
        except httpx.RequestError as e:
            result["error_message"] = f"Request failed: {str(e)}"
        except Exception as e:
            result["error_message"] = f"Unexpected error: {str(e)}"

        return result

    async def execute_and_store(self, version_check: VersionCheck) -> VersionCheckResult:
        """Execute check and store result in database"""

        result_data = await self.execute_check(version_check)

        # Create result record
        result = VersionCheckResult(
            version_check_id=version_check.id,
            version=result_data["version"],
            success=result_data["success"],
            response_time_ms=result_data["response_time_ms"],
            error_message=result_data["error_message"],
            checked_at=datetime.utcnow(),
        )
        self.session.add(result)

        # If version changed, create deployment record
        if result.success and result.version:
            await self._check_and_record_deployment(version_check.service_id, result.version)

        await self.session.commit()
        await self.session.refresh(result)

        return result

    async def _check_and_record_deployment(self, service_id: int, version: str) -> None:
        """Check if version changed and create deployment record"""

        # Get service
        result = await self.session.execute(
            select(Service).where(Service.id == service_id)
        )
        service = result.scalar_one_or_none()
        if not service:
            return

        # Update last check time
        service.last_version_check = datetime.utcnow()

        # Check if version changed
        if service.current_version == version:
            return

        # Version changed - create deployment record
        deployment = Deployment(
            service_id=service_id,
            version=version,
            detected_at=datetime.utcnow(),
        )
        self.session.add(deployment)

        # Update service's current version
        service.current_version = version

        print(f"Service {service_id}: New deployment detected - version {version}")

    async def execute_all_enabled_checks(self) -> None:
        """Execute all enabled version checks (called by background worker)"""

        # Get all enabled version checks
        result = await self.session.execute(
            select(VersionCheck).where(VersionCheck.enabled == True)
        )
        version_checks = result.scalars().all()

        # Execute checks concurrently
        tasks = [self.execute_and_store(check) for check in version_checks]
        await asyncio.gather(*tasks, return_exceptions=True)


class VersionChecker:
    """Legacy version checker for backward compatibility"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def check_version(self, service: Service) -> str | None:
        """Query version endpoint and extract version from JSON response"""

        if not service.version_url or not service.version_json_path:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(service.version_url, timeout=30)

                if response.status_code != 200:
                    print(f"Service {service.id}: Version endpoint returned {response.status_code}")
                    return None

                response_json = response.json()
                jsonpath_expr = parse(service.version_json_path)
                matches = jsonpath_expr.find(response_json)

                if not matches:
                    print(f"Service {service.id}: JSON path '{service.version_json_path}' not found")
                    return None

                version = str(matches[0].value)
                return version

        except httpx.RequestError as e:
            print(f"Service {service.id}: Request failed: {e}")
            return None
        except Exception as e:
            print(f"Service {service.id}: Version check failed: {e}")
            return None

    async def check_and_record(self, service: Service) -> Deployment | None:
        """Check version and create deployment record if version changed"""

        version = await self.check_version(service)

        # Update last check time
        service.last_version_check = datetime.utcnow()

        if not version:
            return None

        # Check if version changed
        if service.current_version == version:
            # No change, just update timestamp
            await self.session.commit()
            return None

        # Version changed - create deployment record
        deployment = Deployment(
            service_id=service.id,
            version=version,
            detected_at=datetime.utcnow(),
        )
        self.session.add(deployment)

        # Update service's current version
        service.current_version = version

        await self.session.commit()
        await self.session.refresh(deployment)

        print(f"Service {service.id}: New deployment detected - version {version}")

        return deployment

    async def check_all_services(self) -> None:
        """Check versions for all services with version tracking configured"""

        result = await self.session.execute(
            select(Service).where(
                Service.version_url.isnot(None),
                Service.version_json_path.isnot(None)
            )
        )
        services = result.scalars().all()

        for service in services:
            try:
                await self.check_and_record(service)
            except Exception as e:
                print(f"Error checking version for service {service.id}: {e}")
