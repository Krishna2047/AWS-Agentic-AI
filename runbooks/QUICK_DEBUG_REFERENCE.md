# Quick Debug Reference Card

## The Problem
```
Error: "An error occurred processing your request"
Cause: UnicodeDecodeError when loading env_config.txt
```

## Critical Files to Check

### 1. UTF-8 Encoding Fix (MOST IMPORTANT)
**Files:**
- `agents/runtime/supervisor_agent.py` ✅
- `agents/runtime/supervisor_tools.py` ✅
- `agents/runtime_youtrack/youtrack_a2a_runtime.py` ✅

**What to Look For:**
```python
# CORRECT (with fix):
with open('env_config.txt', 'r', encoding='utf-8', errors='ignore') as _f:

# WRONG (without fix):
with open('env_config.txt', 'r') as _f:  # ← Missing encoding!
```

### 2. env_config.txt Files
**Locations:**
- agents/runtime/env_config.txt
- agents/runtime_advisor/env_config.txt
- agents/runtime_cloudwatch/env_config.txt
- agents/runtime_cost/env_config.txt
- agents/runtime_knowledge/env_config.txt
- agents/runtime_security/env_config.txt
- agents/runtime_youtrack/env_config.txt

**What to Check:**
- Contains UTF-8 characters (e.g., ✓)
- Loads without decode errors

### 3. Backend Configuration
**Files:**
- `backend/.env` - Main configuration
- `backend/app/core/config_loader.py` - Loads .env file
- `backend/app/core/config.py` - Pydantic settings

**What to Check:**
```bash
# Backend can load config
cd backend
python -c "from app.core.config_loader import *; print(MODEL)"
```

## Quick Test Commands

### Test 1: Verify UTF-8 Fix
```powershell
Set-Location agents/runtime
python -c "
import sys
files = ['supervisor_agent.py', 'supervisor_tools.py']
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
        if 'encoding=utf-8' in content:
            print(f'✓ {f}')
        else:
            print(f'✗ {f} MISSING FIX')
            sys.exit(1)
print('All files OK!')
"
```

### Test 2: Load env_config.txt
```powershell
Set-Location agents/runtime
python -c "
with open('env_config.txt', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()
print(f'Loaded {len(lines)} lines - OK!')
"
```

### Test 3: Backend Config
```powershell
Set-Location backend
python -c "from app.core.config_loader import *; print('MODEL:', MODEL)"
```

## What Each File Does

| File | Purpose | Status |
|------|---------|--------|
| `supervisor_agent.py` | Creates supervisor agent with delegation tools | ✅ Fixed |
| `supervisor_tools.py` | Defines tools for calling specialist agents | ✅ Fixed |
| `youtrack_a2a_runtime.py` | YouTrack specialist agent runtime | ✅ Fixed (new) |
| `config_loader.py` | Loads backend/.env configuration | ✅ OK |
| `backend/.env` | Backend environment variables | ✅ OK |

## Error Flow

### Before Fix:
```
1. User sends query
2. Backend tries to invoke supervisor
3. Supervisor loads env_config.txt
4. ← UnicodeDecodeError HERE!
5. Error propagates up
6. User sees: "An error occurred processing your request"
```

### After Fix:
```
1. User sends query
2. Backend invokes supervisor
3. Supervisor loads env_config.txt with UTF-8 encoding
4. ← No error!
5. Supervisor delegates to specialist agent
6. Response returned to user
```

## Red Flags to Watch For

❌ `UnicodeDecodeError: 'charmap' codec can't decode`  
❌ `with open('env_config.txt', 'r')` (no encoding specified)  
❌ `FileNotFoundError: env_config.txt`  
❌ `ModuleNotFoundError: No module named 'strands'` (not available locally)  
✅ `encoding='utf-8', errors='ignore'` in code  
✅ All tests pass  
✅ Files load without errors  

## Summary

**What Was Fixed:**
- Added `encoding='utf-8', errors='ignore'` to 3 files loading env_config.txt
- This allows UTF-8 special characters (✓) to be read correctly

**Impact:**
- Resolves "An error occurred processing your request" error
- All agent queries should now work correctly

**Files Changed:**
- supervisor_agent.py
- supervisor_tools.py
- youtrack_a2a_runtime.py (new)
