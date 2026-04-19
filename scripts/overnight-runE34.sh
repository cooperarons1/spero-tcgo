#!/bin/bash
# Overnight chain: finish Run E3 → eval → full re-label → hyperparam sweep.
# Expected ~10.5h wall; caffeinate keeps M5 awake.
#
# Runs trained (all --model-size large, --epochs 60, bf16):
#   E2 (done)      — 3,495 Gemma labels, weight 0.5
#   E3 (pending)   — 3,495 Gemma labels, weight 0.3  [apples-to-apples vs E]
#   E4             — 9,999 Gemma labels, weight 0.3
#   E5             — 9,999 Gemma labels, weight 0.2
#   E6             — 9,999 Gemma labels, weight 0.5
#   E7             — 9,999 Gemma labels, weight 0.1
# Final eval compares all vs Run E (prod).

set -uo pipefail
cd "$(dirname "$0")/.."

LOG="logs/overnight-$(date +%Y%m%d-%H%M%S).log"
PY=.venv/bin/python

log() { echo "[$(date +%H:%M:%S)] $*"; }

train_run() {
  local tag="$1"
  local weight="$2"
  log "Training Run $tag (weight=$weight)..."
  $PY -u scripts/train_neural_eval.py \
    --simulation-data data/sim-history-runC2.jsonl \
    --teacher-labels data/teacher-labels.jsonl \
    --teacher-weight "$weight" \
    --output "data/neural-eval-weights.run${tag}.json" \
    --model-size large \
    --epochs 60 \
    --batch-size 4096 \
    --label-mode both --gamma 0.95 \
    --dtype bf16 || log "WARN: Run $tag train exited non-zero"
  log "Run $tag done."
  grep -E "Best val|Wrote weights" logs/train-run${tag}.log 2>/dev/null | tail -2 || true
}

{
  log "=== OVERNIGHT CHAIN START ==="

  # ── Step 1: Wait for current Run E3 training to complete ──────────
  log "Step 1/9: waiting for in-flight Run E3 training..."
  while pgrep -f "train_neural_eval.py" >/dev/null 2>&1; do sleep 60; done
  if [ ! -f data/neural-eval-weights.runE3.json ]; then
    log "ERROR: Run E3 weights not written. Aborting."
    tail -20 logs/train-runE3.log
    exit 1
  fi
  log "Run E3 done."
  grep -E "Best val|Wrote weights" logs/train-runE3.log | tail -2

  # ── Step 2: Eval E3 ────────────────────────────────────────────────
  log "Step 2/9: eval E vs E2 vs E3..."
  $PY -u scripts/eval_weights.py \
    --test-data data/sim-history-runC2.jsonl \
    --weights data/neural-eval-weights.runE.json \
    --weights data/neural-eval-weights.runE2.json \
    --weights data/neural-eval-weights.runE3.json \
    --test-fraction 0.05 \
    --max-test-positions 1000000 || true

  # ── Step 3: Start LLM server + resume labeler ─────────────────────
  log "Step 3/9: starting mlx_lm.server..."
  nohup mlx_lm.server --model mlx-community/gemma-4-e4b-it-8bit --port 8080 --host 127.0.0.1 > logs/mlx-overnight.log 2>&1 &
  SERVER_PID=$!
  log "server pid=$SERVER_PID"
  sleep 30
  until curl -sS -m 2 http://127.0.0.1:8080/v1/models >/dev/null 2>&1; do sleep 5; done
  log "Server up. Resuming labeler for ~6,500 more positions..."
  $PY -u scripts/gemma_label_positions.py --resume > logs/gemma-label-resume.log 2>&1 || log "WARN: labeler exited non-zero"
  log "Labeler done. Total labels:"
  wc -l data/teacher-labels.jsonl

  # ── Step 4: Kill LLM server ───────────────────────────────────────
  log "Step 4/9: killing LLM server (free GPU for training)..."
  kill $SERVER_PID 2>/dev/null || true
  sleep 5

  # ── Step 5: Run E4 — full labels, weight 0.3 ──────────────────────
  log "Step 5/9: Run E4"
  train_run E4 0.3 2>&1 | tee -a logs/train-runE4.log

  # ── Step 6: Run E5 — full labels, weight 0.2 ──────────────────────
  log "Step 6/9: Run E5"
  train_run E5 0.2 2>&1 | tee -a logs/train-runE5.log

  # ── Step 7: Run E6 — full labels, weight 0.5 ──────────────────────
  log "Step 7/9: Run E6"
  train_run E6 0.5 2>&1 | tee -a logs/train-runE6.log

  # ── Step 8: Run E7 — full labels, weight 0.1 ──────────────────────
  log "Step 8/9: Run E7"
  train_run E7 0.1 2>&1 | tee -a logs/train-runE7.log

  # ── Step 9: Final head-to-head across the whole sweep ─────────────
  log "Step 9/9: final head-to-head E / E2 / E3 / E4 / E5 / E6 / E7..."
  $PY -u scripts/eval_weights.py \
    --test-data data/sim-history-runC2.jsonl \
    --weights data/neural-eval-weights.runE.json \
    --weights data/neural-eval-weights.runE2.json \
    --weights data/neural-eval-weights.runE3.json \
    --weights data/neural-eval-weights.runE4.json \
    --weights data/neural-eval-weights.runE5.json \
    --weights data/neural-eval-weights.runE6.json \
    --weights data/neural-eval-weights.runE7.json \
    --test-fraction 0.05 \
    --max-test-positions 1000000 || true

  log "=== OVERNIGHT CHAIN DONE ==="
} > "$LOG" 2>&1
