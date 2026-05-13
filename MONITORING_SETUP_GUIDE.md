# Continuous Monitoring & Autonomous Alerts Setup Guide

**Version:** 1.0  
**Date:** May 2026  
**Status:** Phase 3A Implementation Complete ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Prerequisites](#prerequisites)
4. [Setup Instructions](#setup-instructions)
5. [Configuration](#configuration)
6. [Usage](#usage)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)

---

## Overview

The Continuous Monitoring & Autonomous Alerts system provides 24/7 automated monitoring of your AWS environment. It continuously detects:

- **Cost Spikes**: Identifies unusual increases in daily AWS costs
- **Alarm State Changes**: Monitors CloudWatch alarms and detects transitions
- **Security Findings**: Detects new high/critical security findings from Security Hub

When alerts are triggered, the system automatically sends notifications to your configured notification channels (Microsoft Teams, Slack, or both).

---

## Features

### Alert Detection

| Alert Type | Description | Severity | Detection Interval |
|-----------|-------------|----------|-------------------|
| **Cost Spike** | Daily cost increases >20% (configurable) | HIGH/CRITICAL | Every 15 minutes |
| **Alarm State Change** | CloudWatch alarm transitions (OK → ALARM) | INFO/CRITICAL | Every 15 minutes |
| **Security Finding** | New HIGH/CRITICAL vulnerabilities detected | HIGH/CRITICAL | Every 15 minutes |

### Alert Deduplication

Prevents alert fatigue by:
- Tracking alert history with 60-minute deduplication windows
- Grouping similar alerts by type, resource, and account
- Suppressing duplicate notifications within the window
- Allowing manual alert acknowledgment

### Notification Channels

#### Microsoft Teams
- Rich message formatting with color-coded severity
- One-click dashboard links
- Action buttons for quick access

#### Slack
- Structured message attachments
- Color-coded severity indicators
- Linked resources and metrics

---

## Prerequisites

### AWS IAM Permissions

The monitoring service requires these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetAnomalyMonitors",
        "ce:GetAnomalies"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:DescribeAlarms",
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "securityhub:GetFindings",
        "securityhub:DescribeHub"
      ],
      "Resource": "*"
    }
  ]
}
```

### External Requirements

1. **Microsoft Teams** (optional)
   - Incoming Webhook URL from Teams channel
   - Webhook format: `https://outlook.webhook.office.com/webhookb2/...`

2. **Slack** (optional)
   - Incoming Webhook URL from Slack workspace
   - Webhook format: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`

3. **Backend Requirements**
   - Python 3.9+
   - FastAPI application running
   - AWS credentials configured

---

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

The package includes the new `aiohttp==3.10.11` for async webhook notifications.

### Step 2: Configure Environment Variables

Create or update your `.env` file in the `backend/` directory:

```env
# Continuous Monitoring Configuration
MONITORING_ENABLED=true
MONITORING_CHECK_INTERVAL_MINUTES=15
MONITORING_COST_SPIKE_THRESHOLD=20.0

# Notification Configuration - Microsoft Teams
TEAMS_WEBHOOK_URL=https://outlook.webhook.office.com/webhookb2/...

# Notification Configuration - Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX

# Dashboard URL for notification links
DASHBOARD_URL=https://yourdomain.com
```

### Step 3: Verify AWS Permissions

Test that your AWS credentials have the required permissions:

```bash
# Test Cost Explorer access
aws ce get-cost-and-usage --time-period Start=2026-05-01,End=2026-05-13 --granularity DAILY --metrics UnblendedCost

# Test CloudWatch access
aws cloudwatch describe-alarms --max-records 1

# Test Security Hub access
aws securityhub get-findings --max-results 1
```

### Step 4: Start the Monitoring Service

The monitoring service can be started via the API:

```bash
curl -X POST http://localhost:8000/monitoring/start \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or via the UI in the Monitoring Dashboard.

---

## Configuration

### Monitoring Parameters

#### Cost Spike Detection

```env
MONITORING_COST_SPIKE_THRESHOLD=20.0  # Percentage increase threshold (default: 20%)
```

- **20%**: Recommended for most environments
- **10%**: More sensitive, higher alert volume
- **50%**: Less sensitive, only major spikes

#### Check Interval

```env
MONITORING_CHECK_INTERVAL_MINUTES=15  # Check every 15 minutes
```

- **5 minutes**: Real-time monitoring (higher API calls)
- **15 minutes**: Balanced monitoring (recommended)
- **60 minutes**: Hourly monitoring (lower costs)

#### Notification Channels

Enable/disable channels by setting/unsetting their webhook URLs:

