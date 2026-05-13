import logging
from typing import Dict, List, Optional, Any
from enum import Enum
from abc import ABC, abstractmethod
import aiohttp
import json
from datetime import datetime
import os

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    TEAMS = "TEAMS"
    SLACK = "SLACK"
    EMAIL = "EMAIL"
    SMS = "SMS"
    WEBHOOK = "WEBHOOK"


class NotificationChannelHandler(ABC):
    @abstractmethod
    async def send(self, title: str, message: str, alert_data: Dict[str, Any]) -> bool:
        pass


class TeamsNotificationHandler(NotificationChannelHandler):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        if not webhook_url:
            logger.warning("Teams webhook URL not configured")

    async def send(
        self, title: str, message: str, alert_data: Dict[str, Any]
    ) -> bool:
        if not self.webhook_url:
            logger.warning("Teams webhook URL is not set, skipping notification")
            return False

        try:
            severity = alert_data.get("severity", "INFO")
            alert_type = alert_data.get("alert_type", "UNKNOWN")
            timestamp = alert_data.get("timestamp", datetime.utcnow().isoformat())

            color_map = {
                "CRITICAL": "FF0000",
                "HIGH": "FF6600",
                "MEDIUM": "FFA500",
                "LOW": "FFFF00",
                "INFO": "0078D4",
            }
            color = color_map.get(severity, "0078D4")

            payload = {
                "@type": "MessageCard",
                "@context": "https://schema.org/extensions",
                "summary": title,
                "themeColor": color,
                "sections": [
                    {
                        "activityTitle": title,
                        "activitySubtitle": f"[{severity}] {alert_type}",
                        "facts": [
                            {"name": "Severity", "value": severity},
                            {"name": "Alert Type", "value": alert_type},
                            {"name": "Timestamp", "value": timestamp},
                            {
                                "name": "Account",
                                "value": alert_data.get("account_id", "N/A"),
                            },
                            {
                                "name": "Resource",
                                "value": alert_data.get("resource_id", "N/A"),
                            },
                        ],
                        "text": message,
                        "markdown": True,
                    }
                ],
                "potentialAction": [
                    {
                        "@type": "ViewAction",
                        "name": "View in Dashboard",
                        "target": [os.getenv("DASHBOARD_URL", "http://localhost:3000")],
                    }
                ],
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.info(f"Teams notification sent successfully for {title}")
                        return True
                    else:
                        logger.error(
                            f"Teams notification failed with status {response.status}"
                        )
                        return False

        except Exception as e:
            logger.error(f"Error sending Teams notification: {e}")
            return False


class SlackNotificationHandler(NotificationChannelHandler):
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        if not webhook_url:
            logger.warning("Slack webhook URL not configured")

    async def send(
        self, title: str, message: str, alert_data: Dict[str, Any]
    ) -> bool:
        if not self.webhook_url:
            logger.warning("Slack webhook URL is not set, skipping notification")
            return False

        try:
            severity = alert_data.get("severity", "INFO")
            alert_type = alert_data.get("alert_type", "UNKNOWN")

            color_map = {
                "CRITICAL": "danger",
                "HIGH": "danger",
                "MEDIUM": "warning",
                "LOW": "warning",
                "INFO": "good",
            }
            color = color_map.get(severity, "good")

            payload = {
                "attachments": [
                    {
                        "color": color,
                        "title": title,
                        "title_link": os.getenv("DASHBOARD_URL", "http://localhost:3000"),
                        "fields": [
                            {
                                "title": "Severity",
                                "value": severity,
                                "short": True,
                            },
                            {
                                "title": "Alert Type",
                                "value": alert_type,
                                "short": True,
                            },
                            {
                                "title": "Account",
                                "value": alert_data.get("account_id", "N/A"),
                                "short": True,
                            },
                            {
                                "title": "Resource",
                                "value": alert_data.get("resource_id", "N/A"),
                                "short": True,
                            },
                        ],
                        "text": message,
                        "footer": "AWS MSP Smart Agent",
                        "ts": int(
                            datetime.fromisoformat(
                                alert_data.get("timestamp", datetime.utcnow().isoformat())
                            ).timestamp()
                        ),
                    }
                ]
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        logger.info(f"Slack notification sent successfully for {title}")
                        return True
                    else:
                        logger.error(
                            f"Slack notification failed with status {response.status}"
                        )
                        return False

        except Exception as e:
            logger.error(f"Error sending Slack notification: {e}")
            return False


class EmailNotificationHandler(NotificationChannelHandler):
    def __init__(self, smtp_config: Dict[str, str]):
        self.smtp_config = smtp_config

    async def send(
        self, title: str, message: str, alert_data: Dict[str, Any]
    ) -> bool:
        logger.info(f"Email notification would be sent for: {title}")
        return True


class SMSNotificationHandler(NotificationChannelHandler):
    def __init__(self, sns_topic_arn: str):
        self.sns_topic_arn = sns_topic_arn

    async def send(
        self, title: str, message: str, alert_data: Dict[str, Any]
    ) -> bool:
        logger.info(f"SMS notification would be sent for: {title}")
        return True


class NotificationService:
    def __init__(self):
        self.handlers: Dict[NotificationChannel, NotificationChannelHandler] = {}
        self._initialize_handlers()

    def _initialize_handlers(self):
        teams_webhook = os.getenv("TEAMS_WEBHOOK_URL")
        if teams_webhook:
            self.handlers[NotificationChannel.TEAMS] = TeamsNotificationHandler(
                teams_webhook
            )

        slack_webhook = os.getenv("SLACK_WEBHOOK_URL")
        if slack_webhook:
            self.handlers[NotificationChannel.SLACK] = SlackNotificationHandler(
                slack_webhook
            )

        self.handlers[NotificationChannel.EMAIL] = EmailNotificationHandler({})
        self.handlers[NotificationChannel.SMS] = SMSNotificationHandler("")

    async def notify(
        self,
        title: str,
        message: str,
        alert_data: Dict[str, Any],
        channels: Optional[List[NotificationChannel]] = None,
    ) -> Dict[NotificationChannel, bool]:
        if channels is None:
            channels = [
                NotificationChannel.TEAMS,
                NotificationChannel.SLACK,
            ]

        results = {}
        for channel in channels:
            if channel in self.handlers:
                try:
                    results[channel] = await self.handlers[channel].send(
                        title, message, alert_data
                    )
                except Exception as e:
                    logger.error(f"Error sending {channel.value} notification: {e}")
                    results[channel] = False
            else:
                logger.warning(f"Handler not configured for channel: {channel.value}")
                results[channel] = False

        return results

    async def notify_cost_spike(
        self,
        account_id: str,
        current_cost: float,
        previous_cost: float,
        percent_increase: float,
    ) -> Dict[NotificationChannel, bool]:
        title = f"🚨 Cost Spike Alert - Account {account_id}"
        message = (
            f"**Cost increased by {percent_increase:.2f}%**\n\n"
            f"Current: ${current_cost:.2f}\n"
            f"Previous Average: ${previous_cost:.2f}\n"
            f"Difference: ${current_cost - previous_cost:.2f}\n\n"
            f"**Action Required:** Review recent resource changes or unexpected spikes in usage."
        )
        alert_data = {
            "severity": "CRITICAL" if percent_increase > 50 else "HIGH",
            "alert_type": "COST_SPIKE",
            "account_id": account_id,
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": {
                "current_cost": current_cost,
                "previous_cost": previous_cost,
                "percent_increase": percent_increase,
            },
        }
        return await self.notify(title, message, alert_data)

    async def notify_alarm_state_change(
        self,
        alarm_name: str,
        previous_state: str,
        new_state: str,
        reason: str = "",
    ) -> Dict[NotificationChannel, bool]:
        severity = "CRITICAL" if new_state == "ALARM" else "INFO"
        title = f"⚠️ Alarm State Changed - {alarm_name}"
        message = (
            f"**Alarm: {alarm_name}**\n\n"
            f"State: {previous_state} → **{new_state}**\n"
        )
        if reason:
            message += f"Reason: {reason}\n"

        alert_data = {
            "severity": severity,
            "alert_type": "ALARM_STATE_CHANGE",
            "resource_id": alarm_name,
            "timestamp": datetime.utcnow().isoformat(),
        }
        return await self.notify(title, message, alert_data)

    async def notify_security_finding(
        self,
        finding_title: str,
        finding_description: str,
        resource_id: str,
        severity: str,
    ) -> Dict[NotificationChannel, bool]:
        title = f"🔒 Security Finding - {severity}"
        message = (
            f"**{finding_title}**\n\n"
            f"Resource: {resource_id}\n"
            f"Severity: {severity}\n\n"
            f"{finding_description}\n\n"
            f"**Action Required:** Review and remediate this security finding immediately."
        )
        alert_data = {
            "severity": severity,
            "alert_type": "SECURITY_FINDING",
            "resource_id": resource_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
        return await self.notify(title, message, alert_data)


_notification_service: Optional[NotificationService] = None


def get_notification_service() -> NotificationService:
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
