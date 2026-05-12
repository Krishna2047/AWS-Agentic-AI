# Agent Troubleshooting Guide

## Quick Diagnostics

### Run diagnostic script (checks everything):
```bash
chmod +x diagnostic.sh
./diagnostic.sh us-east-1
```

This will check:
- ✅ All agent runtimes deployed
- ✅ ECS tasks running
- ✅ CloudWatch logs for errors
- ✅ IAM permissions
- ✅ Gateway connectivity
- ✅ API backend health
- ✅ YouTrack integration
- ✅ RDS database

---

## Common Issues & Fixes

### 1. **Agents timing out (Request timed out after 15 minutes)**

**Symptoms:** Dashboard queries hang, SSE streaming fails, fallback to poll timeout

**Root causes:**
- Agents too slow to query AWS
- IAM permissions missing
- Gateway targets not responding

**Fixes:**
```bash
# Check agent logs
aws logs tail /msp-ops/agents --follow

# Check gateway targets are READY
aws bedrock-agentcore-control list-gateway-targets \
  --gateway-identifier <GATEWAY_ID> \
  --region us-east-1 \
  --query "items[].{name:name,status:status}"

# Verify agent runtimes running
aws ecs list-tasks --cluster msp-ops-cluster --region us-east-1
aws ecs describe-tasks --cluster msp-ops-cluster \
  --tasks <TASK_ARN> --region us-east-1 \
  --query 'tasks[].{name:taskDefinitionArn,status:lastStatus,stoppedReason:stoppedReason}'
```

---

### 2. **Agents can't retrieve AWS data**

**Symptoms:** "Could not complete this request", "Check runtime logs"

**Root causes:**
- IAM permissions not attached
- Agent role missing CloudWatch/EC2/etc. access
- Agents deployed before permissions set

**Fixes:**
```bash
# Check agent role permissions
ROLE_NAME=$(aws iam list-roles --output json | \
  jq -r '.Roles[] | select(.RoleName | contains("a2a")) | .RoleName' | head -1)

aws iam list-attached-role-policies --role-name $ROLE_NAME

# List inline policies
aws iam list-role-policies --role-name $ROLE_NAME
aws iam get-role-policy --role-name $ROLE_NAME \
  --policy-name AgentReadOnlyPolicy | jq '.PolicyDocument'

# If missing, apply policies
aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name AgentReadOnlyPolicy \
  --policy-document file://iam-agent-readonly-policy.json

aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name YouTrackWritePolicy \
  --policy-document file://iam-youtrack-write-policy.json
```

---

### 3. **CloudWatch agent returns no alarms**

**Symptoms:** "Do I have any active alarms?" returns empty

**Root causes:**
- CloudWatch has no alarms configured
- Agent doesn't have cloudwatch:DescribeAlarms permission
- Agent runtime not running

**Fixes:**
```bash
# Test CloudWatch access directly
aws cloudwatch describe-alarms --region us-east-1

# If empty, create a test alarm
aws cloudwatch put-metric-alarm \
  --alarm-name test-alarm \
  --alarm-description "Test alarm" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --region us-east-1

# Check agent can query it
aws ecs exec --cluster msp-ops-cluster \
  --task <CLOUDWATCH_TASK_ARN> \
  --container cloudwatch \
  --command "/bin/bash" \
  --region us-east-1 -it
# Then inside container: aws cloudwatch describe-alarms
```

---

### 4. **Gateway targets not READY**

**Symptoms:** "Waiting for gateway targets to sync", "Poll failed"

**Root causes:**
- MCP servers not responding
- Gateway execution role permissions wrong
- OAuth provider misconfigured

**Fixes:**
```bash
# Check gateway target status
GATEWAY_ID=$(aws bedrock-agentcore-control list-gateways \
  --region us-east-1 \
  --query "items[0].gatewayId" --output text)

aws bedrock-agentcore-control list-gateway-targets \
  --gateway-identifier $GATEWAY_ID \
  --region us-east-1

# If FAILED status, try recreating target
aws bedrock-agentcore-control delete-gateway-target \
  --gateway-identifier $GATEWAY_ID \
  --target-id <TARGET_ID> \
  --region us-east-1

# Then redeploy or retry
```

---

### 5. **YouTrack integration not working**

**Symptoms:** YouTrack agent errors, tickets not created

**Root causes:**
- YouTrack token invalid
- YouTrack API unreachable
- Missing permissions for write

**Fixes:**
```bash
# Test YouTrack token
curl -H "Authorization: Bearer $YOUTRACK_TOKEN" \
  "$YOUTRACK_URL/api/me"

# Check YouTrack config in deploy
grep YOUTRACK backend/.env

# Verify policy attached
aws iam get-role-policy --role-name $ROLE_NAME \
  --policy-name YouTrackWritePolicy | jq '.PolicyDocument'

# Test YouTrack connectivity from agent container
aws ecs exec --cluster msp-ops-cluster \
  --task <YOUTRACK_TASK_ARN> \
  --container youtrack \
  --command "/bin/bash" \
  --region us-east-1 -it
# Then: curl -H "Authorization: Bearer $YOUTRACK_TOKEN" "$YOUTRACK_URL/api/me"
```

