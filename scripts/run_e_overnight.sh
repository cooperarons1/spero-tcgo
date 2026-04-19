#!/bin/bash
# Spero TCG — Overnight Run E + Run E2 chain.
#
# Run E:  large model (1024→512→256→128→1, ~830K params) trained on
#         the same 110M-snapshot sim-history-runC2.jsonl. Tests whether
#         Run C2's mild val/train gap (0.59 vs 0.40) was capacity-bound.
#         Cost: ~30 min training + ~22 min chunked load.
#
# Run E2: label all 9999 disagreement positions with Gemma 4 (the old
#         Llama labels from Run C/D are discarded; --resume skips any
#         already in data/teacher-labels.jsonl), then retrain the LARGE
#         model with --teacher-weight 0.5 (up from D's 0.3).
#         Cost: ~6.5 hours of Gemma labeling + ~52 min training.
#
# Eval at the end: head-to-head vs Run C, C2, D, E, E2 on a held-out
# 1M-position test set. Now uses the fast normal-approx binomial.
#
# Total wall time: ~6.5 hours. Wraps in caffeinate so the M5 stays awake.
#
# Usage:
#   nohup ./scripts/run_e_overnight.sh > /tmp/runE.log 2>&1 &
#   disown
#   tail -f /tmp/runE.log

set -e
cd "$(dirname "$0")/.."
PY=./.venv/bin/python

echo "[$(date '+%H:%M:%S')] === Run E: large model on 110M snapshots ==="
caffeinate -i -s $PY -u scripts/train_neural_eval.py \
  --simulation-data data/sim-history-runC2.jsonl \
  --output data/neural-eval-weights.runE.json \
  --model-size large \
  --epochs 60 \
  --batch-size 4096 \
  --label-mode both --gamma 0.95 \
  --dtype bf16
echo "[$(date '+%H:%M:%S')] Run E training done"

echo "[$(date '+%H:%M:%S')] === Run E2: label remaining disagreement queue (Gemma 4) ==="
# --resume skips any positions already in data/teacher-labels.jsonl.
caffeinate -i -s $PY -u scripts/gemma_label_positions.py \
  --queue data/teacher-queue.jsonl \
  --output data/teacher-labels.jsonl \
  --concurrency 4 \
  --resume
echo "[$(date '+%H:%M:%S')] Gemma labeling done"

echo "[$(date '+%H:%M:%S')] === Run E2: large model + full Gemma 4 distillation ==="
caffeinate -i -s $PY -u scripts/train_neural_eval.py \
  --simulation-data data/sim-history-runC2.jsonl \
  --teacher-labels data/teacher-labels.jsonl \
  --teacher-weight 0.5 \
  --output data/neural-eval-weights.runE2.json \
  --model-size large \
  --epochs 60 \
  --batch-size 4096 \
  --label-mode both --gamma 0.95 \
  --dtype bf16
echo "[$(date '+%H:%M:%S')] Run E2 training done"

echo "[$(date '+%H:%M:%S')] === Head-to-head: C / C2 / D / E / E2 ==="
$PY -u scripts/eval_weights.py \
  --test-data data/sim-history-runC2.jsonl \
  --weights data/neural-eval-weights.runC.json \
  --weights data/neural-eval-weights.runC2.json \
  --weights data/neural-eval-weights.runD.json \
  --weights data/neural-eval-weights.runE.json \
  --weights data/neural-eval-weights.runE2.json \
  --test-fraction 0.05 \
  --max-test-positions 1000000

echo "[$(date '+%H:%M:%S')] === DONE ==="
echo "Promote whichever weights file beats Run C2 by >=0.5% acc with p<0.05:"
echo "  cp data/neural-eval-weights.runE2.json data/neural-eval-weights.json"
echo "  git add data/neural-eval-weights.json data/neural-eval-weights.runE.json data/neural-eval-weights.runE2.json"
echo "  git commit -m 'Run E/E2: ...'"