```env
# Both enabled
TEAMS_WEBHOOK_URL=https://outlook.webhook.office.com/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Teams only
TEAMS_WEBHOOK_URL=https://outlook.webhook.office.com/...
# SLACK_WEBHOOK_URL=  (not set)

# Slack only
# TEAMS_WEBHOOK_URL=  (not set)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Alert Severity Mapping

| Condition | Severity | Example |
|-----------|----------|---------|
| Cost increase > 50% | CRITICAL | Day went from $10 to $15+ |
| Cost increase 20-50% | HIGH | Day went from $10 to $12 |
| Alarm: OK → ALARM | CRITICAL | Critical service alarm triggered |
| Alarm: ALARM → OK | INFO | Alarm resolved |
| Security: CRITICAL finding | CRITICAL | CVSS 9.0+ vulnerability |
| Security: HIGH finding | HIGH | CVSS 7.0-8.9 vulnerability |

---

## Usage

### Start Monitoring

**API Endpoint:**
```bash
POST /monitoring/start
```

**Parameters:**
- `check_interval_minutes` (optional): Check interval in minutes (default: 15)
- `cost_spike_threshold` (optional): Cost spike threshold percentage (default: 20.0)

**Response:**
```json
{
  "success": true,
  "message": "Continuous monitoring started",
  "config": {
    "check_interval_minutes": 15,
    "cost_spike_threshold": 20.0,
    "monitored_accounts": 3
  }
}
```

### Stop Monitoring

**API Endpoint:**
```bash
POST /monitoring/stop
```

**Response:**
```json
{
  "success": true,
  "message": "Continuous monitoring stopped"
}
```

### Get Monitoring Status

**API Endpoint:**
```bash
GET /monitoring/status
```

**Response:**
```json
{
  "success": true,
  "status": "running",
  "is_running": true,
  "configuration": {
    "check_interval_minutes": 15,
    "cost_spike_threshold": 20.0,
    "monitored_accounts": 3
  },
  "alerts_pending": 2
}
```

### Retrieve Pending Alerts

**API Endpoint:**
```bash
GET /monitoring/alerts
```

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "alert_id": "abc123def456",
      "alert_type": "COST_SPIKE",
      "severity": "HIGH",
      "title": "Cost Spike Detected in Account 123456789",
      "description": "Cost increased by 25.5% ($10.50 vs avg $8.34)",
      "account_id": "123456789",
      "timestamp": "2026-05-13T15:30:00",
      "metrics": {
        "current_cost": 10.50,
        "average_cost": 8.34,
        "percent_increase": 25.5
      },
      "status": "NEW"
    }
  ],
  "count": 1
}
```

### Send Test Notification

**API Endpoint:**
```bash
POST /monitoring/send-test-alert
```

**Parameters:**
- `channel` (required): TEAMS or SLACK

**Response:**
```json
{
  "success": true,
  "message": "Test alert sent to TEAMS",
  "results": {
    "TEAMS": true
  }
}
```

### Configure Notification Webhook

**API Endpoint:**
```bash
POST /monitoring/configure-notification
```

**Parameters:**
- `channel` (required): TEAMS or SLACK
- `webhook_url` (required): Full webhook URL

**Response:**
```json
{
  "success": true,
  "message": "Teams webhook URL configured successfully",
  "channel": "TEAMS"
}
```

---

## API Reference

### Monitoring Service

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/monitoring/start` | Start continuous monitoring |
| POST | `/monitoring/stop` | Stop continuous monitoring |
| GET | `/monitoring/status` | Get monitoring status |
| GET | `/monitoring/alerts` | Get pending alerts |
| POST | `/monitoring/send-test-alert` | Send test notification |
| POST | `/monitoring/configure-notification` | Configure webhook URL |

### Alert Object

```typescript
interface MonitoringAlert {
  alert_id: string;                    // Unique alert identifier
  alert_type: string;                  // COST_SPIKE | ALARM_STATE_CHANGE | SECURITY_FINDING
  severity: string;                    // CRITICAL | HIGH | MEDIUM | LOW | INFO
  title: string;                       // Alert title
  description: string;                 // Alert description
  resource_id?: string;                // AWS resource identifier
  account_id?: string;                 // AWS account ID
  timestamp: string;                   // ISO 8601 timestamp
  metrics?: Record<string, any>;       // Alert-specific metrics
  context?: Record<string, any>;       // Additional context
  status: string;                      // NEW | ACKNOWLEDGED | RESOLVED | SUPPRESSED
}
```

### Notification Channels

#### Microsoft Teams Message Format

```json
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "summary": "Alert Title",
  "themeColor": "#FF0000",
  "sections": [
    {
      "activityTitle": "Alert Title",
      "activitySubtitle": "[CRITICAL] COST_SPIKE",
      "facts": [
        {"name": "Severity", "value": "CRITICAL"},
        {"name": "Alert Type", "value": "COST_SPIKE"},
        {"name": "Timestamp", "value": "2026-05-13T15:30:00"},
        {"name": "Account", "value": "123456789"}
      ],
      "text": "Alert description and details...",
      "markdown": true
    }
  ],
  "potentialAction": [
    {
      "@type": "ViewAction",
      "name": "View in Dashboard",
      "target": ["https://yourdomain.com"]
    }
  ]
}
```

#### Slack Message Format

```json
{
  "attachments": [
    {
      "color": "danger",
      "title": "Alert Title",
      "title_link": "https://yourdomain.com",
      "fields": [
        {"title": "Severity", "value": "CRITICAL", "short": true},
        {"title": "Alert Type", "value": "COST_SPIKE", "short": true},
        {"title": "Account", "value": "123456789", "short": true}
      ],
      "text": "Alert description and details...",
      "footer": "AWS MSP Smart Agent",
      "ts": 1715612400
    }
  ]
}
```

---

## Troubleshooting

### Issue: Monitoring doesn't start

**Symptoms:** GET /monitoring/status returns "not_initialized"

**Solution:**
1. Check that AWS credentials are configured
2. Verify IAM permissions are in place
3. Check backend logs for errors
4. Restart the backend service

### Issue: No alerts received

**Symptoms:** Alerts queue is empty despite cost increases

**Solution:**
1. Check monitoring status: `GET /monitoring/status`
2. Verify threshold configuration: `MONITORING_COST_SPIKE_THRESHOLD`
3. Check AWS Cost Explorer data is available
4. Review backend logs for Cost Explorer API errors

### Issue: Notifications not sent to Teams

**Symptoms:** Monitoring works, alerts generated, but Teams channel is silent

**Solution:**
1. Test webhook: `POST /monitoring/send-test-alert?channel=TEAMS`
2. Verify webhook URL: Check it starts with `https://outlook.webhook.office.com/`
3. Check Teams channel permissions: Webhook connector needs "Post messages" permission
4. Test manually:
   ```bash
   curl -X POST "https://outlook.webhook.office.com/..." \
     -H "Content-Type: application/json" \
     -d '{"@type":"MessageCard","@context":"https://schema.org/extensions","summary":"Test","themeColor":"0078D4"}'
   ```

