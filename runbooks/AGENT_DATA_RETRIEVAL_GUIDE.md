# Agent Data Retrieval Configuration Guide

**Status:** ✅ All agents correctly configured to retrieve AWS account data

---

## Overview

All 6 specialist agents are configured with proper AWS IAM permissions to retrieve real-time data from your AWS account:

```
┌─────────────────────────────────────────────────────────┐
│           Configured AWS Account: 711560820682           │
│              Region: us-east-1                           │
└─────────────────────────────────────────────────────────┘
        │
        ├─→ CloudWatch Agent (Monitoring)
        ├─→ Security Agent (Compliance)
        ├─→ Cost Agent (Optimization)
        ├─→ Advisor Agent (Recommendations)
        ├─→ YouTrack Agent (Ticket Management)
        └─→ Knowledge Agent (Documentation Search)
```

---

## Agent Configuration Details

### 1. CloudWatch Agent

**What it retrieves:**
- CloudWatch alarms (status, metric breaches)
- CloudWatch metrics (CPU, disk, memory, custom metrics)
- CloudWatch Logs (log groups, log streams, recent events)
- Insights query results

**AWS Permissions Required:**
```json
{
  "Sid": "CloudWatchReadAccess",
  "Effect": "Allow",
  "Action": [
    "cloudwatch:DescribeAlarms",
    "cloudwatch:GetMetricData",
    "cloudwatch:GetMetricStatistics",
    "cloudwatch:ListMetrics",
    "cloudwatch:ListDashboards",
    "cloudwatch:GetDashboard",
    "logs:DescribeLogGroups",
    "logs:DescribeLogStreams",
    "logs:GetLogEvents",
    "logs:FilterLogEvents",
    "logs:StartQuery",
    "logs:GetQueryResults"
  ],
  "Resource": "*"
}
```

**Current Status:** ✅ Attached to CloudWatch MCP role

**Data Retrieval Example:**
```
User: "What alarms are in CRITICAL state?"
Agent retrieves: aws cloudwatch describe-alarms --state-value ALARM
Response: [Lists all critical alarms with details]
```

---

### 2. Security Agent

**What it retrieves:**
- Security Hub findings (severity, resource type, compliance)
- Enabled Security Standards
- Security control status
- Compliance scores

**AWS Permissions Required:**
```json
{
  "Sid": "SecurityHubAccess",
  "Effect": "Allow",
  "Action": [
    "securityhub:GetFindings",
    "securityhub:GetEnabledStandards",
    "securityhub:DescribeStandards",
    "securityhub:DescribeHub",
    "securityhub:BatchGetSecurityControls"
  ],
  "Resource": "*"
}
```

**Current Status:** ✅ Attached to AWS API MCP role (via policy replication)

**Data Retrieval Example:**
```
User: "Show me all security findings with severity HIGH"
Agent retrieves: aws securityhub get-findings --filters '{"Severity":[{"Value":"HIGH"}]}'
Response: [Lists findings, their resources, and remediation steps]
```

---

### 3. Cost Agent

**What it retrieves:**
- Cost and usage data (by service, dimension, time period)
- Cost forecasts
- Reserved Instance utilization
- Savings Plans recommendations
- Cost anomalies

**AWS Permissions Required:**
```json
{
  "Sid": "CostExplorerAccess",
  "Effect": "Allow",
  "Action": [
    "ce:GetCostAndUsage",
    "ce:GetCostForecast",
    "ce:GetReservationUtilization",
    "ce:GetSavingsPlansUtilization",
    "ce:GetDimensionValues"
  ],
  "Resource": "*"
}
```

**Current Status:** ✅ Attached to AWS API MCP role

**Data Retrieval Example:**
```
User: "What are my top 5 most expensive services this month?"
Agent retrieves: aws ce get-cost-and-usage --metrics UnblendedCost --granularity MONTHLY --group-by {Type:DIMENSION,Key:SERVICE}
Response: [Cost table sorted by spending, includes trends]
```

---

### 4. Advisor Agent

**What it retrieves:**
- Trusted Advisor checks (security, performance, reliability, cost optimization)
- Check results and affected resources
- Recommendations and action items

**AWS Permissions Required:**
```json
{
  "Sid": "TrustedAdvisorAccess",
  "Effect": "Allow",
  "Action": [
    "support:DescribeTrustedAdvisorChecks",
    "support:DescribeTrustedAdvisorCheckResult",
    "support:DescribeTrustedAdvisorCheckSummaries",
    "support:RefreshTrustedAdvisorCheck",
    "trustedadvisor:ListChecks",
    "trustedadvisor:ListRecommendations"
  ],
  "Resource": "*"
}
```

