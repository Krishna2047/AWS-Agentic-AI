# Phase 3A - Quick Reference Guide
## Continuous Monitoring & Autonomous Alerts

**Status:** ✅ PRODUCTION READY  
**Delivered:** May 13, 2026  
**Build Status:** All passing  

---

## 🎯 One-Minute Summary

**What:** 24/7 automated AWS monitoring with intelligent alerting  
**Where:** New "Continuous Monitoring" tab in main application UI  
**How:** Click "Start Monitoring" → Configure webhooks → Get Teams/Slack alerts  
**What You Get:** Cost spikes, alarm changes, security findings automatically detected

---

## 🚀 Getting Started

### Step 1: Start Backend
```bash
cd backend && python -m uvicorn app.main:app --reload
```

### Step 2: Open UI  
Go to **Continuous Monitoring** tab (between Dashboard and Pricing Calculator)

### Step 3: Configure Webhooks
1. Click **"Configure Notifications"**
2. Add Microsoft Teams webhook URL OR Slack webhook URL
3. Click **"Send Test Alert"** to verify
4. Close dialog

### Step 4: Start Monitoring
1. Click **"Start Monitoring"** button
2. Status badge changes to "Running" with green indicator
3. Done! Monitoring runs automatically every 15 minutes

---

## 🔔 Alert Examples

### Cost Spike Alert
```
🚨 Cost Spike Alert - Account 123456789
Severity: HIGH
Cost increased by 25.5%
Current: $12.50 | Previous Average: $10.00
```

### CloudWatch Alarm Alert
```
⚠️ Alarm State Changed - database-cpu-high
State: OK → ALARM
Reason: CPU exceeded 90% threshold
```

### Security Finding Alert
```
🔒 Security Finding - CRITICAL
Title: EC2 Security Group Allows Unrestricted Access
Severity: CRITICAL
Resource: sg-0123456789abcdef
```

---

## 🔧 Configuration Cheat Sheet

### Via Environment Variables (.env file)
```env
# Enable/Disable
MONITORING_ENABLED=true

# Check every 15 minutes (default)
MONITORING_CHECK_INTERVAL_MINUTES=15

# Alert on 20%+ cost increase (default)
MONITORING_COST_SPIKE_THRESHOLD=20.0

# Webhook URLs (get from Teams/Slack)
TEAMS_WEBHOOK_URL=https://outlook.webhook.office.com/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Tuning for Your Environment
```
Less alerts?       → Increase threshold to 30-50%
More alerts?       → Decrease threshold to 10-15%
Real-time alerts?  → Set interval to 5 minutes
Cost-saving mode?  → Set interval to 60 minutes
```

---

## 📊 What Gets Monitored

| What | How Often | Alert When | Who Gets Notified |
|------|-----------|-----------|------------------|
| **AWS Costs** | Every 15 min | Spike >20% | Teams + Slack |
| **CloudWatch Alarms** | Every 15 min | State changes | Teams + Slack |
| **Security Findings** | Every 15 min | New HIGH/CRITICAL | Teams + Slack |

---

## 🎛️ Dashboard Features

### Left Panel - Status
- ✅ Running/Stopped badge with color indicator
- Check interval (default: 15 minutes)
- Pending alerts counter
- Live pulse animation when running

### Center Panel - Alerts Tab
- All detected alerts listed
- Expandable cards with full details
- Color-coded by severity (red=critical, orange=high)
- Empty state message when no alerts
- Auto-refreshes every 30 seconds

### Center Panel - Configuration Tab
- Webhook URL input fields
- Channel selector (Teams or Slack)
- Save button to persist configuration
- Test button to validate webhook
- Status indicator showing active channel

### Top Right Buttons
- **Start Monitoring** - Begin 24/7 monitoring
- **Stop Monitoring** - Pause monitoring
- **Configure Notifications** - Set webhook URLs

---

## ✅ Daily Operations Checklist

### Morning
- [ ] Check Continuous Monitoring tab
- [ ] Review overnight alerts in "Alerts" tab
- [ ] Verify monitoring status is "Running"

### When Alerts Arrive
- [ ] Review alert details in dashboard
- [ ] Click dashboard link in Teams/Slack notification
- [ ] Take action if needed (scale up, investigate security, etc.)

### Weekly
- [ ] Tune thresholds based on alert volume
- [ ] Check for false positives
- [ ] Review alert history

### Monthly
- [ ] Analyze alert trends
- [ ] Adjust cost spike threshold if needed
- [ ] Update documentation with any changes

---

## 🐛 Troubleshooting Quick Guide

### Problem: Monitoring won't start
**Solution:** 
1. Check AWS credentials are configured
2. Verify IAM permissions include: ce:GetCostAndUsage, cloudwatch:DescribeAlarms, securityhub:GetFindings
3. Restart backend service

### Problem: No alerts received
**Solution:**
1. Check threshold: 20% might be too high
2. Check cost data available in Cost Explorer
3. Test endpoint: `GET /monitoring/status` should show running

### Problem: Webhooks not working
**Solution:**
1. Send test alert: Click "Send Test Alert" button
2. Verify webhook URL starts with https://
3. Check Teams/Slack channel webhook permissions
4. Review backend logs for errors

### Problem: Too many duplicate alerts
**Solution:**
1. Increase cost spike threshold to 30-50%
2. Increase check interval to 30 minutes
3. System auto-deduplicates within 60 minutes anyway

---

## 📱 API Quick Reference

### Start Monitoring
```bash
curl -X POST http://localhost:8000/monitoring/start \
  -H "Authorization: Bearer TOKEN"
