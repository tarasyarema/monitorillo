import asyncio
from datetime import datetime, UTC

from sqlalchemy import select

from app.core.auth import async_session_maker
from app.services.health_checker import HealthCheckExecutor
from app.services.version_checker import VersionCheckExecutor, VersionChecker
from app.services.alert_evaluator import AlertEvaluator
from app.models.server import Server


async def alert_evaluation_worker():
    """Background worker that evaluates alerts for all servers"""

    print("Alert evaluation worker started")

    while True:
        try:
            async with async_session_maker() as session:
                # Get all servers
                result = await session.execute(select(Server))
                servers = result.scalars().all()

                # Evaluate alerts for each server in parallel
                tasks = []
                for server in servers:
                    evaluator = AlertEvaluator(session)
                    task = evaluator.evaluate_server_metrics(server.id)
                    tasks.append(task)

                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)

                print(f"[{datetime.now(UTC).isoformat()}] Evaluated alerts for {len(servers)} servers")
        except Exception as e:
            print(f"Error in alert evaluation worker: {e}")

        # Wait 1 minute before next execution
        await asyncio.sleep(60)


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
            print(f"Error in health check worker: {e}")

        # Wait 1 minute before next execution
        await asyncio.sleep(60)


async def run_all_workers():
    """Run all background workers concurrently"""
    await asyncio.gather(
        health_check_worker(),
        alert_evaluation_worker(),
    )


if __name__ == "__main__":
    asyncio.run(run_all_workers())
