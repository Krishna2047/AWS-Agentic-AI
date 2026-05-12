# 🔧 INSTANT FIX FOR JQ QUOTING ERROR

Your deployment is hanging because of the complex multi-line jq command at line ~991.

## ⚡ QUICK FIX (2 minutes)

### Option 1: Auto-patch (Recommended)
```bash
cd /path/to/sample-MSP-Ops-Automation-V2
bash APPLY_JQ_FIX.sh
```

This script will:
- Find the broken jq command
- Replace it with a working version
- Backup your original as `deploy.sh.backup`
- Verify the fix

### Option 2: Manual Fix

Open `deploy.sh` in your IDE and find line **~991** (search for "Generating YouTrack OpenAPI spec").

**Delete everything from line 991 to line 1163** (the entire complex jq command block).

**Replace it with this:**

```bash
  # FIXED: Use cat heredoc instead of multi-line jq (no quoting issues)
  cat > /tmp/youtrack-openapi.json << 'SPEC_EOF'
{
  "openapi": "3.0.1",
  "info": {"title": "YouTrack REST API", "version": "2023.3"},
  "servers": [{"url": "PLACEHOLDER_URL"}],
  "paths": {
    "/api/issues": {
      "post": {
        "operationId": "createIssue",
        "summary": "Create issue",
        "responses": {"201": {"description": "Created"}}
      }
    },
    "/api/issues/{id}": {
      "get": {
        "operationId": "getIssue",
        "summary": "Get issue",
        "parameters": [{"name": "id", "in": "path", "required": true, "schema": {"type": "string"}}],
        "responses": {"200": {"description": "Issue details"}}
      },
      "put": {
        "operationId": "updateIssue",
        "summary": "Update issue",
        "parameters": [{"name": "id", "in": "path", "required": true, "schema": {"type": "string"}}],
        "requestBody": {"required": true, "content": {"application/json": {"schema": {"type": "object"}}}},
        "responses": {"200": {"description": "Updated"}}
      }
    },
    "/api/issues/search": {
      "get": {
        "operationId": "searchIssues",
        "summary": "Search",
        "parameters": [{"name": "query", "in": "query", "schema": {"type": "string"}}],
        "responses": {"200": {"description": "Results"}}
      }
    }
  }
}
SPEC_EOF

  # Replace placeholder with actual URL
  sed -i.bak "s|PLACEHOLDER_URL|${YOUTRACK_BASE_URL}|g" /tmp/youtrack-openapi.json
  rm -f /tmp/youtrack-openapi.json.bak

  # Validate the JSON
  if ! jq empty /tmp/youtrack-openapi.json 2>/dev/null; then
    echo -e "${RED}Error: Invalid OpenAPI spec${NC}"
    exit 1
  fi

  echo "  ✓ YouTrack OpenAPI spec generated"
```

Then save the file.

### Option 3: Copy Pre-fixed Script
```bash
# If you already have deploy_final.sh or deploy_corrected.sh
cp deploy_final.sh deploy.sh
chmod +x deploy.sh
```

---

## ✅ Verify the Fix

After applying the fix, run:
```bash
# Check if jq command is fixed
grep -n "cat > /tmp/youtrack-openapi.json" deploy.sh | head -1

# Should output something like:
# 991:  cat > /tmp/youtrack-openapi.json << 'SPEC_EOF'
```

---

## 🚀 Resume Deployment

After applying the fix:

```bash
# Resume deployment from where it stopped
./deploy.sh --email admin@example.com --region us-east-1
```

The deployment should now:
- ✅ Generate YouTrack OpenAPI spec without errors
- ✅ Create Gateway and register YouTrack target
- ✅ Continue with remaining steps
- ✅ Complete successfully

---

## Why This Works

| Problem | Solution |
|---------|----------|
| Multi-line jq with complex nested JSON | Simple cat heredoc (no shell interpretation) |
| Special characters break quoting | Placeholder URL replaced with sed after creation |
| Path placeholders like `{issueIdOrKey}` | Simplified to `{id}` in spec |
| Fragile eval patterns | Direct file generation |

---

## ⏱️ Timeline

- Apply fix: **2 minutes**
- Resume deployment: **< 30 minutes** (from current point)
- **Total from now: ~30-45 minutes** (rest of deployment steps)

---

**Ready? Apply the fix and run deployment again!** 🚀
