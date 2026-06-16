#!/bin/bash
# ============================================================
# DermAI Hospital — RLHF Feedback & Retraining Test Script
# ============================================================
set -e
BASE="http://localhost:7860"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  PHASE 4 — RLHF Feedback Loop Test"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Login as doctor ──────────────────────────────────────────
echo "━━━ Step 1a: Login as dr_sharma (Doctor) ━━━"
DOC_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=dr_sharma&password=Doctor12345")
DOC_TOKEN=$(echo "$DOC_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
if [ -z "$DOC_TOKEN" ]; then
  echo "ERROR: Doctor login failed. Response: $DOC_LOGIN"
  exit 1
fi
echo "  ✅ Doctor login successful."
echo ""

# ── Query latest prediction ──────────────────────────────────
echo "━━━ Step 1b: Fetch latest prediction from PostgreSQL ━━━"
PRED_ID_1=$(docker exec skin-disease-hospital-backend-db-1 psql -U dermuser -d dermaidb -t -A -c \
  "SELECT image_id FROM predictions ORDER BY created_at DESC LIMIT 1;")
if [ -z "$PRED_ID_1" ]; then
  echo "ERROR: No predictions found in database. Run Phase 3 first."
  exit 1
fi
echo "  ✅ Target prediction image_id: $PRED_ID_1"
echo ""

# ── Submit 👍 upvote ──────────────────────────────────────────
echo "━━━ Step 1c: Submit 👍 upvote for $PRED_ID_1 (POST /feedback/) ━━━"
UPVOTE_RESP=$(curl -s -X POST "$BASE/feedback/" \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image_id\": \"$PRED_ID_1\", \"vote\": \"up\", \"notes\": \"Model classification correct\"}")
echo "$UPVOTE_RESP" | python3 -m json.tool
echo ""

# ── Create second prediction ──────────────────────────────────
echo "━━━ Step 2: Create a second test prediction ━━━"
echo "  Uploading test_skin_2.jpg..."
PRED_RESP_2=$(curl -s -X POST "$BASE/predict/" \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -F "patient_id=HOSP-2026-00001" \
  -F "file=@test_skin_2.jpg;type=image/jpeg" \
  -F "doctor_notes=Second scan for RLHF verification")
echo "$PRED_RESP_2" | python3 -m json.tool

PRED_ID_2=$(echo "$PRED_RESP_2" | python3 -c "import sys,json; print(json.load(sys.stdin)['image_id'])" 2>/dev/null)
if [ -z "$PRED_ID_2" ]; then
  echo "ERROR: Failed to run second prediction. Response: $PRED_RESP_2"
  exit 1
fi
echo "  ✅ Second prediction image_id: $PRED_ID_2"
echo ""

# ── Submit 👎 downvote ────────────────────────────────────────
echo "━━━ Step 3: Submit 👎 downvote with corrected label ━━━"
DOWNVOTE_RESP=$(curl -s -X POST "$BASE/feedback/" \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image_id\": \"$PRED_ID_2\", \"vote\": \"down\", \"correct_label\": \"Eczema\", \"notes\": \"Model said Psoriasis but this is clearly Eczema\"}")
echo "$DOWNVOTE_RESP" | python3 -m json.tool
echo ""

# ── Try submitting duplicate feedback ─────────────────────────
echo "━━━ Step 4: Submit duplicate feedback (Expect 409 Conflict) ━━━"
DUP_RESP=$(curl -s -w "\nHTTP_CODE: %{http_code}\n" -X POST "$BASE/feedback/" \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"image_id\": \"$PRED_ID_2\", \"vote\": \"up\"}")
echo "$DUP_RESP"
echo ""

# ── Check feedback table in DB ────────────────────────────────
echo "━━━ Step 5: Check feedback table in PostgreSQL ━━━"
docker exec skin-disease-hospital-backend-db-1 psql -U dermuser -d dermaidb -c \
  "SELECT vote, correct_label, used_in_train FROM feedback;"
echo ""

# ── Login as admin and check dashboard ────────────────────────
echo "━━━ Step 6: Login as Admin and get stats (GET /admin/dashboard) ━━━"
ADMIN_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=Admin12345")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
if [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Admin login failed. Response: $ADMIN_LOGIN"
  exit 1
fi

DASH_RESP=$(curl -s -X GET "$BASE/admin/dashboard" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$DASH_RESP" | python3 -m json.tool
echo ""


echo "═══════════════════════════════════════════════════════════"
echo "  PHASE 5 — Celery Worker & Daily Retrain Test"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Verify Celery worker connection ───────────────────
echo "━━━ Step 1: Verify Celery worker connection ━━━"
docker compose logs worker --tail=15
echo ""

# ── Step 2: Manually trigger retraining ───────────────────────
echo "━━━ Step 2: Trigger Retraining (POST /admin/trigger-retrain) ━━━"
RETRAIN_TRIGGER=$(curl -s -X POST "$BASE/admin/trigger-retrain" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$RETRAIN_TRIGGER" | python3 -m json.tool
echo ""

# ── Step 3: Monitor Celery worker logs ────────────────────────
echo "━━━ Step 3: Monitoring worker logs for training loop (15s) ━━━"
sleep 15
docker compose logs worker --tail=30
echo ""

# ── Step 4: Verify new model version in DB ────────────────────
echo "━━━ Step 4: Verify new model version in database ━━━"
docker exec skin-disease-hospital-backend-db-1 psql -U dermuser -d dermaidb -c \
  "SELECT version_tag, checkpoint_path, training_samples, accuracy, is_active, promoted_at FROM model_versions ORDER BY created_at DESC;"
echo ""

# ── Step 5: Verify active_version.txt was updated ──────────────
echo "━━━ Step 5: Verify active_version.txt in API container ━━━"
docker exec skin-disease-hospital-backend-api-1 cat /app/data/models/active_version.txt
echo ""

# ── Step 6: Verify health check shows v2 ──────────────────────
echo "━━━ Step 6: Verify health endpoint shows new version ━━━"
curl -s http://localhost:7860/health | python3 -m json.tool
echo ""

# ── Step 7: Run new prediction and verify model version ───────
echo "━━━ Step 7: Run new prediction on new model ━━━"
PRED_RESP_3=$(curl -s -X POST "$BASE/predict/" \
  -H "Authorization: Bearer $DOC_TOKEN" \
  -F "patient_id=HOSP-2026-00001" \
  -F "file=@test_skin.jpg;type=image/jpeg" \
  -F "doctor_notes=Post-retraining model verification scan")
echo "$PRED_RESP_3" | python3 -m json.tool
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  ✅ RLHF AND RETRAINING TEST COMPLETED"
echo "═══════════════════════════════════════════════════════════"
echo ""
