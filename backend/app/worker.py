import asyncio
from datetime import datetime, UTC

from app.core.auth import async_session_maker
from app.services.health_checker import HealthCheckExecutor
from app.services.version_checker import VersionCheckExecutor, VersionChecker


async def health_check_worker():
    """Background worker that executes health checks and version checks every minute"""

    print("Health check and version check worker started")

    while True:
        try:
            async with async_session_maker() as session:
                # Execute health checks
                health_executor = HealthCheckExecutor(session)
                await health_executor.execute_all_enabled_checks()

                # Execute version checks (new model-based checks)
                version_executor = VersionCheckExecutor(session)
                await version_executor.execute_all_enabled_checks()

                # Execute legacy version checks (for services without VersionCheck models)
                version_checker = VersionChecker(session)
                await version_checker.check_all_services()

                print(f"[{datetime.now(UTC).isoformat()}] Executed health checks and version checks")
        except Exception as e:
            print(f"Error in worker: {e}")

        # Wait 1 minute before next execution
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(health_check_worker())
