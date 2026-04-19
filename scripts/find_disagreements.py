#!/usr/bin/env python3
"""
find_disagreements.py — pick the positions where the current MLP is wrong.

This is the "active learning" picker for the teacher distillation pipeline (Gemma 4).
For each snapshot in a sim-history JSONL, we run the current Run C MLP
forward pass and compare its prediction to the eventual game outcome.
Positions with the largest |prediction - outcome| are the ones the MLP
is most confused about — exactly the cases where the teacher's stronger
reasoning is most likely to provide useful new training signal.

Stratification
--------------
The picker isn't pure top-K because that would skew toward late-game
positions (where the outcome is most certain so the MLP is most rarely
wrong, but when it IS wrong it's by a lot). We split the budget across
three turn buckets:

  early — turns 1-6   (33% of budget)
  mid   — turns 7-12  (33% of budget)
  late  — turns 13+   (34% of budget)

We also exclude positions ≤2 turns from game end because by then the
outcome is essentially deterministic; nothing for the teacher to teach us.

Output
------
A queue JSONL where each line is one position the labeler should query
the teacher on:

    {
      "features": [256 floats],
      "hard_outcome": 0 or 1,
      "turn": int,
      "phase": "early"|"mid"|"late",
      "mlp_pred": float,
      "disagreement": float,
      "summary": "rendered text description for teacher prompt"
    }

The features are decoded back into a human-readable summary at pick
time using the canonical layout from server/ai-neural.ts. Card names
are lost (the bloom hand fingerprint can't be inverted) but the
positional info — life, mana, board stats, turn count, hero classes —
is enough for the teacher to make a useful judgement.

Usage
-----
    python scripts/find_disagreements.py \\
        --sim-data data/sim-history-runC.jsonl \\
        --weights data/neural-eval-weights.json \\
        --top-k 5000 \\
        --output data/teacher-queue.jsonl
"""

from __future__ import annotations

import argparse
import heapq
import json
import sys
import time
from pathlib import Path
from typing import Optional

import torch

# Reuse the trainer's model loader so we don't drift
sys.path.insert(0, str(Path(__file__).parent))
from train_neural_eval import (  # noqa: E402
    FEATURE_DIM,
    LAYER_TIERS,
    BoardEvaluator,
    pick_device,
)


# Hero classes — must match the order in server/ai-neural.ts HERO_CLASSES
# (which matches shared/questDefs.ts).
HERO_CLASSES = ['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY']

# Block layout offsets — must match server/ai-neural.ts
PERSP_OFF = 0
OPP_OFF = 64
GLOBAL_OFF = 240


def feat_to_int(x: float, scale: float) -> int:
    """Inverse of clamp01(value/scale): recover the integer the extractor
    started with. Bf16 round-trip introduces small errors so we round."""
    return round(max(0.0, min(1.0, x)) * scale)


