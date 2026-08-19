# Insights

Three things the tool surfaced about LILA BLACK, using the 5-day / 796-match dataset.

---

## 1. PvP is almost nonexistent — and it's a population problem, not a combat-design problem

**What I noticed:** Across all 89,104 telemetry rows, human-vs-human combat is vanishingly rare: exactly **3** `Kill` events and **3** `Killed` events, total, across 5 days. Meanwhile human-vs-bot combat happened **3,115** times (`BotKill` + `BotKilled`).

**Evidence:** Grouping by `match_id`, **779 of 796 matches (97.9%)** had exactly one human player in them. Only **one single match**, in the entire dataset, had two humans present at the same time. Sixteen matches (2%) had zero humans at all — pure bot lobbies. With almost no match ever containing two humans simultaneously, there is structurally no one for a human to fight — the 3 PvP kills that do exist are the exception that proves the rule.

**Actionable:** This isn't something a Level Designer can fix with map layout — it's upstream, in matchmaking/lobby population. If the intent is for LILA BLACK matches to feature meaningful player-vs-player encounters, the current fill behavior (starting matches at 1 human + bots, rather than waiting to pool multiple humans) is quietly making that impossible. Worth flagging to the systems/backend team: check matchmaking fill-timeout thresholds and bot-backfill logic. **Metrics affected:** PvP encounter rate, contested-zone dwell time, any kill-cam/highlight or "epic moment" systems that assume PvP is common, session engagement/replay value that depends on unpredictable human opponents.

---

## 2. Bots barely threaten players — a 77.5% human win rate

**What I noticed:** Of the 3,115 human-vs-bot kill-credit events, **2,415 (77.5%)** are the human killing the bot, and only **700 (22.5%)** are the bot killing the human.

**Evidence:** `BotKill` (human kills bot) = 2,415 vs. `BotKilled` (bot kills human) = 700, i.e. humans win roughly 3.5 fights for every 1 they lose to a bot. Given Insight #1 — that bots are effectively every player's *only* opponent in 98% of matches — this ratio is doing all the work of defining how dangerous a match feels.

**Actionable:** If bots are meant to stand in for the tension of real opposition (which, per Insight #1, they currently are for almost the entire playerbase), a ~78% win rate suggests they're under-tuned as a threat. Consider testing increased bot aggression, accuracy, or numbers at key POIs, and re-measuring this ratio — while watching that it doesn't overcorrect and start driving players out of engagements entirely. **Metrics affected:** average match duration, human death rate, perceived difficulty/tension curve, loot-vs-fight risk calculus.

---

## 3. Lockdown has the longest matches but the lowest loot yield per player

**What I noticed:** Comparing average match duration to loot pickups per human, by map:

| Map | Avg. match duration | Loot pickups per human |
|---|---|---|
| Ambrose Valley | 402 (relative units) | **17.8** |
| Grand Rift | 413 | 15.4 |
| Lockdown | **429** (longest) | **12.1** (lowest) |

**Evidence:** Lockdown matches run *longer* on average than the other two maps, yet each human player walks away with roughly a third less loot than on Ambrose Valley — despite having more time in the match to find it. Zooming into Ambrose Valley's spatial loot-vs-traffic distribution specifically, a few well-trafficked cells show loot density far below their share of foot traffic (e.g. one heavily-walked cell accounts for ~1% of all traffic but under 0.05% of loot) — consistent with corridors that players pass through often but that aren't stocked to match.

**Actionable:** Audit Lockdown's loot density and placement relative to its size/route structure — either loot nodes are too sparse for the map's footprint, or they're clustered away from the paths players actually take (Lockdown's layout, visible on the traffic heatmap, funnels players through a dense central cluster of buildings; worth checking loot spawn tables against that same heatmap). On Ambrose Valley specifically, cross-reference the traffic heatmap against loot spawn points to find high-traffic/low-loot corridors that could take additional spawns. **Metrics affected:** loot pickups per match, time-to-first-engagement (players may be forced toward fights sooner if under-looted), player-reported "map feels empty" sentiment if that's tracked.

---

### How to reproduce these in the tool

- Insight 1 & 2: select **All matches (heatmap)** with no date filter on any map, and check the Events panel — the Kills/Deaths counts reflect this imbalance directly (note the tool groups `Kill`+`BotKill` as one visual marker type; the human/bot split shown here comes from the underlying event names in the source data).
- Insight 3: switch the **Heatmap** dropdown to *Traffic density*, then compare against *Kill zones* on Lockdown vs. Ambrose Valley to see the corridor/loot mismatch visually.