**Current Status:** ✅ Attached to AWS API MCP role

**Data Retrieval Example:**
```
User: "What are your top 3 cost optimization recommendations?"
Agent retrieves: aws support describe-trusted-advisor-checks
Then filters for recommendations with highest impact
Response: [Actionable recommendations with estimated savings]
```

---

### 5. YouTrack Agent

**What it retrieves:**
- Issues (tickets, bugs, feature requests)
- Issue details (assignee, status, priority, custom fields)
- Comments and activity history
- Project and user information

**Authentication Method:**
- API Token: Permanent token stored in `YOUTRACK_TOKEN` environment variable
- Method: `Authorization: Bearer {token}` header
- Base URL: `$YOUTRACK_URL` (configured in `.env`)

**Required Configuration:**
```bash
# In backend/.env
YOUTRACK_URL=https://youtrack.example.com
YOUTRACK_TOKEN=perm-XXXXXXXXXXX
YOUTRACK_PROJECT_ID=PROJ
YOUTRACK_PROJECT_NAME="My Project"
```

**Current Status:** ✅ Configured with API token and project details

**Data Retrieval Example:**
```
User: "Show me all open bugs in the mobile project"
Agent calls: GET https://youtrack.example.com/api/issues?query=project:PROJ type:Bug state:Open
Response: [List of all open bugs with details]
```

---

### 6. Knowledge Agent

**What it retrieves:**
- AWS documentation and runbooks
- Best practice guides
- Service-specific configuration examples
- Cost optimization guides
- Security hardening guides

**Configuration Required:**
- Bedrock Knowledge Base ID (optional, set in `BEDROCK_KNOWLEDGE_BASE_ID`)
- Runbooks synced via `scripts/sync-runbooks.py`

**Current Status:** ✅ Ready (Knowledge Base optional)

**Data Retrieval Example:**
```
User: "How do I optimize RDS read performance?"
Agent searches knowledge base for: "RDS read optimization"
Response: [Best practices, configuration options, performance tuning steps]
```

---

## How Data Flows Through the System

### Request Flow

```
1. User Query
   ↓
2. Frontend sends request via HTTPS
   ↓
3. API Gateway (Cognito auth)
   ↓
4. Backend FastAPI service (ECS)
   ↓
5. Supervisor Agent (HTTP) orchestrates
   ↓
6. Supervisor routes to best specialist agent (A2A invocation)
   ↓
7. Specialist Agent (A2A protocol)
   ↓
8. Agent connects to Gateway (WebSocket or HTTP)
   ↓
9. Gateway invokes MCP targets or direct AWS API calls
   ↓
10. AWS SDK makes authenticated calls to your account
    ↓
11. AWS returns data
    ↓
12. Data flows back through agent chain
    ↓
13. Response rendered in UI
```

### Authentication Chain

```
Frontend
   ↓ (Cognito token)
API Gateway
   ↓ (Service role)
ECS Task (Backend)
   ↓ (Task role with STS assume)
→ Assumed Role in Customer Account
   ↓
MCP Runtimes
   ↓ (OAuth2 M2M)
Gateway
   ↓ (IAM role + policies)
AWS Services
```

---

## Verify Data Retrieval is Working

### Test 1: CloudWatch Data

```bash
# From agent logs or via API:
curl -X POST https://<api-gateway>/api/v1/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "cloudwatch",
    "query": "What is the average CPU utilization in the last hour?"
  }'

# Expected response: Metric data with actual values
```

### Test 2: Cost Data

```bash
curl -X POST https://<api-gateway>/api/v1/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "cost",
    "query": "What are my total costs this month?"
  }'

# Expected response: Actual cost figures from your account
```

### Test 3: YouTrack Data

```bash
curl -X POST https://<api-gateway>/api/v1/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "youtrack",
    "query": "Show me all open issues in the project"
  }'

# Expected response: List of actual issues from your YouTrack instance
```

### Test 4: Security Findings

```bash
curl -X POST https://<api-gateway>/api/v1/invoke \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "security",
    "query": "What critical security findings do I have?"
  }'

# Expected response: Actual findings from Security Hub
```

---

## Troubleshooting Data Retrieval Issues

### Issue: "Access Denied" Errors

**Cause:** IAM permissions not attached to agent roles

**Solution:**
```bash
# Verify role has permissions
ROLE_NAME="<runtime-role-name>"

# Check attached policies
aws iam list-role-policies --role-name "$ROLE_NAME" --region us-east-1

# If empty, re-run Step 10 of deployment:
aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name AWSServiceAccess \
  --policy-document <policy-json>
```

