# Redis Endpoint Fix - Deployment Instructions

## ✅ What Was Fixed

**Problem**: Backend was using `redis://redis:6379/0` (Docker Compose hostname)
- This doesn't exist in AWS
- Redis connection failed silently
- Cost data showed cached $0.50 instead of fresh $243.48

**Solution**: Updated to actual AWS ElastiCache endpoint:
```
redis://msp-re-hilw2rdpxc9o.sordrc.0001.use1.cache.amazonaws.com:6379/0
```

---

## 🚀 Deploy the Fix

### Step 1: Verify the Change
```bash
cd "d:\One Data Solution\AWS Automation Agentic Ai\sample-MSP-Ops-Automation-V2\infrastructure\cdk"

# Check the file has correct endpoint
grep -n "REDIS_URL" stacks/backend_stack.py
# Should show: redis://msp-re-hilw2rdpxc9o.sordrc.0001.use1.cache.amazonaws.com:6379/0
```

### Step 2: Deploy with CDK
```bash
cd infrastructure/cdk

# Deploy only backend stack (faster than full deploy)
cdk deploy MSPAssistantBackendStack --require-approval never --region us-east-1
```

**Expected output:**
```
Do you wish to deploy these changes (y/n)? y
...
MSPAssistantBackendStack: deployment succeeded
```

### Step 3: Wait for Rollout
```bash
# Monitor deployment (takes 2-5 minutes)
aws ecs describe-services \
  --cluster MSPAssistantBackendStack-BackendServiceclusterCF9C4FF3-4gWFN96jO1Ac \
  --services MSPAssistantBackendStack-BackendServiceserviceServiceF1EBE754-nRQOmVTpq748 \
  --region us-east-1 \
  --query 'services[0].{Status:status, RunningCount:runningCount, DesiredCount:desiredCount}'

# Wait until RunningCount = DesiredCount (2)
```

### Step 4: Verify Fix Works
```bash
# Check logs show Redis connection
aws logs tail MSPAssistantBackendStack-BackendServicetaskdefBackendServicecontainerLogGroupC8381043-i7RzdsKzJsIC \
  --region us-east-1 | grep -i "redis\|cache\|connected" | head -20
```

### Step 5: Test Dashboard
1. Open CloudFront URL: `http://<your-cloudfront-url>/dashboard`
2. Ask: **"What's my total cost for March 2026?"**
3. Should now show **$243.48** instead of $0.50 ✅

---

## ✅ What Will Change

**Before Fix:**
```
Dashboard cost: $0.50 (cached, wrong)
Backend logs: Only /health checks (no cost queries)
Redis connection: Failed silently
```

**After Fix:**
```
Dashboard cost: $243.48 (correct!)
Backend logs: Cost queries to AWS, then to Redis cache
Redis connection: ✓ Connected
Cache working: ✓ Yes (1-2 second responses)
```

---

## 🎯 Complete Code Change

**File**: `infrastructure/cdk/stacks/backend_stack.py`  
**Line**: 435

### Before:
```python
"REDIS_URL": self.node.try_get_context("redis_url") or os.getenv('REDIS_URL', 'redis://redis:6379/0'),
```

### After:
```python
"REDIS_URL": "redis://msp-re-hilw2rdpxc9o.sordrc.0001.use1.cache.amazonaws.com:6379/0",
```

---

## ⏱️ Deployment Timeline

| Time | What Happens |
|------|--------------|
| 0 min | Run `cdk deploy` |
| 1 min | CloudFormation updates backend stack |
| 2 min | New task definition registered |
| 3-4 min | Old ECS tasks drain, new tasks start |
| 5 min | ✅ New backend running with correct Redis endpoint |
| 6 min | Dashboard queries reach Redis (cache hit) |

---

## 🔍 Verification Commands

After deployment, verify everything works:

```bash
# 1. Check backend is running
aws ecs describe-services \
  --cluster MSPAssistantBackendStack-BackendServiceclusterCF9C4FF3-4gWFN96jO1Ac \
  --services MSPAssistantBackendStack-BackendServiceserviceServiceF1EBE754-nRQOmVTpq748 \
  --region us-east-1 \
  --query 'services[0].runningCount'
# Should show: 2

# 2. Check new task definition has correct REDIS_URL
aws ecs describe-task-definition \
  --task-definition MSPAssistantBackendStackBackendServicetaskdef7AAEC634 \
  --region us-east-1 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`REDIS_URL`].value' \
  --output text
# Should show: redis://msp-re-hilw2rdpxc9o.sordrc.0001.use1.cache.amazonaws.com:6379/0

# 3. Check Redis is reachable
aws elasticache describe-cache-clusters \
  --cache-cluster-id msp-re-hilw2rdpxc9o \
  --region us-east-1 \
  --query 'CacheClusters[0].CacheClusterStatus'
# Should show: available
```

---

## ✅ Success Criteria

After deployment:
- ✅ Dashboard shows $243.48 (correct cost)
- ✅ Backend logs show Redis connection
- ✅ Repeated queries return in 1-2 seconds (cache hit)
- ✅ First query takes 20-30 seconds (AWS lookup)
- ✅ Cache hit rate improves over time

---

## 🚀 Deploy Now!

```bash
cd "d:\One Data Solution\AWS Automation Agentic Ai\sample-MSP-Ops-Automation-V2\infrastructure\cdk"
cdk deploy MSPAssistantBackendStack --require-approval never --region us-east-1
```

**Expected result: Cost data now shows accurately! 🎉**
