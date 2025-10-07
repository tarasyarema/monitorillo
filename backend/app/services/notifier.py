import os
import httpx
import resend
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationChannel
from app.models.alert import Alert


class NotificationService:
    """Service for sending notifications via Slack and Email"""

    def __init__(self, session: AsyncSession):
        from app.core.config import settings

        self.session = session
        self.base_url = settings.FRONTEND_URL

        # Initialize Resend API key
        resend.api_key = settings.RESEND_API_KEY

    async def send_alert_notification(self, alert: Alert, alert_type: str = "new"):
        """Send notifications for an alert"""
        from app.models.alert import Notification
        from datetime import datetime

        # Get notification channels for the team
        result = await self.session.execute(
            select(NotificationChannel).where(
                NotificationChannel.team_id == alert.team_id,
                NotificationChannel.enabled == True
            )
        )
        channels = result.scalars().all()

        print(f"[Notifications] Sending alert {alert.id} to {len(channels)} channels")

        for channel in channels:
            notification = None
            try:
                # Determine recipient
                recipient = ""
                if channel.type == "slack":
                    recipient = channel.slack_webhook_url or "No webhook configured"
                elif channel.type == "email":
                    recipient = channel.email_addresses or "No email configured"

                # Create notification record
                notification = Notification(
                    alert_id=alert.id,
                    channel=channel.type,
                    recipient=recipient,
                    status="pending",
                    created_at=datetime.utcnow()
                )
                self.session.add(notification)
                await self.session.flush()  # Get notification ID

                # Send notification
                if channel.type == "slack" and channel.slack_webhook_url:
                    await self._send_slack_notification(channel, alert, alert_type)
                    notification.status = "sent"
                    notification.sent_at = datetime.utcnow()
                    print(f"[Notifications] ✓ Sent Slack notification {notification.id}")
                elif channel.type == "email" and channel.email_addresses:
                    await self._send_email_notification(channel, alert, alert_type)
                    notification.status = "sent"
                    notification.sent_at = datetime.utcnow()
                    print(f"[Notifications] ✓ Sent Email notification {notification.id}")
                else:
                    notification.status = "failed"
                    notification.error_message = "Channel not configured"
                    print(f"[Notifications] ✗ Channel {channel.type} not properly configured")

            except Exception as e:
                print(f"[Notifications] ✗ Error sending notification via {channel.type}: {e}")
                if notification:
                    notification.status = "failed"
                    notification.error_message = str(e)

    async def _send_slack_notification(self, channel: NotificationChannel, alert: Alert, alert_type: str):
        """Send Slack notification"""
        from app.models.server import Server
        from app.models.service import Service

        # Get server details
        server = None
        if alert.server_id:
            result = await self.session.execute(
                select(Server).where(Server.id == alert.server_id)
            )
            server = result.scalar_one_or_none()

        # Get service details for health check/version check alerts
        service = None
        if alert.service_id:
            result = await self.session.execute(
                select(Service).where(Service.id == alert.service_id)
            )
            service = result.scalar_one_or_none()

        # Build Slack message
        if alert_type == "resolved":
            emoji = "✅"
            color = "#10b981"  # Green
        elif alert.severity == "critical":
            emoji = "🚨"
            color = "#dc2626"  # Red
        else:
            emoji = "⚠️"
            color = "#f59e0b"  # Orange

        server_link = f"{self.base_url}/servers/{alert.server_id}" if alert.server_id else ""
        service_link = f"{self.base_url}/services/{alert.service_id}" if alert.service_id else ""
        alert_link = f"{self.base_url}/alerts"

        # Build fields based on alert type
        fields = []

        if alert.server_id and server:
            fields.append({
                "type": "mrkdwn",
                "text": f"*Server:*\n{server.name}"
            })

        if alert.service_id and service:
            fields.append({
                "type": "mrkdwn",
                "text": f"*Service:*\n{service.name}"
            })

        if alert.metric_type:
            # Server metric alert
            fields.extend([
                {
                    "type": "mrkdwn",
                    "text": f"*Metric:*\n{alert.metric_type.upper()}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Current Value:*\n{alert.current_value:.1f}%"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Threshold:*\n{alert.threshold_value:.1f}%"
                }
            ])

        # Build action buttons
        actions = []
        if server_link:
            actions.append({
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "View Server"
                },
                "url": server_link
            })
        if service_link:
            actions.append({
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "View Service"
                },
                "url": service_link
            })
        actions.append({
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": "View All Alerts"
            },
            "url": alert_link
        })

        # Build message title based on alert type
        if alert_type == "resolved":
            title = f"{emoji} *RESOLVED: {alert.message}*"
        elif alert_type == "reminder":
            title = f"{emoji} *REMINDER - {alert.severity.upper()} Alert: {alert.message}*"
        else:  # new
            title = f"{emoji} *{alert.severity.upper()} Alert: {alert.message}*"

        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": title
                }
            }
        ]

        if fields:
            blocks.append({
                "type": "section",
                "fields": fields
            })

        if actions:
            blocks.append({
                "type": "actions",
                "elements": actions
            })

        payload = {
            "attachments": [
                {
                    "color": color,
                    "blocks": blocks
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(channel.slack_webhook_url, json=payload)
            if response.status_code != 200:
                raise Exception(f"Slack API error: {response.status_code}")

    async def _send_email_notification(self, channel: NotificationChannel, alert: Alert, alert_type: str):
        """Send Email notification"""
        from app.models.server import Server
        from app.models.service import Service

        # Get server details
        server = None
        if alert.server_id:
            result = await self.session.execute(
                select(Server).where(Server.id == alert.server_id)
            )
            server = result.scalar_one_or_none()

        # Get service details for health check/version check alerts
        service = None
        if alert.service_id:
            result = await self.session.execute(
                select(Service).where(Service.id == alert.service_id)
            )
            service = result.scalar_one_or_none()

        # Build email content
        server_link = f"{self.base_url}/servers/{alert.server_id}" if alert.server_id else ""
        service_link = f"{self.base_url}/services/{alert.service_id}" if alert.service_id else ""
        alert_link = f"{self.base_url}/alerts"

        # Build subject based on alert type
        if alert_type == "resolved":
            subject = f"[RESOLVED] {alert.message}"
        elif alert_type == "reminder":
            subject = f"[REMINDER - {alert.severity.upper()}] {alert.message}"
        else:  # new
            subject = f"[{alert.severity.upper()}] {alert.message}"

        # Build body based on alert type
        details = ["Alert Details:", "--------------"]

        if alert_type == "resolved":
            details.append("Status: ✅ RESOLVED")
        elif alert_type == "reminder":
            details.append(f"Status: 🔔 REMINDER (Alert still active)")
        else:
            details.append(f"Status: 🚨 NEW ALERT")

        details.append("")

        if server:
            details.append(f"Server: {server.name} ({server.hostname})")

        if service:
            details.append(f"Service: {service.name}")

        if alert.metric_type:
            # Server metric alert
            details.extend([
                f"Metric: {alert.metric_type.upper()}",
                f"Current Value: {alert.current_value:.1f}%",
                f"Threshold: {alert.threshold_value:.1f}%"
            ])

        details.append(f"Severity: {alert.severity.upper()}")
        details.append("")
        details.append(f"Message: {alert.message}")
        details.append("")
        details.append("Actions:")
        details.append("--------")

        if server_link:
            details.append(f"View Server: {server_link}")
        if service_link:
            details.append(f"View Service: {service_link}")

        details.append(f"View All Alerts: {alert_link}")
        details.append("")
        details.append("---")
        details.append("This alert was generated by Monitorillo")

        body = "\n".join(details)

        # Send email using Resend
        if not resend.api_key:
            raise Exception("RESEND_API_KEY not configured")

        # Parse email addresses (comma-separated)
        email_list = [email.strip() for email in channel.email_addresses.split(",")]

        # Get sender email (already configured in settings)
        from_email = os.getenv("ALERT_EMAIL_FROM", "alerts@monitorillo.com")

        # Send email to all recipients at once
        params = {
            "from": from_email,
            "to": email_list,
            "subject": subject,
            "text": body,
        }

        response = resend.Emails.send(params)
        print(f"[Email] Sent to {len(email_list)} recipient(s), ID: {response.get('id', 'unknown')}")