### Issue: "No data returned"

**Cause:** 
1. AWS resources don't exist in account
2. CloudWatch metrics not published yet
3. Query time range is incorrect

**Solution:**
1. Check if CloudWatch alarms/metrics exist:
   ```bash
   aws cloudwatch describe-alarms --region us-east-1 | jq '.MetricAlarms | length'
   ```

2. Check if CloudWatch agent is publishing metrics:
   ```bash
   aws cloudwatch get-metric-statistics --namespace "AWS/EC2" --metric-name CPUUtilization --start-time 2026-05-08T00:00:00Z --end-time 2026-05-08T23:59:59Z --period 3600 --statistics Average --region us-east-1
   ```

### Issue: "YouTrack authentication failed"

**Cause:** Invalid token or wrong URL

**Solution:**
```bash
# Test token directly
curl -H "Authorization: Bearer $YOUTRACK_TOKEN" \
  "$YOUTRACK_URL/api/me" 2>&1 | jq '.'
  
# Should return: {"id": "...", "login": "..."}
# If error: Token expired or URL incorrect
```

### Issue: "Gateway connection timeout"

**Cause:** Gateway not running or network issues

**Solution:**
```bash
# Check gateway status
aws bedrock-agentcore-control get-gateway \
  --gateway-identifier <gateway-id> \
  --region us-east-1 \
  --query 'status'

# Should return: "READY"

# Check gateway targets
aws bedrock-agentcore-control list-gateway-targets \
  --gateway-identifier <gateway-id> \
  --region us-east-1
```

---

## Data Retrieval Performance

### Expected Response Times

| Agent | Operation | Typical Time |
|-------|-----------|--------------|
| CloudWatch | Describe alarms | 2-3 seconds |
| CloudWatch | Get metrics (last 24h) | 5-10 seconds |
| Cost | Get monthly costs | 10-15 seconds |
| Security | Get findings | 5-8 seconds |
| YouTrack | List issues | 3-5 seconds |
| Knowledge | Search KB | 5-10 seconds |

### Optimization Tips

1. **Use time filters:** Limit CloudWatch queries to relevant time windows
2. **Filter by dimension:** Use Cost Explorer dimensions to narrow results
3. **Cache knowledge:** KB searches are slower; results can be cached
4. **Batch operations:** Combine multiple small queries into one

---

## Security Considerations

### What Agents Can Access

✅ **Allowed:**
- Read CloudWatch metrics, alarms, logs
- Read Cost Explorer data
- Read Security Hub findings
- Read Trusted Advisor recommendations
- Create/read/update issues in YouTrack
- Search knowledge base

❌ **NOT Allowed:**
- Modify AWS resources (create/delete/terminate)
- Access EC2 instance passwords
- View IAM credentials
- Delete CloudWatch logs
- Modify Security policies

### Credential Isolation

```
┌─────────────────────────────────────────┐
│  Frontend (User Credentials)            │
│  ↓ (Cognito tokens)                     │
├─────────────────────────────────────────┤
│  Backend (Service Role)                 │
│  ↓ (STS assume role)                    │
├─────────────────────────────────────────┤
│  Agents (Limited IAM role)              │
│  ↓ (Read-only permissions)              │
├─────────────────────────────────────────┤
│  AWS Services (Account boundary)        │
│  ↓ (No cross-account access by default) │
└─────────────────────────────────────────┘
```

Each layer has minimum required permissions.

---

## Next Steps

1. **Verify Deployment:**
   - [ ] All 6 agents deployed (check CloudWatch logs)
   - [ ] IAM roles have permissions (verify policies attached)
   - [ ] Gateway targets registered (check `list-gateway-targets`)

2. **Test Data Retrieval:**
   - [ ] Query CloudWatch alarms
   - [ ] Check cost trends
   - [ ] List YouTrack issues
   - [ ] Review security findings

3. **Monitor Performance:**
   - [ ] Check agent response times in CloudWatch
   - [ ] Monitor API latency
   - [ ] Review agent invocation logs

4. **Optimize Configuration:**
   - [ ] Adjust CloudWatch query intervals
   - [ ] Configure cost analysis parameters
   - [ ] Set up custom knowledge base (optional)

---

## Reference

- **Framework:** AWS Bedrock AgentCore + MCP
- **Deployment:** CDK (Python) + ECS
- **Frontend:** React + TypeScript
- **Backend:** FastAPI (Python)
- **Authentication:** AWS Cognito + OAuth2

For detailed configuration, see `DEPLOYMENT_ERROR_ANALYSIS.md`.
