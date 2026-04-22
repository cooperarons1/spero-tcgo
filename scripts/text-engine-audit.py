#!/usr/bin/env python3
"""Card text vs engine effect consistency audit.

For each card that has both a display `text` field and a structured
effect (spellEffect / battlecry / deathrattle / keywords), ask local
Gemma-4B whether the text accurately describes what the engine does.

Flags cards where:
  - text says X but effect does Y
  - effect is missing / no-op but text promises something
  - text describes keywords the card doesn't actually have

Outputs /tmp/text-engine-audit.jsonl (one line per card).
"""
from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from urllib import request as urlreq

REPO_ROOT = Path(__file__).resolve().parent.parent
CARDS_JSON = REPO_ROOT / "data" / "cards.json"
OUT = Path("/tmp/text-engine-audit.jsonl")
ENDPOINT = "http://localhost:8088/v1/chat/completions"
MODEL = "mlx-community/gemma-3-4b-it-8bit"

PROMPT_TMPL = """You are auditing a trading-card game for consistency between a card's
displayed text and the structured effect the game engine actually runs.

CARD:
  name: {name}
  type: {ctype}
  cost: {cost}{stats}
  text (shown to player): {text}
  keywords: {keywords}
  effects (engine runs these):
{effects}

Answer each question with YES or NO on its own line, then a short reason.

Q1: Does the displayed text accurately describe what the engine effects do? (A small rewording is fine; flag only real mismatches — wrong numbers, wrong target, promised behavior not implemented, extra behavior not mentioned.)
Q2: Does the displayed text mention keywords (Taunt, Rush, Charge, Divine Shield, Stealth, Lifesteal, Poisonous, Windfury) that the card's `keywords` field does NOT contain?

FORMAT (exactly):
Q1: YES|NO — reason
Q2: YES|NO — reason"""

KEYWORD_TOKENS = [
    "taunt", "rush", "charge", "divine shield", "stealth",
    "lifesteal", "poisonous", "windfury", "reborn", "freeze", "silence",
]


def ask(prompt: str) -> str:
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 180,
        "temperature": 0.1,
    }).encode()
    req = urlreq.Request(ENDPOINT, data=body,
                         headers={"Content-Type": "application/json"})
    with urlreq.urlopen(req, timeout=60) as r:
        js = json.load(r)
    return js["choices"][0]["message"]["content"]


def parse_q(n: int, resp: str) -> tuple[str, str]:
    m = re.search(rf"Q{n}:\s*(YES|NO)\s*[—-]*\s*(.*?)(?=\nQ\d:|\Z)",
                  resp, re.IGNORECASE | re.DOTALL)
    if not m:
        return ("?", "")
    return (m.group(1).upper(), m.group(2).strip()[:200])


def format_effects(card: dict) -> str:
    blocks = []
    for k in ("spellEffect", "battlecry", "deathrattle", "effects"):
        v = card.get(k)
        if v:
            blocks.append(f"    {k}: {json.dumps(v, separators=(',',':'))}")
    if not blocks:
        return "    (no structured effects)"
    return "\n".join(blocks)


def stat_str(card: dict) -> str:
    if card.get("type") == "MINION":
        return f"  atk/hp: {card.get('attack', '?')}/{card.get('health', '?')}"
    if card.get("type") == "WEAPON":
        return f"  atk/dur: {card.get('attack', '?')}/{card.get('durability', '?')}"
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    cards = json.loads(CARDS_JSON.read_text())
    cards = [c for c in cards if c.get("cardCode") and c["cardCode"] != "COIN"]

    # Skip cards with no text OR no effect/keyword to compare against
    todo = []
    for c in cards:
        text = c.get("text") or ""
        has_effect = any(c.get(k) for k in ("spellEffect", "battlecry", "deathrattle", "effects"))
        has_kw = bool(c.get("keywords"))
        if not text.strip():
            continue
        if not (has_effect or has_kw):
            # pure vanilla minion — no text-vs-code check needed
            continue
        todo.append(c)

    if args.limit:
        todo = todo[: args.limit]

    OUT.write_text("")
    print(f"[text] auditing {len(todo)} cards with text+effects", flush=True)

    flagged = []
    start = time.time()

    for i, c in enumerate(todo, 1):
        code = c["cardCode"]
        prompt = PROMPT_TMPL.format(
            name=c.get("name", ""),
            ctype=c.get("type", ""),
            cost=c.get("manaCost", "?"),
            stats=stat_str(c),
            text=c.get("text") or "(empty)",
            keywords=",".join(c.get("keywords") or []) or "(none)",
            effects=format_effects(c),
        )

        t0 = time.time()
        try:
            resp = ask(prompt)
        except Exception as e:
            resp = f"ERROR: {e}"

        q1 = parse_q(1, resp)
        q2 = parse_q(2, resp)
        effect_match = q1[0] == "YES"
        phantom_kw = q2[0] == "YES"

        entry = {
            "cardCode": code,
            "name": c.get("name"),
            "type": c.get("type"),
            "effect_match": effect_match,
            "effect_reason": q1[1],
            "phantom_keyword": phantom_kw,
            "phantom_kw_reason": q2[1],
        }
        with OUT.open("a") as f:
            f.write(json.dumps(entry) + "\n")

        if not effect_match or phantom_kw:
            flagged.append(entry)
            tags = []
            if not effect_match: tags.append("EFFECT")
            if phantom_kw:       tags.append("KW")
            print(f"[text] {i}/{len(todo)} ✗ {code} {c.get('name','')!r:<30} "
                  f"[{'/'.join(tags)}] ({time.time()-t0:.1f}s)", flush=True)
        elif i % 25 == 0:
            rate = i / (time.time() - start)
            eta = (len(todo) - i) / rate if rate else 0
            print(f"[text] {i}/{len(todo)} ok "
                  f"({time.time()-start:.0f}s, ETA {eta:.0f}s)", flush=True)

    print(f"\n=== text/engine audit: {len(flagged)}/{len(todo)} flagged "
          f"in {time.time()-start:.0f}s ===", flush=True)
    eff_flags = [f for f in flagged if not f["effect_match"]]
    kw_flags = [f for f in flagged if f["phantom_keyword"]]
    print(f"  effect mismatches: {len(eff_flags)}")
    print(f"  phantom keywords:  {len(kw_flags)}")
    print(f"\nFull audit → {OUT}")


if __name__ == "__main__":
    main()