### Issue: Notifications not sent to Slack

**Symptoms:** Monitoring works, alerts generated, but Slack channel is silent

**Solution:**
1. Test webhook: `POST /monitoring/send-test-alert?channel=SLACK`
2. Verify webhook URL: Check it starts with `https://hooks.slack.com/services/`
3. Check Slack workspace permissions: Webhook app needs "Post messages" permission
4. Test manually:
   ```bash
   curl -X POST "https://hooks.slack.com/services/..." \
     -H "Content-Type: application/json" \
     -d '{"text":"Test alert"}'
   ```

### Issue: High number of duplicate alerts

**Symptoms:** Same alert received multiple times

**Solution:**
1. Increase deduplication window in `notification_service.py`:
   ```python
   self.deduplicator = AlertDeduplicator(dedup_window_minutes=120)  # 2 hours
   ```
2. Increase cost spike threshold to reduce sensitivity
3. Increase check interval to reduce detection frequency

### Issue: Alerts delayed by several minutes

**Symptoms:** Alerts arrive late compared to when they were generated

**Solution:**
1. Reduce check interval: `MONITORING_CHECK_INTERVAL_MINUTES=5`
2. Check AWS API throttling: Review CloudWatch metrics for API call failures
3. Check network latency: Monitor backend to AWS connectivity
4. Review backend logs for performance issues

---

## Advanced Configuration

### Custom Alert Thresholds

Modify alert detection in `monitoring_service.py`:

```python
# Cost Spike Detection - Increase sensitivity
cost_detector = CostSpikDetector(
    threshold_percent=10.0,  # Alert on 10%+ increase (vs default 20%)
    lookback_days=7          # Use last 7 days for baseline (vs default 30)
)
```

### Alert Filtering

Filter alerts by severity before sending:

```python
# Only send HIGH and CRITICAL alerts
if alert.severity in [AlertSeverity.HIGH, AlertSeverity.CRITICAL]:
    await notification_service.notify(...)
```

### Custom Notification Formatting

Extend notification handlers in `notification_service.py`:

```python
class CustomTeamsHandler(TeamsNotificationHandler):
    async def send(self, title: str, message: str, alert_data: Dict) -> bool:
        # Custom formatting logic
        pass
```

### Webhook Retry Logic

Implement exponential backoff for failed notifications:

```python
async def send_with_retry(self, webhook_url: str, payload: dict) -> bool:
    for attempt in range(3):
        try:
            response = await session.post(webhook_url, json=payload)
            if response.status == 200:
                return True
        except Exception as e:
            await asyncio.sleep(2 ** attempt)
    return False
```

---

## FAQ

**Q: How often should I check for alerts?**  
A: Every 15 minutes is recommended. It balances cost (API calls) with responsiveness. For critical systems, use 5-minute intervals.

**Q: Can I monitor multiple AWS accounts?**  
A: Yes! Monitoring automatically discovers all configured accounts from the account service and monitors all of them.

**Q: Do alerts clear automatically?**  
A: Alerts are stored in memory and retrieved via the API. They're removed from the queue after retrieval. For persistence, store alerts in DynamoDB or S3.

**Q: Can I create custom alert types?**  
A: Yes! Extend the `AlertType` enum and add custom detection logic to the monitor.

**Q: What happens if monitoring service crashes?**  
A: The service will need to be restarted via the API. Implement health checks and auto-restart if needed.

---

**Last Updated:** May 2026  
**Maintained By:** AWS MSP Smart Agent Team
