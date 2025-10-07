import asyncio
import json
from datetime import datetime
from typing import Dict, Any

import httpx
from jsonpath_ng import parse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import HealthCheck, HealthCheckResult, Service


class HealthCheckExecutor:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute_check(self, health_check: HealthCheck) -> Dict[str, Any]:
        """Execute a single health check and return result"""

        start_time = datetime.utcnow()
        result = {
            "success": False,
            "status_code": None,
            "response_time_ms": None,
            "error_message": None,
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=health_check.method,
                    url=health_check.url,
                    headers=health_check.headers or {},
                    content=health_check.body,
                    timeout=health_check.timeout_seconds,
                )

                end_time = datetime.utcnow()
                response_time_ms = int((end_time - start_time).total_seconds() * 1000)

                result["status_code"] = response.status_code
                result["response_time_ms"] = response_time_ms

                # Check status code
                if response.status_code != health_check.expected_status_code:
                    result["error_message"] = (
                        f"Expected status {health_check.expected_status_code}, "
                        f"got {response.status_code}"
                    )
                    return result

                # Check JSON path if configured
                if health_check.json_path and health_check.expected_value:
                    try:
                        response_json = response.json()
                        jsonpath_expr = parse(health_check.json_path)
                        matches = jsonpath_expr.find(response_json)

                        if not matches:
                            result["error_message"] = f"JSON path '{health_check.json_path}' not found"
                            return result

                        actual_value = str(matches[0].value)
                        if actual_value != health_check.expected_value:
                            result["error_message"] = (
                                f"Expected '{health_check.expected_value}' at '{health_check.json_path}', "
                                f"got '{actual_value}'"
                            )
                            return result
                    except json.JSONDecodeError:
                        result["error_message"] = "Response is not valid JSON"
                        return result
                    except Exception as e:
                        result["error_message"] = f"JSON path validation failed: {str(e)}"
                        return result

                # All checks passed
                result["success"] = True

        except httpx.TimeoutException:
            result["error_message"] = f"Request timed out after {health_check.timeout_seconds}s"
        except httpx.RequestError as e:
            result["error_message"] = f"Request failed: {str(e)}"
        except Exception as e:
            result["error_message"] = f"Unexpected error: {str(e)}"

        return result

    async def execute_and_store(self, health_check: HealthCheck) -> HealthCheckResult:
        """Execute check and store result in database"""

        result_data = await self.execute_check(health_check)

        # Create result record
        result = HealthCheckResult(
            health_check_id=health_check.id,
            success=result_data["success"],
            status_code=result_data["status_code"],
            response_time_ms=result_data["response_time_ms"],
            error_message=result_data["error_message"],
            checked_at=datetime.utcnow(),
        )
        self.session.add(result)

        # Update service status based on health check results
        await self._update_service_status(health_check.service_id)

        await self.session.commit()
        await self.session.refresh(result)

        return result

    async def _update_service_status(self, service_id: int) -> None:
        """Update service status based on recent health check results"""

        # Get service
        result = await self.session.execute(
            select(Service).where(Service.id == service_id)
        )
        service = result.scalar_one_or_none()
        if not service:
            return

        # Get all health checks for this service
        result = await self.session.execute(
            select(HealthCheck).where(
                HealthCheck.service_id == service_id,
                HealthCheck.enabled == True
            )
        )
        health_checks = result.scalars().all()

        if not health_checks:
            service.status = "unknown"
            return

        # Check latest result for each health check
        failed_checks = 0
        total_checks = len(health_checks)

        for check in health_checks:
            result = await self.session.execute(
                select(HealthCheckResult)
                .where(HealthCheckResult.health_check_id == check.id)
                .order_by(HealthCheckResult.checked_at.desc())
                .limit(1)
            )
            latest_result = result.scalar_one_or_none()

            if not latest_result or not latest_result.success:
                failed_checks += 1

        # Determine service status
        if failed_checks == 0:
            service.status = "healthy"
        elif failed_checks == total_checks:
            service.status = "unhealthy"
        else:
            service.status = "degraded"

        service.updated_at = datetime.utcnow()

    async def execute_all_enabled_checks(self) -> None:
        """Execute all enabled health checks (called by background worker)"""

        # Get all enabled health checks
        result = await self.session.execute(
            select(HealthCheck).where(HealthCheck.enabled == True)
        )
        health_checks = result.scalars().all()

        # Execute checks concurrently
        tasks = [self.execute_and_store(check) for check in health_checks]
        await asyncio.gather(*tasks, return_exceptions=True)