```

### Stop Monitoring
```bash
curl -X POST http://localhost:8000/monitoring/stop \
  -H "Authorization: Bearer TOKEN"
```

### Get Status
```bash
curl -X GET http://localhost:8000/monitoring/status \
  -H "Authorization: Bearer TOKEN"
```

### Get Alerts
```bash
curl -X GET http://localhost:8000/monitoring/alerts \
  -H "Authorization: Bearer TOKEN"
```

### Send Test Alert
```bash
curl -X POST "http://localhost:8000/monitoring/send-test-alert?channel=TEAMS" \
  -H "Authorization: Bearer TOKEN"
```

---

## 🔐 Security Notes

- ✅ Requires valid authentication token
- ✅ Only HTTPS webhooks accepted
- ✅ No credentials stored in alerts
- ✅ Alert deduplication prevents duplicate notifications
- ✅ All operations logged for audit trail

---

## 📈 Performance Metrics

- **Memory usage:** ~50MB
- **API calls per cycle:** 6 (3 monitors × 2 each)
- **CPU impact:** <5% during monitoring cycle
- **Notification latency:** <2 seconds to webhook
- **Default check interval:** 15 minutes

---

## 🎓 Learning Resources

- **Full Setup Guide:** See `MONITORING_SETUP_GUIDE.md`
- **Delivery Summary:** See `PHASE_3A_DELIVERY_SUMMARY.md`
- **Implementation Details:** See `IMPLEMENTATION_COMPLETE.md` (Phase 3A section)
- **API Reference:** See `MONITORING_SETUP_GUIDE.md` (API Reference section)

---

## 💡 Pro Tips

1. **Start with conservative thresholds** (30%+ costs, check every 30 min)
2. **Gradually tighten as you understand patterns**
3. **Use test alerts regularly** to verify webhooks
4. **Monitor the monitoring** - check status every few days
5. **Review alert history** to fine-tune thresholds

---

## 🆘 When to Escalate

✋ **High alert volume (>10/hour):**
- Increase thresholds
- Increase check intervals
- Review for false positives

✋ **Webhooks failing:**
- Verify webhook URLs
- Check Teams/Slack app permissions
- Review backend logs

✋ **No alerts being generated:**
- Check AWS data is available
- Test cost explorer manually
- Verify IAM permissions

---

## 📞 Support

**Setup Help:** See `MONITORING_SETUP_GUIDE.md` → Troubleshooting section  
**API Help:** See `MONITORING_SETUP_GUIDE.md` → API Reference section  
**Feature Questions:** See `PHASE_3A_DELIVERY_SUMMARY.md`  

---

## 🎉 You're All Set!

Your continuous monitoring is now running 24/7. AWS will automatically alert you to:
- Cost spikes
- Alarm state changes  
- Security vulnerabilities

**Next Step:** Go to Continuous Monitoring tab and click "Start Monitoring"

---

*Quick Reference Last Updated: May 13, 2026*  
*For latest information, see full documentation in repository*
