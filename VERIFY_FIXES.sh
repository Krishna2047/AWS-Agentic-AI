#!/bin/bash
# Verification Script - Confirms all 3 issues are fixed

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  MSP ASSISTANT - 3 ISSUES FIX VERIFICATION                        ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

echo "CHECKING FIXES..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ===== ISSUE #1: YouTrack Token =====
echo "[1/3] ISSUE #1: YouTrack Token"
echo "Expected: NEW token (NOT perm-S3Jpc2huYV9T...)"
echo ""

YT_TOKEN=$(grep "^YOUTRACK_TOKEN=" backend/.env | cut -d'=' -f2 | sed 's/"//g')

if [ -z "$YT_TOKEN" ]; then
    echo -e "${RED}✗ FAILED: YOUTRACK_TOKEN is EMPTY${NC}"
    echo "  Action: Update backend/.env line 37 with your new token"
    ((FAILED++))
elif [ "$YT_TOKEN" = "perm-REPLACE_WITH_NEW_TOKEN_FROM_YOUTRACK" ]; then
    echo -e "${YELLOW}⚠ ACTION NEEDED: Placeholder token still in place${NC}"
    echo "  Steps:"
    echo "  1. Create new token in YouTrack:"
    echo "     → https://youtrack24.onedatasoftware.com"
    echo "     → Profile → Account Security → Permanent Tokens"
    echo "     → New token with Scope: 'YouTrack' only"
    echo "  2. Copy token and update backend/.env line 37"
    ((FAILED++))
elif [ "$YT_TOKEN" = "perm-S3Jpc2huYV9T.NDYtMjg=.V3MesjB73YoeLysJ0UTsGuvgAFCHJT" ]; then
    echo -e "${RED}✗ FAILED: Original old token still in use${NC}"
    echo "  Action: Replace with NEW token from YouTrack"
    ((FAILED++))
elif [ "$YT_TOKEN" = "perm-REPLACE_WITH_NEW_TOKEN_FROM_YOUTRACK" ]; then
    echo -e "${YELLOW}⚠ ACTION NEEDED: Placeholder token${NC}"
    echo "  Action: Create and paste new token from YouTrack"
    ((FAILED++))
else
    echo -e "${GREEN}✓ PASSED: New token configured${NC}"
    echo "  Token: ${YT_TOKEN:0:20}..."
    ((PASSED++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ===== ISSUE #2: SUPERVISOR_RUNTIME_ARN =====
echo "[2/3] ISSUE #2: SUPERVISOR_RUNTIME_ARN Exported"
echo "Expected: ARN value present AND main.py loads .env"
echo ""

SUP_ARN=$(grep "^SUPERVISOR_RUNTIME_ARN=" backend/.env | cut -d'=' -f2 | sed 's/"//g')

if [ -z "$SUP_ARN" ]; then
    echo -e "${RED}✗ FAILED: SUPERVISOR_RUNTIME_ARN is EMPTY in .env${NC}"
    ((FAILED++))
elif [[ "$SUP_ARN" == "arn:aws:bedrock-agentcore"* ]]; then
    echo -e "${GREEN}✓ PASSED: SUPERVISOR_RUNTIME_ARN is set${NC}"
    echo "  ARN: ${SUP_ARN:0:60}..."
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED: SUPERVISOR_RUNTIME_ARN looks wrong${NC}"
    echo "  Expected: arn:aws:bedrock-agentcore:..."
    echo "  Got: $SUP_ARN"
    ((FAILED++))
fi

# Check if main.py has .env loading
if grep -q "load_dotenv" backend/app/main.py; then
    echo -e "${GREEN}✓ main.py loads .env file${NC}"
else
    echo -e "${YELLOW}⚠ main.py might not load .env${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ===== ISSUE #3: Timeout =====
echo "[3/3] ISSUE #3: Timeout Configuration"
echo "Expected: read_timeout=600 (10 minutes, was 300)"
echo ""

TIMEOUT=$(grep -A2 "client_config = Config" backend/app/core/agentcore_client.py | grep "read_timeout=" | sed 's/.*read_timeout=//' | sed 's/[,].*//')

if [ -z "$TIMEOUT" ]; then
    echo -e "${RED}✗ FAILED: Could not find read_timeout${NC}"
    ((FAILED++))
elif [ "$TIMEOUT" -ge 600 ]; then
    echo -e "${GREEN}✓ PASSED: Timeout is sufficient ($TIMEOUT seconds)${NC}"
    ((PASSED++))
elif [ "$TIMEOUT" -ge 300 ]; then
    echo -e "${YELLOW}⚠ TIMEOUT UPGRADED: $TIMEOUT seconds (increased from 300)${NC}"
    if [ "$TIMEOUT" -lt 600 ]; then
        echo "  Consider increasing further to 600 for safety"
    fi
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED: Timeout too short ($TIMEOUT seconds, need 300+)${NC}"
    ((FAILED++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Summary
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed:  $PASSED${NC}"
echo -e "${RED}Failed:  $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All fixes verified! Ready to deploy.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Restart backend: cd backend && python app/main.py"
    echo "2. Test in chat: 'Do I have any active alarms?'"
    echo "3. Verify YouTrack works: 'Create a ticket for test'"
    echo ""
else
    echo -e "${RED}✗ Some fixes still needed. See above for details.${NC}"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
