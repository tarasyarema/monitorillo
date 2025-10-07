from datetime import datetime, timedelta
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertConfig, Notification
from app.models.server import Server, Metric
from app.services.notifier import NotificationService


class AlertEvaluator:
    """Evaluates metrics against alert thresholds"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def evaluate_server_metrics(self, server_id: int):
        """Evaluate latest metrics for a server against alert configs"""
        # Get server
        result = await self.session.execute(
            select(Server).where(Server.id == server_id)
        )
        server = result.scalar_one_or_none()
        if not server:
            return

        # Get alert configs for this server and team defaults
        result = await self.session.execute(
            select(AlertConfig).where(
                and_(
                    AlertConfig.enabled == True,
                    (AlertConfig.server_id == server_id) |
                    (and_(AlertConfig.server_id == None, AlertConfig.team_id == server.team_id))
                )
            )
        )
        configs = result.scalars().all()

        # Get latest system metric
        result = await self.session.execute(
            select(Metric)
            .where(
                Metric.server_id == server_id,
                Metric.metric_type == "system"
            )
            .order_by(desc(Metric.timestamp))
            .limit(1)
        )
        latest_metric = result.scalar_one_or_none()

        if not latest_metric:
            return

        # Evaluate each config
        for config in configs:
            await self._evaluate_config(server, config, latest_metric)

        await self.session.commit()

    async def _evaluate_config(self, server: Server, config: AlertConfig, metric: Metric):
        """Evaluate a single alert config against a metric"""
        value = None
        metric_name = None

        # Extract the relevant value based on metric type
        if config.metric_type == "cpu":
            value = metric.value.get("cpu", {}).get("usage_percent")
            metric_name = "CPU Usage"
        elif config.metric_type == "memory":
            value = metric.value.get("memory", {}).get("used_percent")
            metric_name = "Memory Usage"
        elif config.metric_type == "disk":
            # Use root partition
            partitions = metric.value.get("disk", {}).get("partitions", {})
            root = partitions.get("/") or partitions.get("/System/Volumes/Data")
            if root:
                value = root.get("used_percent")
            metric_name = "Disk Usage"

        if value is None:
            return

        # Determine severity
        severity = None
        threshold = None
        if value >= config.critical_threshold:
            severity = "critical"
            threshold = config.critical_threshold
        elif value >= config.warning_threshold:
            severity = "warning"
            threshold = config.warning_threshold

        if severity:
            # Check if alert already exists
            result = await self.session.execute(
                select(Alert).where(
                    and_(
                        Alert.server_id == server.id,
                        Alert.metric_type == config.metric_type,
                        Alert.state.in_(["new", "acknowledged"])
                    )
                )
            )
            existing_alert = result.scalar_one_or_none()

            if existing_alert:
                # Update existing alert
                existing_alert.current_value = value
                existing_alert.updated_at = datetime.utcnow()
                existing_alert.last_triggered_at = datetime.utcnow()
                existing_alert.severity = severity
                existing_alert.threshold_value = threshold

                # Check if we should re-send notification (after 10 minutes threshold)
                result = await self.session.execute(
                    select(Notification)
                    .where(Notification.alert_id == existing_alert.id)
                    .order_by(Notification.sent_at.desc())
                    .limit(1)
                )
                last_notification = result.scalar_one_or_none()

                should_resend = False
                if last_notification and last_notification.sent_at:
                    time_since_last = datetime.utcnow() - last_notification.sent_at
                    if time_since_last > timedelta(minutes=10):
                        should_resend = True
                elif not last_notification:
                    # No notification was ever sent (shouldn't happen, but handle it)
                    should_resend = True

                if should_resend:
                    notifier = NotificationService(self.session)
                    await notifier.send_alert_notification(existing_alert, "reminder")
            else:
                # Create new alert
                alert = Alert(
                    team_id=server.team_id,
                    server_id=server.id,
                    metric_type=config.metric_type,
                    severity=severity,
                    state="new",
                    threshold_value=threshold,
                    current_value=value,
                    message=f"{metric_name} is at {value:.1f}% (threshold: {threshold}%)"
                )
                self.session.add(alert)

                # Update server status
                if severity == "critical":
                    server.status = "critical"
                elif severity == "warning" and server.status != "critical":
                    server.status = "warning"

                # Send notifications for new alert
                await self.session.flush()  # Ensure alert has an ID
                notifier = NotificationService(self.session)
                await notifier.send_alert_notification(alert, "new")
        else:
            # Value is below thresholds - auto-resolve any existing alerts
            result = await self.session.execute(
                select(Alert).where(
                    and_(
                        Alert.server_id == server.id,
                        Alert.metric_type == config.metric_type,
                        Alert.state.in_(["new", "acknowledged"])
                    )
                )
            )
            existing_alert = result.scalar_one_or_none()

            if existing_alert:
                existing_alert.state = "resolved"
                existing_alert.resolved_at = datetime.utcnow()

                # Send resolved notification
                notifier = NotificationService(self.session)
                await notifier.send_alert_notification(existing_alert, "resolved")

                # Check if we should update server status back to online
                result = await self.session.execute(
                    select(Alert).where(
                        and_(
                            Alert.server_id == server.id,
                            Alert.state.in_(["new", "acknowledged"])
                        )
                    )
                )
                active_alerts = result.scalars().all()

                if not active_alerts:
                    server.status = "online"
