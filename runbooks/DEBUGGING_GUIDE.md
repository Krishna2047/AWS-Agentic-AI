# Debugging Guide: Unicode Decode Error in MSP Ops Automation

## Problem Summary
The application shows "An error occurred processing your request" for all queries due to a UnicodeDecodeError when loading env_config.txt files.

## Root Cause
env_config.txt files contain UTF-8 special characters (e.g., '✓') but are being opened without specifying encoding, causing decode errors on Windows (defaults to cp1252).

## What You Need to Check

### 1. Check the env_config.txt Files (CRITICAL)
**Location:** Multiple locations:
- `agents/runtime/env_config.txt`
- `agents/runtime_advisor/env_config.txt`
- `agents/runtime_cloudwatch/env_config.txt`
- `agents/runtime_cost/env_config.txt`
- `agents/runtime_knowledge/env_config.txt`
- `agents/runtime_security/env_config.txt`
- `agents/runtime_youtrack/env_config.txt`

**What to check:**
```bash
# Look for UTF-8 characters like checkmarks (✓)
Get-Content agents/runtime/env_config.txt | Select-String "✓" 2>&1

# Check file encoding
$file = Get-Item "agents/runtime/env_config.txt"
[System.Text.Encoding]::GetEncoding(1252).GetString([System.IO.File]::ReadAllBytes($file.FullName)) | Select-String "✓"
```

**Expected:** Files contain UTF-8 special characters
**Problem:** Opening without UTF-8 encoding causes decode errors

### 2. Check Python Files That Load env_config.txt (CRITICAL)

**Location:**
- `agents/runtime/supervisor_agent.py`
- `agents/runtime/supervisor_tools.py`
- `agents/runtime_youtrack/youtrack_a2a_runtime.py`

**What to check:**
```bash
# Look for env_config.txt loading code
Select-String -Path "agents/runtime/supervisor_agent.py" -Pattern "env_config.txt"
Select-String -Path "agents/runtime/supervisor_tools.py" -Pattern "env_config.txt"
Select-String -Path "agents/runtime_youtrack/youtrack_a2a_runtime.py" -Pattern "env_config.txt"
```

**Expected (CORRECT):**
```python
with open('env_config.txt', 'r', encoding='utf-8', errors='ignore') as _f:
```

**Problem (INCORRECT):**
```python
with open('env_config.txt', 'r') as _f:  # <-- Missing encoding!
```

### 3. Check Backend Configuration Files

**Location:**
- `backend/app/core/config_loader.py`
- `backend/.env`

**What to check:**
```bash
# Check config_loader.py loads .env file
Select-String -Path "backend/app/core/config_loader.py" -Pattern "load_dotenv"

# Check .env file exists
Test-Path "backend/.env"
```

**Expected:** Backend loads backend/.env file with dotenv
**Problem:** If .env missing, backend might not have required config

### 4. Check AgentCore Configuration

**Location:**
- `backend/app/core/config.py`
- `infrastructure/cdk/stacks/backend_stack.py`

**What to check:**
```bash
# Check for A2A ARN configuration
Select-String -Path "backend/app/core/config.py" -Pattern "A2A_ARN"

# Check backend stack sets environment variables
Select-String -Path "infrastructure/cdk/stacks/backend_stack.py" -Pattern "A2A_ARN"
```

**Expected:** A2A ARNs configured for specialist agents
**Problem:** Missing ARNs means agents can't invoke specialists

## Debugging Steps

### Step 1: Verify Unicode Fix is Applied
```powershell
# Check all three files have the fix
$files = @(
    "agents/runtime/supervisor_agent.py",
    "agents/runtime/supervisor_tools.py",
    "agents/runtime_youtrack/youtrack_a2a_runtime.py"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    if ($content -match "encoding='utf-8'" -and $content -match "errors='ignore'") {
        Write-Host "✓ $file - UTF-8 fix present"
    } else {
        Write-Host "✗ $file - UTF-8 fix MISSING"
    }
}
```

