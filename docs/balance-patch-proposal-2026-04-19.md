# Balance Patch Proposal (2026-04-19)

Based on the 2026-04-19 audit (80k games) and the per-card strength proxy.
Goal: pull JIMMY back to ~55% WR and DEREK back above 30% WR. Nothing else
needs touching (the other 7 heroes are at 49.5-54.9% = tight band).

## JIMMY nerfs

| Card | Current | Problem | Proposed | Rationale |
|---|---|---|---|---|
| **JIM030** Infernic | 5 mana · 6/6 · Battlecry: 4 dmg to all enemy minions | #1 carry (59.16 mean score) — body+wipe for 5 mana dominates curve | **5 mana · 6/5** (hp 6 → 5) | Dies to trades from 5-atk neutrals; still wipes |
| **JIM032** Nova Ramiro | 7 mana · 6/4 · Battlecry: 3 dmg to all | Top-5 carry (50.65) — already nerfed once but still strong | **7 mana · 5/4** (atk 6 → 5) | Less immediate threat after wipe |
| **JIM022** Brutus | 6 mana · 6/5 · Charge | Ranked #3 strength — 6 face dmg immediately | **6 mana · 5/5** (atk 6 → 5) OR **drop Charge** | Keep body, remove burst |
| **JIM028** Flaming Sword of Pain | 5 mana · 5/2 · weapon | 10 face dmg over 2 swings for 5 mana | **5 mana · 4/2** (atk 5 → 4) | 8 face dmg over 2 turns still lethal but survivable |
| **JIM026** Engulfed in Flames | 7 mana · 5 dmg to ALL characters | Tied for top mean score (59.11) | **8 mana** (+1 cost) OR **4 dmg** (5 → 4) | Delay the wipe one turn or shrink magnitude |

Implementation note: do ONE patch pass at a time, re-sim, keep patches that
land JIMMY in 53-57% range. Doing all five at once may overcorrect.

## DEREK is a bigger problem

DEREK isn't tunable — its kit is broken. Every DEREK class card has
**near-zero or negative mean AI score** (the AI thinks playing them makes
the board worse). Top-volume offender:

- **DRK038 "Scrap Scythe"** — 3-mana 3/2 weapon, plain text (no keywords).
  Played 2,782 times per 5M-line sample at **−4.01** mean score.
  Curve-forced: DEREK has no better 3-drop so AI plays this despite the
  negative contribution.

### Options (from least → most invasive)

**Option A — stat buff only.** Bump DRK* cards +1/+1 across the board
except DRK041 (only positive-score DEREK card).
- Expected DEREK WR lift: +5-10 pp (still below target)
- Risk: low — might not be enough
- Time: trivial (~30 min edit + sim)

**Option B — rework DRK038** into an actually useful 3-drop.
- Candidates: add Lifesteal, add Deathrattle (draw a card), or convert to
  a 2-mana 2/2 with Rush.
- Needs: DRK038 text + mechanic edits
- Expected lift: unclear

**Option C — add 3-5 new strong DEREK cards.**
- New cards for the holes in the curve (likely 3-6 mana range)
- Balanced around "+1/+1 better than average neutrals" baseline
- Time: card design + code + sim — multiple hours

**Option D — ship new keyword: ARMOR**
Memory mentions DEREK is defensive/armor-themed. Current kit doesn't
synergize with armor-gain. Add a `GAIN_ARMOR` spellEffect type (if not
already there) and seed 3-4 DEREK cards with it.
- Biggest intervention, biggest upside
- Time: several hours

### Recommendation

Start with **Option A** (stat buff) since it's cheap and a data point.
If DEREK WR lands 25-35% → good enough for now, iterate later.
If still <20% → commit to Option C or D (new cards/mechanics).

## Verification loop

After any patch:
1. Rerun `npm run build` to ensure cards.json parses
2. Run `npm test` (191/191 should still pass)
3. `npx tsx scripts/parallel-simulate.ts --workers 16 --games-per-worker 5000 --teacher-vs-teacher --output data/balance-audit-YYYY-MM-DD.jsonl`
4. `python3 scripts/aggregate_balance.py data/balance-audit-YYYY-MM-DD.jsonl`
5. Compare WRs — target: DEREK ≥30%, JIMMY ≤58%, others unchanged
