import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
import json
import hashlib
from collections import defaultdict

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class AlertType(str, Enum):
    COST_SPIKE = "COST_SPIKE"
    COST_ANOMALY = "COST_ANOMALY"
    ALARM_STATE_CHANGE = "ALARM_STATE_CHANGE"
    SECURITY_FINDING = "SECURITY_FINDING"
    HEALTH_CHECK_FAILURE = "HEALTH_CHECK_FAILURE"
    THRESHOLD_EXCEEDED = "THRESHOLD_EXCEEDED"


class AlertStatus(str, Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    SUPPRESSED = "SUPPRESSED"


class MonitoringAlert:
    def __init__(
        self,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        description: str,
        resource_id: Optional[str] = None,
        account_id: Optional[str] = None,
        timestamp: Optional[datetime] = None,
        metrics: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.alert_type = alert_type
        self.severity = severity
        self.title = title
        self.description = description
        self.resource_id = resource_id
        self.account_id = account_id
        self.timestamp = timestamp or datetime.utcnow()
        self.metrics = metrics or {}
        self.context = context or {}
        self.status = AlertStatus.NEW
        self.alert_id = self._generate_alert_id()

    def _generate_alert_id(self) -> str:
        content = f"{self.alert_type}{self.title}{self.resource_id}{self.account_id}".encode()
        return hashlib.md5(content).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "alert_type": self.alert_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "resource_id": self.resource_id,
            "account_id": self.account_id,
            "timestamp": self.timestamp.isoformat(),
            "metrics": self.metrics,
            "context": self.context,
            "status": self.status.value,
        }


class CostSpikDetector:
    def __init__(self, threshold_percent: float = 20.0, lookback_days: int = 30):
        self.ce_client = boto3.client("ce")
        self.threshold_percent = threshold_percent
        self.lookback_days = lookback_days

    async def detect_spikes(self, account_names: List[str]) -> List[MonitoringAlert]:
        alerts = []
        try:
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=self.lookback_days)

            cost_data = self.ce_client.get_cost_and_usage(
                TimePeriod={
                    "Start": start_date.isoformat(),
                    "End": end_date.isoformat(),
                },
                Granularity="DAILY",
                Metrics=["UnblendedCost"],
                GroupBy=[{"Type": "DIMENSION", "Key": "LINKED_ACCOUNT"}],
                Filter={
                    "Dimensions": {
                        "Key": "LINKED_ACCOUNT",
                        "Values": account_names,
                    }
                },
            )

            daily_costs = defaultdict(lambda: defaultdict(float))
            for result in cost_data.get("ResultsByTime", []):
                date = result["TimePeriod"]["Start"]
                for group in result.get("Groups", []):
                    account = group["Keys"][0]
                    cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
                    daily_costs[account][date] = cost

            for account, costs_by_date in daily_costs.items():
                sorted_dates = sorted(costs_by_date.keys())
                if len(sorted_dates) >= 2:
                    recent_cost = costs_by_date[sorted_dates[-1]]
                    previous_cost = sum(
                        costs_by_date[d] for d in sorted_dates[:-1]
                    ) / (len(sorted_dates) - 1)

                    if previous_cost > 0:
                        percent_increase = (
                            (recent_cost - previous_cost) / previous_cost
                        ) * 100
                        if percent_increase > self.threshold_percent:
                            severity = (
                                AlertSeverity.CRITICAL
                                if percent_increase > 50
                                else AlertSeverity.HIGH
                            )
                            alert = MonitoringAlert(
                                alert_type=AlertType.COST_SPIKE,
                                severity=severity,
                                title=f"Cost Spike Detected in Account {account}",
                                description=f"Cost increased by {percent_increase:.2f}% ({recent_cost:.2f} vs avg {previous_cost:.2f})",
                                account_id=account,
                                metrics={
                                    "current_cost": float(recent_cost),
                                    "average_cost": float(previous_cost),
                                    "percent_increase": float(percent_increase),
                                },
                            )
                            alerts.append(alert)
        except ClientError as e:
            logger.error(f"Error detecting cost spikes: {e}")

        return alerts


class AlarmMonitor:
    def __init__(self):
        self.cw_client = boto3.client("cloudwatch")
        self.previous_states: Dict[str, str] = {}

    async def check_alarms(self) -> List[MonitoringAlert]:
        alerts = []
        try:
            response = self.cw_client.describe_alarms(MaxRecords=100)
            alarms = response.get("MetricAlarms", [])

            for alarm in alarms:
                alarm_name = alarm["AlarmName"]
                current_state = alarm["StateValue"]

                prev_state = self.previous_states.get(alarm_name)
                if prev_state and prev_state != current_state:
                    severity = (
                        AlertSeverity.CRITICAL
                        if current_state == "ALARM"
                        else AlertSeverity.INFO
                    )
                    alert = MonitoringAlert(
                        alert_type=AlertType.ALARM_STATE_CHANGE,
                        severity=severity,
                        title=f"Alarm State Changed: {alarm_name}",
                        description=f"{alarm_name} changed from {prev_state} to {current_state}",
                        resource_id=alarm_name,
                        context={
                            "previous_state": prev_state,
                            "new_state": current_state,
                            "reason": alarm.get("StateReason", ""),
                        },
                    )
                    alerts.append(alert)

                self.previous_states[alarm_name] = current_state

        except ClientError as e:
            logger.error(f"Error checking alarms: {e}")

        return alerts


