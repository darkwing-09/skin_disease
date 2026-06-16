#!/bin/bash
# ============================================================
# DermAI Hospital — Full Prediction Pipeline Test
# ============================================================
set -e
BASE="http://localhost:7860"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  PHASE 3 — Full Prediction Pipeline Test"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Register admin user ──────────────────────────────
echo "━━━ Step 1a: Register admin user ━━━"
ADMIN_RESP=$(curl -s -X POST "$BASE/auth/register?username=admin&email=admin@dermai.hospital&password=Admin12345&full_name=System+Administrator&department=IT&role=admin")
echo "$ADMIN_RESP" | python3 -m json.tool 2>/dev/null || echo "$ADMIN_RESP"
echo ""

# ── Step 1b: Register doctor user ────────────────────────────
echo "━━━ Step 1b: Register doctor user ━━━"
DOC_RESP=$(curl -s -X POST "$BASE/auth/register?username=dr_sharma&email=sharma@dermai.hospital&password=Doctor12345&full_name=Priya+Sharma&department=Dermatology&role=doctor")
echo "$DOC_RESP" | python3 -m json.tool 2>/dev/null || echo "$DOC_RESP"
echo ""

# ── Step 2: Login as doctor ──────────────────────────────────
echo "━━━ Step 2: Login as doctor (POST /auth/login) ━━━"
LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=dr_sharma&password=Doctor12345")
echo "$LOGIN_RESP" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESP"

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to extract JWT token. Aborting."
  exit 1
fi
echo ""
echo "  ✅ JWT Token captured (first 40 chars): ${TOKEN:0:40}..."
echo ""

# ── Step 3: Create test patient ──────────────────────────────
echo "━━━ Step 3: Create test patient (POST /patients/) ━━━"
PAT_RESP=$(curl -s -X POST "$BASE/patients/?full_name=John+Doe&date_of_birth=1985-04-12&gender=Male&blood_group=B%2B&contact_number=+91-9876543210&medical_history=No+known+allergies" \
  -H "Authorization: Bearer $TOKEN")
echo "$PAT_RESP" | python3 -m json.tool 2>/dev/null || echo "$PAT_RESP"

PATIENT_ID=$(echo "$PAT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['patient_id'])" 2>/dev/null)
echo ""
echo "  ✅ Patient ID: $PATIENT_ID"
echo ""

# ── Step 4: Upload image & run prediction ────────────────────
echo "━━━ Step 4: Upload skin image & predict (POST /predict/) ━━━"
PRED_RESP=$(curl -s -X POST "$BASE/predict/" \
  -H "Authorization: Bearer $TOKEN" \
  -F "patient_id=$PATIENT_ID" \
  -F "file=@test_skin.jpg;type=image/jpeg" \
  -F "doctor_notes=Test scan for pipeline verification — Phase 3")
echo "$PRED_RESP" | python3 -m json.tool 2>/dev/null || echo "$PRED_RESP"

IMAGE_ID=$(echo "$PRED_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['image_id'])" 2>/dev/null)
echo ""
echo "  ✅ Image ID: $IMAGE_ID"
echo ""

# ── Step 5: Download annotated PNG report ────────────────────
echo "━━━ Step 5: Download annotated PNG report (GET /reports/{image_id}/image) ━━━"
HTTP_CODE=$(curl -s -o test_report.png -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/reports/$IMAGE_ID/image")
echo "  HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  FILE_SIZE=$(stat -c%s test_report.png 2>/dev/null || stat -f%z test_report.png 2>/dev/null)
  echo "  ✅ Report PNG saved: test_report.png ($FILE_SIZE bytes)"
  # Get image dimensions
  python3 -c "from PIL import Image; im=Image.open('test_report.png'); print(f'  Dimensions: {im.size[0]}x{im.size[1]} px')" 2>/dev/null || true
else
  echo "  ❌ Failed to download PNG report"
  cat test_report.png 2>/dev/null
fi
echo ""

# ── Step 6: Download A4 PDF report ───────────────────────────
echo "━━━ Step 6: Download A4 PDF report (GET /reports/{image_id}/pdf) ━━━"
HTTP_CODE=$(curl -s -o test_report.pdf -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/reports/$IMAGE_ID/pdf")
echo "  HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  FILE_SIZE=$(stat -c%s test_report.pdf 2>/dev/null || stat -f%z test_report.pdf 2>/dev/null)
  echo "  ✅ Report PDF saved: test_report.pdf ($FILE_SIZE bytes)"
else
  echo "  ❌ Failed to download PDF report"
  cat test_report.pdf 2>/dev/null
fi
echo ""

# ── Step 7: Verify prediction in PostgreSQL ──────────────────
echo "━━━ Step 7: Verify prediction record in PostgreSQL ━━━"
docker exec skin-disease-hospital-backend-db-1 psql -U dermuser -d dermaidb -c \
  "SELECT image_id, top_prediction, confidence, model_version, status, doctor_notes, created_at FROM predictions ORDER BY created_at DESC LIMIT 1;"
echo ""

# ── Step 8: Verify audit log ─────────────────────────────────
echo "━━━ Step 8: Verify audit log entry ━━━"
docker exec skin-disease-hospital-backend-db-1 psql -U dermuser -d dermaidb -c \
  "SELECT action, entity_type, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 3;"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  PIPELINE TEST COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Files generated:"
echo "  • test_report.png — Annotated diagnostic image"
echo "  • test_report.pdf — A4 clinical PDF report"
echo ""
echo "Key values for Phase 4 (RLHF):"
echo "  • IMAGE_ID: $IMAGE_ID"
echo "  • TOKEN:    ${TOKEN:0:40}..."
echo ""
