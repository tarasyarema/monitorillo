from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class NotificationChannel(Base):
    """Notification channel for alerts (Slack, Email, etc.)"""

    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)  # "slack" or "email"
    name = Column(String, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)

    # Slack webhook URL
    slack_webhook_url = Column(String, nullable=True)

    # Email settings
    email_addresses = Column(Text, nullable=True)  # Comma-separated list

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    team = relationship("Team", back_populates="notification_channels")