class SecurityFindingsMonitor:
    def __init__(self):
        self.securityhub_client = boto3.client("securityhub")
        self.processed_findings: set = set()

    async def check_security_findings(self) -> List[MonitoringAlert]:
        alerts = []
        try:
            response = self.securityhub_client.get_findings(
                Filters={
                    "RecordState": [{"Value": "ACTIVE", "Comparison": "EQUALS"}],
                    "SeverityLabel": [
                        {"Value": "CRITICAL", "Comparison": "EQUALS"},
                        {"Value": "HIGH", "Comparison": "EQUALS"},
                    ],
                },
                MaxResults=50,
            )

            for finding in response.get("Findings", []):
                finding_id = finding["Id"]
                if finding_id not in self.processed_findings:
                    self.processed_findings.add(finding_id)

                    severity_map = {
                        "CRITICAL": AlertSeverity.CRITICAL,
                        "HIGH": AlertSeverity.HIGH,
                        "MEDIUM": AlertSeverity.MEDIUM,
                        "LOW": AlertSeverity.LOW,
                        "INFORMATIONAL": AlertSeverity.INFO,
                    }
                    severity = severity_map.get(
                        finding.get("Severity", {}).get("Label", "MEDIUM"),
                        AlertSeverity.MEDIUM,
                    )

                    alert = MonitoringAlert(
                        alert_type=AlertType.SECURITY_FINDING,
                        severity=severity,
                        title=f"Security Finding: {finding.get('Title', 'Unknown')}",
                        description=finding.get("Description", ""),
                        resource_id=finding.get("Resources", [{}])[0].get("Id"),
                        context={
                            "finding_id": finding_id,
                            "resource_type": finding.get("Resources", [{}])[
                                0
                            ].get("Type"),
                            "compliance_status": finding.get("Compliance", {}).get(
                                "Status"
                            ),
                        },
                    )
                    alerts.append(alert)

        except ClientError as e:
            logger.error(f"Error checking security findings: {e}")

        return alerts


class AlertDeduplicator:
    def __init__(self, dedup_window_minutes: int = 60):
        self.dedup_window_minutes = dedup_window_minutes
        self.alert_history: Dict[str, MonitoringAlert] = {}

    def should_send_alert(self, alert: MonitoringAlert) -> bool:
        alert_key = alert.alert_id
        now = datetime.utcnow()

        if alert_key in self.alert_history:
            last_alert = self.alert_history[alert_key]
            time_diff = (now - last_alert.timestamp).total_seconds() / 60
            if time_diff < self.dedup_window_minutes:
                return False

        self.alert_history[alert_key] = alert
        return True


class ContinuousMonitor:
    def __init__(
        self,
        account_names: List[str],
        check_interval_minutes: int = 15,
        cost_spike_threshold: float = 20.0,
    ):
        self.account_names = account_names
        self.check_interval_minutes = check_interval_minutes
        self.cost_spike_threshold = cost_spike_threshold

        self.cost_detector = CostSpikDetector(threshold_percent=cost_spike_threshold)
        self.alarm_monitor = AlarmMonitor()
        self.security_monitor = SecurityFindingsMonitor()
        self.deduplicator = AlertDeduplicator()

        self.is_running = False
        self.alerts_queue: List[MonitoringAlert] = []

    async def run_monitoring_cycle(self) -> List[MonitoringAlert]:
        cycle_alerts = []

        cost_spike_alerts = await self.cost_detector.detect_spikes(
            self.account_names
        )
        cycle_alerts.extend(cost_spike_alerts)

        alarm_alerts = await self.alarm_monitor.check_alarms()
        cycle_alerts.extend(alarm_alerts)

        security_alerts = await self.security_monitor.check_security_findings()
        cycle_alerts.extend(security_alerts)

        deduplicated_alerts = [
            alert for alert in cycle_alerts if self.deduplicator.should_send_alert(alert)
        ]

        self.alerts_queue.extend(deduplicated_alerts)
        return deduplicated_alerts

    async def start(self):
        self.is_running = True
        logger.info(
            f"Starting continuous monitoring with {self.check_interval_minutes}m interval"
        )

        while self.is_running:
            try:
                alerts = await self.run_monitoring_cycle()
                if alerts:
                    logger.info(f"Generated {len(alerts)} alerts")
                await asyncio.sleep(self.check_interval_minutes * 60)
            except Exception as e:
                logger.error(f"Error in monitoring cycle: {e}")
                await asyncio.sleep(60)

    async def stop(self):
        self.is_running = False
        logger.info("Stopping continuous monitoring")

    def get_pending_alerts(self) -> List[MonitoringAlert]:
        alerts = self.alerts_queue.copy()
        self.alerts_queue.clear()
        return alerts


_monitoring_instance: Optional[ContinuousMonitor] = None


def get_continuous_monitor(
    account_names: List[str],
    check_interval_minutes: int = 15,
    cost_spike_threshold: float = 20.0,
) -> ContinuousMonitor:
    global _monitoring_instance
    if _monitoring_instance is None:
        _monitoring_instance = ContinuousMonitor(
            account_names=account_names,
            check_interval_minutes=check_interval_minutes,
            cost_spike_threshold=cost_spike_threshold,
        )
    return _monitoring_instance