### Step 2: Test env_config.txt Loading
```powershell
# Test loading without errors
$files = Get-ChildItem -Path "agents/runtime*" -Include "env_config.txt" -Recurse
foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Encoding UTF8 -Raw
        Write-Host "✓ $($file.Directory.Name) - Loaded successfully ($($content.Length) chars)"
    } catch {
        Write-Host "✗ $($file.Directory.Name) - Error: $_"
    }
}
```

### Step 3: Check Backend Environment
```powershell
# Verify backend can load config
Set-Location backend
python -c "from app.core.config_loader import *; print('MODEL:', MODEL)"
```

### Step 4: Check Application Logs
```powershell
# If application is running, check logs for errors
# Look for:
# - "UnicodeDecodeError"
# - "Error processing invocation"
# - "Error invoking {agent} agent"
```

## Quick Fix Verification

Run this comprehensive test:
```powershell
Set-Location agents/runtime
python -c @"
import sys, os

print("Checking UTF-8 fix...")
files = ['supervisor_agent.py', 'supervisor_tools.py']

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
        if 'encoding=utf-8' in content and 'errors=ignore' in content:
            print(f'✓ {f} - OK')
        else:
            print(f'✗ {f} - MISSING FIX')
            sys.exit(1)

print()
print("Testing env_config.txt loading...")
with open('env_config.txt', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()
    print(f"✓ Loaded {len(lines)} lines")

print()
print("SUCCESS: All checks passed!")
"@
```

## Common Issues and Fixes

### Issue 1: Missing UTF-8 Encoding
**Symptom:** `UnicodeDecodeError: 'charmap' codec can't decode byte 0x9d`
**Fix:** Add `encoding='utf-8', errors='ignore'` to all `open('env_config.txt')` calls

### Issue 2: Wrong File Paths
**Symptom:** `FileNotFoundError` when loading env_config.txt
**Fix:** Ensure code runs from correct directory or use absolute paths

### Issue 3: Missing Dependencies
**Symptom:** `ModuleNotFoundError: No module named 'strands'`
**Fix:** Install dependencies or run in proper AgentCore runtime environment

### Issue 4: Incorrect Environment Variables
**Symptom:** Agents can't authenticate or find resources
**Fix:** Check backend/.env and env_config.txt have correct values

## What to Look For in Logs

### Error Pattern 1: Unicode Decode
```
UnicodeDecodeError: 'charmap' codec can't decode byte 0x9d in position 37
```
**Meaning:** UTF-8 fix not applied

### Error Pattern 2: Agent Invocation
```
Error invoking {agent} agent after 4 attempts
```
**Meaning:** Specialist agent not available or credentials wrong

### Error Pattern 3: Configuration
```
GATEWAY_URL not set
```
**Meaning:** env_config.txt not loaded or missing variables

## Testing After Fix

1. **Syntax Check:** All Python files compile without errors
2. **Encoding Check:** env_config.txt loads without decode errors
3. **Variable Check:** All required environment variables present
4. **Agent Check:** Supervisor and specialist agents can be created (in deployed environment)

## Summary Checklist

- [ ] All `open('env_config.txt')` calls use `encoding='utf-8', errors='ignore'`
- [ ] Files modified: supervisor_agent.py, supervisor_tools.py, youtrack_a2a_runtime.py
- [ ] backend/.env exists and has correct configuration
- [ ] All required environment variables present (YOUTRACK_URL, GATEWAY_URL, A2A ARNs)
- [ ] No syntax errors in modified files
- [ ] Application logs show successful agent initialization

## Files Modified Summary

✅ **supervisor_agent.py** - UTF-8 fix + Jira→YouTrack updates  
✅ **supervisor_tools.py** - UTF-8 fix + Jira→YouTrack updates  
✅ **youtrack_a2a_runtime.py** - UTF-8 fix (new file)  

**Total:** 3 files with UTF-8 encoding fix applied