---

### 6. **Cognito user already exists**

**Symptoms:** "UsernameExistsException: User account already exists"

**Solution:** This is now handled automatically - deployment will skip user creation if user exists

```bash
# Manually check user
aws cognito-idp admin-get-user \
  --user-pool-id <POOL_ID> \
  --username <EMAIL> \
  --region us-east-1

# If stuck, you can reset password
aws cognito-idp admin-set-user-password \
  --user-pool-id <POOL_ID> \
  --username <EMAIL> \
  --password "TempPassword1!" \
  --permanent \
  --region us-east-1
```

---

## Agent Logs Deep Dive

### Stream logs in real-time:
```bash
# All agent logs
aws logs tail /msp-ops/agents --follow

# Specific runtime
aws logs tail /msp-ops/agents --follow --log-stream-name-prefix "cloudwatch"

# Search for errors
aws logs filter-log-events \
  --log-group-name /msp-ops/agents \
  --filter-pattern "ERROR" \
  --region us-east-1 | jq '.events[]'

# Get specific time range (last 1 hour)
aws logs filter-log-events \
  --log-group-name /msp-ops/agents \
  --start-time $(($(date +%s)*1000 - 3600000)) \
  --region us-east-1
```

---

## Performance Diagnostics

### Check agent response times:
```bash
# Enable detailed logging in backend
# Edit backend/.env: LOG_LEVEL=DEBUG

# Restart service
aws ecs update-service \
  --cluster msp-ops-cluster \
  --service msp-ops-service \
  --force-new-deployment \
  --region us-east-1

# Monitor logs
aws logs tail /msp-ops/backend --follow | grep "agent\|response\|took"
```

### Identify slow agents:
```bash
# CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace MSPOps \
  --metric-name AgentResponseTime \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum \
  --region us-east-1
```

---

## Permission Verification Checklist

- [ ] Agent role has `AgentReadOnlyPolicy` attached
- [ ] Agent role has `YouTrackWritePolicy` attached
- [ ] CloudWatch read permissions: `cloudwatch:DescribeAlarms`, `logs:GetLogEvents`
- [ ] EC2 read permissions: `ec2:DescribeInstances`, `ec2:DescribeInstanceStatus`
- [ ] Security Hub: `securityhub:GetFindings`
- [ ] Cost Explorer: `ce:GetCostAndUsage`
- [ ] **NO write permissions** for AWS resources
- [ ] **ONLY** gateway/youtrack write permissions

---

## Reset Everything (Nuclear Option)

If agents are in bad state:

```bash
# 1. Stop all A2A runtimes
for runtime in cloudwatch security cost advisor youtrack knowledge; do
  aws bedrock-agentcore-control stop-agent-runtime \
    --agent-runtime-arn "arn:aws:bedrock-agentcore:us-east-1:$(aws sts get-caller-identity --query Account --output text):runtime/${runtime}-*" \
    --region us-east-1 2>/dev/null || true
done

# 2. Wait 30 seconds
sleep 30

# 3. Redeploy agents
cd agents/runtime_cloudwatch && agentcore deploy && cd -
cd agents/runtime_security && agentcore deploy && cd -
cd agents/runtime_cost && agentcore deploy && cd -
cd agents/runtime_advisor && agentcore deploy && cd -
cd agents/runtime_youtrack && agentcore deploy && cd -
cd agents/runtime_knowledge && agentcore deploy && cd -

# 4. Reapply policies
aws iam put-role-policy \
  --role-name <AGENT_ROLE> \
  --policy-name AgentReadOnlyPolicy \
  --policy-document file://iam-agent-readonly-policy.json

aws iam put-role-policy \
  --role-name <AGENT_ROLE> \
  --policy-name YouTrackWritePolicy \
  --policy-document file://iam-youtrack-write-policy.json
```

---

## Questions to Ask When Debugging

1. **Is the agent running?** → `aws ecs list-tasks`, check status
2. **Does it have permissions?** → `aws iam get-role-policy`
3. **Can it reach AWS services?** → Check logs, test from container
4. **Can it reach the gateway?** → Check gateway targets status
5. **Is the query routed correctly?** → Check supervisor logs
6. **Are there any timeouts?** → Increase timeout in frontend settings

---

## Support

For issues not covered here:
1. Run `./diagnostic.sh` and share output
2. Check logs: `aws logs tail /msp-ops/agents --follow`
3. Verify IAM: `aws iam list-attached-role-policies --role-name <role>`
4. Test connectivity: `curl` to AWS APIs from container
