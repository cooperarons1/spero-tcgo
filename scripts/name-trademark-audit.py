#!/usr/bin/env python3
"""Name-logic + trademark audit. LLM-driven via local Gemma 4B on :8088.

For each card, ask two questions:
  Q1: Does the name fit the card type, tribe, and effect text?
  Q2: Does the name closely resemble a known trademarked / copyrighted IP?

Writes JSONL to /tmp/name-audit.jsonl (one line per card).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib import request as urlreq

REPO_ROOT = Path(__file__).resolve().parent.parent
CARDS_JSON = REPO_ROOT / "data" / "cards.json"
OUT = Path("/tmp/name-audit.jsonl")
ENDPOINT = "http://localhost:8088/v1/chat/completions"
MODEL = "mlx-community/gemma-3-4b-it-8bit"

PROMPT_TMPL = """You are auditing a fantasy trading-card game for name quality and trademark risk.

CARD:
  name:  {name}
  type:  {ctype}{tribe}
  effect: {text}

Answer each question with YES or NO on its own line, then a short reason.

Q1: Does the card name fit the card type and effect? (A SPELL should sound like an action/effect, a MINION name like a character/creature, a WEAPON like an object, a LOCATION like a place. A proper first name (Alexis, Jorge) is fine for a HUMAN/AMETI minion.)
Q2: Does the card name or effect closely resemble a trademarked property — Pokemon, Marvel, DC, Disney, Star Wars, Warcraft, Hearthstone card names, Nintendo IP, anime IP, etc.? (Generic fantasy words like "Frostbolt" are OK. Flag actual lookalikes like "Pikachu", "Mickey", "Dumbledore".)

FORMAT (exactly):
Q1: YES|NO — reason
Q2: YES|NO — reason"""


def ask(prompt: str) -> str:
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 160,
        "temperature": 0.1,
    }).encode()
    req = urlreq.Request(ENDPOINT, data=body,
                         headers={"Content-Type": "application/json"})
    with urlreq.urlopen(req, timeout=60) as r:
        js = json.load(r)
    return js["choices"][0]["message"]["content"]


def parse(n: int, resp: str) -> tuple[str, str]:
    m = re.search(rf"Q{n}:\s*(YES|NO)\s*[—-]*\s*(.*?)(?=\nQ\d:|\Z)",
                  resp, re.IGNORECASE | re.DOTALL)
    if not m:
        return ("?", "")
    return (m.group(1).upper(), m.group(2).strip()[:200])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args()

    cards = json.loads(CARDS_JSON.read_text())
    cards = [c for c in cards if c.get("cardCode") and c["cardCode"] != "COIN"]
    if args.limit:
        cards = cards[: args.limit]

    done = set()
    if args.resume and OUT.exists():
        for l in OUT.read_text().splitlines():
            try:
                done.add(json.loads(l)["cardCode"])
            except Exception:
                pass
    if not args.resume:
        OUT.write_text("")

    todo = [c for c in cards if c["cardCode"] not in done]
    print(f"[name] {len(todo)} cards to audit ({len(done)} skipped)", flush=True)

    flagged = []
    start = time.time()

    for i, c in enumerate(todo, 1):
        code = c["cardCode"]
        name = c.get("name", "")
        ctype = c.get("type", "")
        tribe = f" ({c['minionType']})" if c.get("minionType") else ""
        text = c.get("text") or "(no text)"

        prompt = PROMPT_TMPL.format(name=name, ctype=ctype, tribe=tribe, text=text)

        t0 = time.time()
        try:
            resp = ask(prompt)
        except Exception as e:
            resp = f"ERROR: {e}"

        q1 = parse(1, resp)
        q2 = parse(2, resp)
        name_ok = q1[0] == "YES"
        trademark = q2[0] == "YES"

        entry = {
            "cardCode": code,
            "name": name,
            "type": ctype,
            "tribe": c.get("minionType") or "",
            "name_ok": name_ok,
            "name_reason": q1[1],
            "trademark": trademark,
            "trademark_reason": q2[1],
        }
        with OUT.open("a") as f:
            f.write(json.dumps(entry) + "\n")

        if not name_ok or trademark:
            flagged.append(entry)
            tags = []
            if not name_ok: tags.append("NAME")
            if trademark:   tags.append("TM")
            print(f"[name] {i}/{len(todo)} ✗ {code} {name!r:<32} "
                  f"[{'/'.join(tags)}] ({time.time()-t0:.1f}s)", flush=True)
        else:
            if i % 25 == 0:
                rate = i / (time.time() - start)
                eta = (len(todo) - i) / rate if rate else 0
                print(f"[name] {i}/{len(todo)} ok "
                      f"({time.time()-start:.0f}s, ETA {eta:.0f}s)", flush=True)

    print(f"\n=== name+trademark audit: {len(flagged)}/{len(todo)} flagged "
          f"in {time.time()-start:.0f}s ===", flush=True)
    name_flags = [f for f in flagged if not f["name_ok"]]
    tm_flags = [f for f in flagged if f["trademark"]]
    print(f"  name mismatches: {len(name_flags)}")
    print(f"  trademark hits:  {len(tm_flags)}")
    print(f"\nFull audit → {OUT}")


if __name__ == "__main__":
    main()