def render_position(features: list[float], turn: int) -> str:
    """
    Decode an extracted feature vector back into a human-readable text
    summary suitable for the teacher to evaluate.

    The bloom hand fingerprint (slots 128-187) can't be inverted, so the
    summary doesn't include card names. Everything else — life, mana,
    board stats, hero class, keywords — is preserved.
    """
    me_health = feat_to_int(features[PERSP_OFF + 0], 30)
    me_max_health = feat_to_int(features[PERSP_OFF + 1], 40)
    me_armor = feat_to_int(features[PERSP_OFF + 2], 30)
    me_mana = feat_to_int(features[PERSP_OFF + 3], 10)
    me_max_mana = feat_to_int(features[PERSP_OFF + 4], 10)
    me_hand = feat_to_int(features[PERSP_OFF + 5], 10)
    me_board_count = feat_to_int(features[PERSP_OFF + 9], 7)
    me_attack_sum = feat_to_int(features[PERSP_OFF + 10], 50)
    me_health_sum = feat_to_int(features[PERSP_OFF + 11], 50)
    me_max_attack = feat_to_int(features[PERSP_OFF + 12], 15)
    me_max_health_minion = feat_to_int(features[PERSP_OFF + 13], 15)
    me_taunts = feat_to_int(features[PERSP_OFF + 15], 7)
    me_shields = feat_to_int(features[PERSP_OFF + 17], 7)
    me_secrets = feat_to_int(features[PERSP_OFF + 27], 5)

    opp_health = feat_to_int(features[OPP_OFF + 0], 30)
    opp_armor = feat_to_int(features[OPP_OFF + 2], 30)
    opp_mana = feat_to_int(features[OPP_OFF + 3], 10)
    opp_max_mana = feat_to_int(features[OPP_OFF + 4], 10)
    opp_hand = feat_to_int(features[OPP_OFF + 5], 10)
    opp_board_count = feat_to_int(features[OPP_OFF + 9], 7)
    opp_attack_sum = feat_to_int(features[OPP_OFF + 10], 50)
    opp_health_sum = feat_to_int(features[OPP_OFF + 11], 50)
    opp_max_attack = feat_to_int(features[OPP_OFF + 12], 15)
    opp_taunts = feat_to_int(features[OPP_OFF + 15], 7)
    opp_secrets = feat_to_int(features[OPP_OFF + 27], 5)

    # Hero one-hot in features[31..39] for perspective, [95..103] for opp
    me_hero = "?"
    for i, name in enumerate(HERO_CLASSES):
        if features[PERSP_OFF + 31 + i] > 0.5:
            me_hero = name
            break
    opp_hero = "?"
    for i, name in enumerate(HERO_CLASSES):
        if features[OPP_OFF + 31 + i] > 0.5:
            opp_hero = name
            break

    is_my_turn = features[GLOBAL_OFF + 11] > 0.5

    me_keywords = []
    if me_taunts > 0:
        me_keywords.append(f"{me_taunts} taunt")
    if me_shields > 0:
        me_keywords.append(f"{me_shields} divine shield")

    opp_keywords = []
    if opp_taunts > 0:
        opp_keywords.append(f"{opp_taunts} taunt")

    me_board_str = (
        f"{me_board_count} minions (atk total {me_attack_sum}, hp total {me_health_sum}, "
        f"strongest {me_max_attack}/{me_max_health_minion})"
    ) if me_board_count > 0 else "empty board"
    opp_board_str = (
        f"{opp_board_count} minions (atk total {opp_attack_sum}, hp total {opp_health_sum}, "
        f"strongest {opp_max_attack})"
    ) if opp_board_count > 0 else "empty board"

    perspective_label = "Active player" if is_my_turn else "Player to evaluate"

    return (
        f"Turn {turn}.\n"
        f"{perspective_label}: {me_hero} hero, "
        f"life {me_health}/{me_max_health}{f' (+{me_armor} armor)' if me_armor else ''}, "
        f"mana {me_mana}/{me_max_mana}, hand {me_hand} cards.\n"
        f"  Board: {me_board_str}"
        f"{f' [{', '.join(me_keywords)}]' if me_keywords else ''}.\n"
        f"  Secrets in play: {me_secrets}.\n"
        f"Opponent: {opp_hero} hero, "
        f"life {opp_health}/30{f' (+{opp_armor} armor)' if opp_armor else ''}, "
        f"mana {opp_mana}/{opp_max_mana}, hand {opp_hand} cards.\n"
        f"  Board: {opp_board_str}"
        f"{f' [{', '.join(opp_keywords)}]' if opp_keywords else ''}.\n"
        f"  Secrets in play: {opp_secrets}."
    )


def turn_phase(turn: int) -> Optional[str]:
    if turn <= 6:
        return "early"
    if turn <= 12:
        return "mid"
    if turn >= 13:
        return "late"
    return None


def load_model(path: Path, device: str) -> BoardEvaluator:
    raw = json.loads(path.read_text())
    if raw.get("featureDim") != FEATURE_DIM:
        raise SystemExit(
            f"{path.name}: featureDim mismatch (got {raw.get('featureDim')}, "
            f"expected {FEATURE_DIM})"
        )
    Ws = raw["W"]
    bs = raw["b"]
    layers = [len(Wi) for Wi in Ws]
    model = BoardEvaluator(layers, use_layernorm=False, dropout=0.0).to(device)
    model.eval()
    linear_idx = 0
    for module in model.net:
        if isinstance(module, torch.nn.Linear):
            module.weight.data = torch.tensor(Ws[linear_idx], dtype=torch.float32, device=device)
            module.bias.data = torch.tensor(bs[linear_idx], dtype=torch.float32, device=device)
            linear_idx += 1
    n_params = sum(p.numel() for p in model.parameters())
    print(f"  loaded {path.name}: layers={layers}, params={n_params:,}")
    return model


