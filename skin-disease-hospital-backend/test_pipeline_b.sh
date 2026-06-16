#!/bin/bash
# ============================================================
# DermAI Hospital — Prediction + Report Test (Phase 3b)
# Users and patient already registered.
# ============================================================
set -e
BASE="http://localhost:7860"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  PHASE 3b — Prediction & Report Pipeline"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Login as doctor ──────────────────────────────────────────
echo "━━━ Step 1: Login as dr_sharma ━━━"
LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=dr_sharma&password=Doctor12345")
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "  ✅ Logged in. Token: ${TOKEN:0:40}..."
echo ""

# ── Upload image & predict ───────────────────────────────────
echo "━━━ Step 2: Upload skin image & predict (POST /predict/) ━━━"
echo "  Uploading test_skin.jpg for patient HOSP-2026-00001..."
PRED_RESP=$(curl -s -X POST "$BASE/predict/" \
  -H "Authorization: Bearer $TOKEN" \
  -F "patient_id=HOSP-2026-00001" \
  -F "file=@test_skin.jpg;type=image/jpeg" \
  -F "doctor_notes=Test scan for pipeline verification — Phase 3")
echo "$PRED_RESP" | python3 -m json.tool
echo ""

IMAGE_ID=$(echo "$PRED_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['image_id'])" 2>/dev/null)
if [ -z "$IMAGE_ID" ]; then
  echo "  ❌ ERROR: No image_id returned. Check API logs."
  echo "  Response: $PRED_RESP"
  exit 1
fi
echo "  ✅ Image ID: $IMAGE_ID"
echo ""

# ── Download annotated PNG report ────────────────────────────
echo "━━━ Step 3: Download annotated PNG report ━━━"
HTTP_CODE=$(curl -s -o test_report.png -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/reports/$IMAGE_ID/image")
echo "  HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  FILE_SIZE=$(stat -c%s test_report.png)
  echo "  ✅ Report PNG saved: test_report.png ($FILE_SIZE bytes)"
  python3 -c "from PIL import Image; im=Image.open('test_report.png'); print(f'  Dimensions: {im.size[0]}x{im.size[1]} px')"
else
  echo "  ❌ Failed. Body:"
  cat test_report.png
fi
echo ""

# ── Download A4 PDF report ───────────────────────────────────
echo "━━━ Step 4: Download A4 PDF report ━━━"
HTTP_CODE=$(curl -s -o test_report.pdf -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/reports/$IMAGE_ID/pdf")
echo "  HTTP Status: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  FILE_SIZE=$(stat -c%s test_report.pdf)
  echo "  ✅ Report PDF saved: test_report.pdf ($FILE_SIZE bytes)"
else
  echo "  ❌ Failed. Body:"
  cat test_report.pdf
fi
echo ""

# ── Verify in PostgreSQL ─────────────────────────────────────
echo "━━━ Step 5: Verify prediction in PostgreSQL ━━━"
docker exec skin-disease-hospital-backend-db-1 psql -U dermuser -d dermaidb -c \
  "SELECT image_id, top_prediction, confidence, model_version, status, doctor_notes, created_at FROM predictions ORDER BY created_at DESC LIMIT 1;"
echo ""

echo "━━━ Step 6: Verify audit log entry ━━━"
docker exec skin-disease-hospital-backend-db-1 psql -U dermuser -d dermaidb -c \
  "SELECT action, entity_type, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 3;"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  ✅ PIPELINE TEST COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Generated files:"
echo "    • test_report.png — Annotated diagnostic image"
echo "    • test_report.pdf — A4 clinical PDF report"
echo ""
echo "  Values for Phase 4 (RLHF):"
echo "    IMAGE_ID=$IMAGE_ID"
echo ""
