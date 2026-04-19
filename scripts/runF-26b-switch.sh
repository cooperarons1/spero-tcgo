#!/bin/bash
# Post-E6: final eval of e4b sweep → archive e4b labels → start fresh 26B-A4B
# labeler → retrain as Run F → final head-to-head vs Run E.
#
# Uses Gemma-4-26B-A4B (MoE, ~1,700/hr on M5) — quality ≈ 31B, speed > 31B.
# Expected wall: ~6h label + ~50min train + ~3min eval = ~7h total.

set -uo pipefail
cd "$(dirname "$0")/.."

LOG="logs/runF-$(date +%Y%m%d-%H%M%S).log"
PY=.venv/bin/python
TEACHER="mlx-community/gemma-4-26b-a4b-it-4bit"

log() { echo "[$(date +%H:%M:%S)] $*"; }

{
  log "=== Run F chain start (teacher=$TEACHER) ==="

  # ── Step 1: Final eval of the e4b sweep (E / E2-E6) ────────────────
  log "Step 1/5: eval e4b sweep — E / E2 / E3 / E4 / E5 / E6..."
  $PY -u scripts/eval_weights.py \
    --test-data data/sim-history-runC2.jsonl \
    --weights data/neural-eval-weights.runE.json \
    --weights data/neural-eval-weights.runE2.json \
    --weights data/neural-eval-weights.runE3.json \
    --weights data/neural-eval-weights.runE4.json \
    --weights data/neural-eval-weights.runE5.json \
    --weights data/neural-eval-weights.runE6.json \
    --test-fraction 0.05 \
    --max-test-positions 1000000 || true

  # ── Step 2: Archive e4b labels, clear for fresh 26B labeling ───────
  log "Step 2/5: archiving e4b labels..."
  if [ -f data/teacher-labels.jsonl ]; then
    mv data/teacher-labels.jsonl data/teacher-labels.e4b.bak.jsonl
    wc -l data/teacher-labels.e4b.bak.jsonl
  fi

  # ── Step 3: Start mlx_lm.server with Gemma-4-26B-A4B + label ───────
  log "Step 3/5: starting mlx_lm.server with $TEACHER..."
  nohup mlx_lm.server --model "$TEACHER" --port 8080 --host 127.0.0.1 > logs/mlx-runF-server.log 2>&1 &
  SERVER_PID=$!
  log "server pid=$SERVER_PID (26B-A4B cold start ~60s)"
  sleep 60
  until curl -sS -m 2 http://127.0.0.1:8080/v1/models >/dev/null 2>&1; do sleep 5; done
  log "Server up. Running 5-position smoke test..."
  TEACHER_MODEL="$TEACHER" $PY -u scripts/gemma_label_positions.py --max-positions 5 --output /tmp/runF-smoke.jsonl || {
    log "Smoke test failed — aborting"
    kill $SERVER_PID 2>/dev/null
    exit 1
  }
  rm -f /tmp/runF-smoke.jsonl
  log "Smoke OK. Labeling full 9,999 queue with 26B-A4B (ETA ~6h)..."
  TEACHER_MODEL="$TEACHER" $PY -u scripts/gemma_label_positions.py --resume > logs/gemma-label-26B.log 2>&1 || log "WARN: labeler exited non-zero"
  log "Labeler done. Total labels:"
  wc -l data/teacher-labels.jsonl

  # ── Step 4: Kill server, train Run F ───────────────────────────────
  log "Step 4/5: killing server, training Run F..."
  kill $SERVER_PID 2>/dev/null
  sleep 5
  $PY -u scripts/train_neural_eval.py \
    --simulation-data data/sim-history-runC2.jsonl \
    --teacher-labels data/teacher-labels.jsonl \
    --teacher-weight 0.3 \
    --output data/neural-eval-weights.runF.json \
    --model-size large \
    --epochs 60 \
    --batch-size 4096 \
    --label-mode both --gamma 0.95 \
    --dtype bf16 || log "WARN: training exited non-zero"
  log "Run F training done."

  # ── Step 5: Final head-to-head vs Run E + e4b sweep ────────────────
  log "Step 5/5: final head-to-head vs Run E..."
  $PY -u scripts/eval_weights.py \
    --test-data data/sim-history-runC2.jsonl \
    --weights data/neural-eval-weights.runE.json \
    --weights data/neural-eval-weights.runE3.json \
    --weights data/neural-eval-weights.runE5.json \
    --weights data/neural-eval-weights.runF.json \
    --test-fraction 0.05 \
    --max-test-positions 1000000 || true

  log "=== Run F chain done ==="
} > "$LOG" 2>&1
