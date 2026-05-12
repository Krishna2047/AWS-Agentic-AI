# Deployment Checklist - Ready for Production

## Pre-Deployment (5 minutes)

- [ ] **Policy files exist**
  ```bash
  ls -la iam-agent-readonly-policy.json
  ls -la iam-youtrack-write-policy.json
  ```

- [ ] **Diagnostic script ready**
  ```bash
  chmod +x diagnostic.sh
  ```

- [ ] **Backend .env configured**
  ```bash
  grep -E "YOUTRACK|AWS_REGION|MODEL" backend/.env
  ```

- [ ] **AWS credentials working**
  ```bash
  aws sts get-caller-identity
  ```

- [ ] **Region set correctly**
  ```bash
  export AWS_REGION=us-east-1
  ```

---

## Deployment Phase (60-90 minutes)

- [ ] **Run deployment**
  ```bash
  ./deploy.sh --email admin@example.com --region us-east-1
  ```

- [ ] **Monitor progress** (in separate terminal)
  ```bash
  tail -f deploy-*.log
  ```

- [ ] **Watch for errors:**
  - ❌ Syntax errors → Fix deploy.sh
  - ❌ IAM errors → Check credentials
  - ❌ Region errors → Set AWS_REGION
  - ❌ Timeout errors → Check AWS API quota

---

## Post-Deployment Verification (5 minutes)

### 1. Check Agents Deployed
```bash
./diagnostic.sh us-east-1
```

Expected output:
```
[1] Checking Agent Runtimes...
✓ Found 6 agents
  cloudwatch: RUNNING
  security: RUNNING
  cost: RUNNING
  advisor: RUNNING
  youtrack: RUNNING
  knowledge: RUNNING
```

- [ ] All 6 agents showing RUNNING status

### 2. Check ECS Tasks
```bash
aws ecs list-tasks --cluster msp-ops-cluster --region us-east-1
```

- [ ] Should show 6 running tasks (one per agent)

### 3. Check IAM Permissions
```bash
ROLE=$(aws iam list-roles --output json | \
  jq -r '.Roles[] | select(.RoleName | contains("a2a")) | .RoleName' | head -1)

aws iam list-role-policies --role-name $ROLE
```

Expected:
```
[
  "AgentReadOnlyPolicy",
  "YouTrackWritePolicy"
]
```

- [ ] Both policies attached

### 4. Check Gateway
```bash
aws bedrock-agentcore-control list-gateways --region us-east-1 | jq '.items[0]'
```

- [ ] Status: READY
- [ ] Should show gateway ID

### 5. Check Gateway Targets
```bash
GATEWAY_ID=$(aws bedrock-agentcore-control list-gateways --region us-east-1 \
  --query "items[0].gatewayId" --output text)

aws bedrock-agentcore-control list-gateway-targets \
  --gateway-identifier $GATEWAY_ID --region us-east-1
```

- [ ] All targets status: READY
- [ ] At least 3 MCP targets (cloudwatch, aws-api, knowledge)

### 6. Test Dashboard Access
- [ ] Navigate to CloudFront URL from CDK outputs
- [ ] Sign in with email@password
- [ ] See dashboard home page

### 7. Test Agent Queries
In dashboard, try these queries:

- [ ] "Do I have any active alarms?"
  - Should complete within 15 minutes
  - Should return CloudWatch data
  
- [ ] "What's my monthly cost?"
  - Should return Cost Explorer data
  
- [ ] "Any security findings?"
  - Should return Security Hub findings
  
- [ ] "Show me my EC2 instances"
  - Should return EC2 instance list

---

## Troubleshooting Checklist

If agents not working:

### Agents Timeout (> 15 minutes)
- [ ] Check agent logs: `aws logs tail /msp-ops/agents --follow`
- [ ] Check gateway targets: `aws bedrock-agentcore-control list-gateway-targets`
- [ ] Increase timeout further if needed: `frontend/src/services/api/apiClient.ts`

### No Data Returned
- [ ] Check IAM policies applied: `aws iam list-role-policies --role-name <ROLE>`
- [ ] Test AWS access: `aws cloudwatch describe-alarms`
- [ ] Check agent running: `aws ecs list-tasks --cluster msp-ops-cluster`