def main() -> int:
    parser = argparse.ArgumentParser(description="Pick disagreement positions for teacher labeling (Gemma 4)")
    parser.add_argument("--sim-data", required=True)
    parser.add_argument("--weights", required=True)
    parser.add_argument("--output", default="data/teacher-queue.jsonl")
    parser.add_argument("--top-k", type=int, default=5000,
                        help="Total positions to keep (split across early/mid/late)")
    parser.add_argument("--exclude-end-turns", type=int, default=2,
                        help="Skip positions within N turns of game end")
    parser.add_argument("--max-games", type=int, default=None,
                        help="Cap games scanned (for smoke testing)")
    parser.add_argument("--batch-size", type=int, default=8192,
                        help="MLP forward pass batch size")
    args = parser.parse_args()

    sim_path = Path(args.sim_data)
    if not sim_path.exists():
        print(f"Simulation data not found at {sim_path}", file=sys.stderr)
        return 1

    device = pick_device()
    print(f"Loading model on {device}...")
    model = load_model(Path(args.weights), device)

    # Per-bucket min-heaps. heapq is a min-heap so we push (-disagreement, idx, payload)
    # and the smallest disagreement (least interesting) is always at the top.
    # When the bucket is full and a new position has higher disagreement than the
    # top, we pop the top and push the new one.
    per_bucket = max(1, args.top_k // 3)
    heaps: dict[str, list] = {"early": [], "mid": [], "late": []}

    print(f"Streaming {sim_path.name}...")
    print(f"  picking top {per_bucket:,} positions per bucket (early/mid/late)")
    print(f"  excluding positions within {args.exclude_end_turns} turns of game end")

    t0 = time.time()
    games_seen = 0
    positions_seen = 0
    positions_skipped_end = 0

    pending_features: list[list[float]] = []
    pending_meta: list[dict] = []

    def flush_batch():
        nonlocal pending_features, pending_meta
        if not pending_features:
            return
        with torch.no_grad():
            X = torch.tensor(pending_features, dtype=torch.float32, device=device)
            logits = model(X)
            preds = torch.sigmoid(logits).cpu().tolist()
        for pred, meta in zip(preds, pending_meta):
            outcome = meta["hard_outcome"]
            disagreement = abs(pred - outcome)
            phase = meta["phase"]
            heap = heaps[phase]
            entry = (disagreement, positions_seen, {**meta, "mlp_pred": float(pred)})
            if len(heap) < per_bucket:
                heapq.heappush(heap, entry)
            elif disagreement > heap[0][0]:
                heapq.heapreplace(heap, entry)
        pending_features.clear()
        pending_meta.clear()

    with sim_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                game = json.loads(line)
            except json.JSONDecodeError:
                continue
            winner_id = game.get("winner_id")
            if not winner_id:
                continue

            snapshots = game.get("snapshots", [])
            if not snapshots:
                continue
            T = len(snapshots)

            for t, snap in enumerate(snapshots):
                feats = snap.get("features")
                if not feats or len(feats) != FEATURE_DIM:
                    continue
                # Skip positions too close to game end (deterministic territory)
                if T - 1 - t < args.exclude_end_turns:
                    positions_skipped_end += 1
                    continue
                turn = int(snap.get("turn", t + 1))
                phase = turn_phase(turn)
                if phase is None:
                    continue
                outcome = 1.0 if snap.get("active_player_id") == winner_id else 0.0
                pending_features.append(feats)
                pending_meta.append({
                    "features": feats,
                    "hard_outcome": outcome,
                    "turn": turn,
                    "phase": phase,
                    "active_player_id": snap.get("active_player_id"),
                    "winner_id": winner_id,
                })
                positions_seen += 1

                if len(pending_features) >= args.batch_size:
                    flush_batch()

            games_seen += 1
            if args.max_games and games_seen >= args.max_games:
                break

            if games_seen % 50000 == 0:
                rate = games_seen / max(0.001, time.time() - t0)
                heap_sizes = {p: len(h) for p, h in heaps.items()}
                print(f"  scanned {games_seen:,} games ({positions_seen:,} positions, {rate:.0f} games/s) heap_sizes={heap_sizes}")

    flush_batch()

    elapsed = time.time() - t0
    final_sizes = {p: len(h) for p, h in heaps.items()}
    print(
        f"  scanned {games_seen:,} games / {positions_seen:,} positions in {elapsed:.1f}s "
        f"(skipped {positions_skipped_end:,} as too close to end)"
    )
    print(f"  final heap sizes: {final_sizes}")

    # Write the queue file with the rendered text summary
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with out_path.open("w", encoding="utf-8") as f:
        for phase, heap in heaps.items():
            for disagreement, _idx, meta in heap:
                summary = render_position(meta["features"], meta["turn"])
                line = {
                    "features": meta["features"],
                    "hard_outcome": meta["hard_outcome"],
                    "turn": meta["turn"],
                    "phase": meta["phase"],
                    "mlp_pred": meta["mlp_pred"],
                    "disagreement": disagreement,
                    "summary": summary,
                }
                f.write(json.dumps(line) + "\n")
                written += 1

    print(f"\nWrote {written:,} disagreement positions to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
