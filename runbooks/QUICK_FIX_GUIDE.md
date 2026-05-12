# 🚀 Quick Fix Guide - Get Deployment Working in 5 Minutes

## THE PROBLEM

Your deployment is failing because:
1. ❌ YouTrack token is invalid (never been used)
2. ❌ SUPERVISOR_RUNTIME_ARN might not be set in .env
3. ❌ Some environment variables missing

**Result:** Chat returns "supervisor specialist could not complete this request"

---

## THE SOLUTION (5 Steps)

### Step 1: Create New YouTrack Token (2 minutes)

**Go to YouTrack:**
```
https://youtrack24.onedatasoftware.com
```

**Click your profile icon** (top right) → **Account Security** → **Permanent Tokens**

**Click "New token":**
- Name: `AWS-MSP-Issue-Creator`
- Scope: ☑ **"YouTrack"** (that's the only option needed)
- Click **Create**

**Copy the token immediately** (shows only once!)

---

### Step 2: Update .env File (1 minute)

**Open:** `backend/.env` in your IDE

**Find and replace line 37:**
```
OLD:  YOUTRACK_TOKEN="perm-S3Jpc2huYV9T.NDYtMjc=.0yNEJjiVyTFwYBDDapRGaXaod6dR8a"
NEW:  YOUTRACK_TOKEN="perm-[paste-your-new-token-here]"
```

**Example:**
```
YOUTRACK_TOKEN="perm-S3Jpc2huYV9U.NDYtMjg=.V3MesjB73YoeLysJ0UTsGuvgAFCHJT"
```

**Also verify these lines exist and are NOT empty:**
```
YOUTRACK_URL="https://youtrack24.onedatasoftware.com"
YOUTRACK_PROJECT_ID="0-121"
SUPERVISOR_RUNTIME_ARN=arn:aws:bedrock-agentcore:us-east-1:711560820682:runtime/msp_supervisor_agent-1HAHH0BGAR
GATEWAY_URL=https://msp-assistant-gateway-djzeb9bxtf.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp
MEMORY_ID=msp_assistant_memory-yUlzxGExR3
```

**Save the file.**

---

### Step 3: Run Diagnostic (30 seconds)

```bash
cd "d:\One Data Solution\AWS Automation Agentic Ai\sample-MSP-Ops-Automation-V2"
bash fix_deployment.sh
```

**Should show:** ✓ All checks passed!

---

### Step 4: Restart Backend (1 minute)

**Stop the current backend** (if running):
```
Ctrl+C
```

**Start backend:**
```bash
cd backend
python app/main.py
```

**Should show:**
```
INFO:app.core.config_loader:Loaded configuration from: backend/.env
INFO:uvicorn.server:Application startup complete
```

---

### Step 5: Test in Chat (30 seconds)

**In the frontend chat, type:**
```
Do I have any active alarms?
```

**Should respond with:**
```
✓ Supervisor analyzing...
✓ Routing to cloudwatch specialist...
[CloudWatch data or no alarms response]
```

---

## If Still Not Working

### Check 1: Backend Started?
```bash
# Backend should be running and show:
# "Uvicorn running on http://0.0.0.0:8000"
```

### Check 2: .env Loaded?
```bash
# In backend startup logs, should show:
# "Loaded configuration from: backend/.env"
```

### Check 3: YouTrack Token Correct?
```bash
# In backend/.env, line 37:
# Should have YOUR new token, not the old one starting with:
# perm-S3Jpc2huYV9T.NDYtMjc=
```

### Check 4: All ARNs Present?
```bash
# Run: grep "ARN=" backend/.env
# Should show 6 ARNs:
# SUPERVISOR_RUNTIME_ARN=...
# CLOUDWATCH_A2A_ARN=...
# SECURITY_A2A_ARN=...
# COST_A2A_ARN=...
# ADVISOR_A2A_ARN=...
# KNOWLEDGE_A2A_ARN=...
# YOUTRACK_A2A_ARN=...
```

---

## For AWS Deployment

If you're deploying to AWS (not local development):

### Option 1: Update AWS Secrets Manager
```bash
aws secretsmanager put-secret-value \
  --secret-id bedrock-agentcore-identity!default/apikey/youtrack-api-key-7625b101 \
  --secret-string '{"api_key_value":"perm-[your-new-token]"}'
```

### Option 2: Use deploy.sh
```bash
# Update backend/.env locally first (steps 1-2 above)
bash deploy.sh
```

---

## ✓ SUCCESS INDICATORS

After these steps, you should see:

| What | When | Status |
|------|------|--------|
| Backend starts | `python app/main.py` | ✓ No errors |
| Chat endpoint responds | Ask "Do I have any alarms?" | ✓ Within 5-10 seconds |
| YouTrack works | Ask "Create a ticket" | ✓ Issue created |
| No "supervisor specialist" error | Any chat | ✓ Responses appear |

---

## 📋 Checklist

Before you start:
- [ ] Have you created a new YouTrack token?
- [ ] Did you copy it immediately?
- [ ] Did you update backend/.env with the new token?
- [ ] Did you verify SUPERVISOR_RUNTIME_ARN is in .env?
- [ ] Did you verify GATEWAY_URL is in .env?
- [ ] Did you save the .env file?
- [ ] Did you stop and restart the backend?

After you start:
- [ ] Backend shows "Application startup complete"
- [ ] Chat responds "Supervisor analyzing..."
- [ ] Responses arrive within 10 seconds
- [ ] No "supervisor specialist could not complete" errors

---

## Still Stuck?

Check the detailed diagnostic report:
```
DEPLOYMENT_DIAGNOSTIC_REPORT.md
```

Or check backend logs for specific errors:
```bash
# View recent errors
tail -100 backend/logs/app.log 2>/dev/null || echo "No log file"

# Check if SUPERVISOR_RUNTIME_ARN is set
grep "SUPERVISOR_RUNTIME_ARN" backend/.env

# Check if YouTrack token is new
grep "YOUTRACK_TOKEN" backend/.env | grep -v "perm-S3Jpc2huYV9T"
```

---

## Summary

The issue is a **single invalid token + missing environment variables**.

**Fix:** 
1. Create new YouTrack token
2. Update .env file
3. Restart backend

**Time:** ~5 minutes  
**Result:** Full deployment ready ✓

Let me know if you need help! 🚀