### Cognito Login Fails
- [ ] Verify user created: `aws cognito-idp admin-get-user --user-pool-id <POOL_ID> --username <EMAIL>`
- [ ] Reset password: `aws cognito-idp admin-set-user-password --user-pool-id <POOL_ID> --username <EMAIL> --password "TempPass1!" --permanent`

### YouTrack Integration Not Working
- [ ] Test token: `curl -H "Authorization: Bearer $YOUTRACK_TOKEN" "$YOUTRACK_URL/api/me"`
- [ ] Check policy: `aws iam get-role-policy --role-name <ROLE> --policy-name YouTrackWritePolicy`

---

## Security Verification

- [ ] **Agents READ-ONLY for AWS**
  ```bash
  ROLE=$(aws iam list-roles --output json | \
    jq -r '.Roles[] | select(.RoleName | contains("a2a")) | .RoleName' | head -1)
  
  aws iam get-role-policy --role-name $ROLE --policy-name AgentReadOnlyPolicy | \
    jq '.PolicyDocument.Statement[] | select(.Effect=="Deny")'
  ```
  Should show explicit deny for all write actions

- [ ] **Agents WRITE-ONLY for YouTrack**
  ```bash
  aws iam get-role-policy --role-name $ROLE --policy-name YouTrackWritePolicy | \
    jq '.PolicyDocument.Statement[] | select(.Effect=="Deny")'
  ```
  Should deny all AWS write actions

- [ ] **No agent can modify AWS resources**
  - Try: "Stop my EC2 instances" → Should fail
  - Try: "Delete my S3 bucket" → Should fail
  - Try: "Change this IAM role" → Should fail

---

## Performance Baseline

After deployment, establish baseline:

```bash
# Record these for comparison
date

# Agent response times (check logs)
aws logs filter-log-events \
  --log-group-name /msp-ops/agents \
  --filter-pattern "response_time" \
  --region us-east-1 | jq '.events[].message' | head -10

# Cost of running agents (first month)
aws ce get-cost-and-usage \
  --time-period Start=2026-05-01,End=2026-05-31 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

- [ ] Note baseline agent response times
- [ ] Note baseline infrastructure costs

---

## User Handoff Checklist

If handing off to operations team:

- [ ] Share dashboard URL
- [ ] Share login credentials (email/password)
- [ ] Share `TROUBLESHOOTING_AGENTS.md`
- [ ] Share `diagnostic.sh` script
- [ ] Train on common queries:
  - Alarms
  - Cost analysis
  - Security findings
  - Recommendations
- [ ] Share escalation procedure for alerts
- [ ] Document YouTrack project ID for ticket creation

---

## Monthly Maintenance

- [ ] **Check agent logs for errors** (monthly)
  ```bash
  aws logs filter-log-events \
    --log-group-name /msp-ops/agents \
    --filter-pattern "ERROR" \
    --start-time $(($(date +%s)*1000 - 86400000)) \
    --region us-east-1
  ```

- [ ] **Verify all policies still attached** (monthly)
  ```bash
  ./diagnostic.sh us-east-1 | grep -E "✓|✗"
  ```

- [ ] **Update YouTrack token if needed** (quarterly)
  - If token expired, update `backend/.env` and redeploy

- [ ] **Review agent logs for performance trends** (quarterly)
  - Identify slow agents
  - Optimize queries or increase timeout

- [ ] **Update AWS credentials** (semi-annually)
  - Rotate access keys
  - Update Secrets Manager

---

## Success Criteria

Deployment is successful if:

- ✅ All 6 agents deployed and RUNNING
- ✅ Dashboard accessible
- ✅ Can log in with Cognito
- ✅ Agent queries return AWS data
- ✅ Agents have NO write access to AWS
- ✅ Agents CAN create YouTrack tickets
- ✅ Diagnostic script shows all green
- ✅ No errors in CloudWatch logs
- ✅ Page load time < 5 seconds
- ✅ Agent response time < 15 minutes

---

## Emergency Contacts

For issues:
1. Check `TROUBLESHOOTING_AGENTS.md`
2. Run `./diagnostic.sh us-east-1`
3. Check logs: `aws logs tail /msp-ops/agents --follow`
4. Verify IAM: `aws iam list-role-policies --role-name <ROLE>`

---

**Deployment Status: ✅ READY FOR PRODUCTION**

All fixes applied. All permissions configured. All agents ready to retrieve AWS data securely.

Deploy with confidence! 🚀
