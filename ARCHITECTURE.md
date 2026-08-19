# Architecture

## What I built with, and why

**Static React SPA (Vite) + Canvas rendering, no runtime backend.**

The dataset is 5 days of telemetry — 89,104 rows across 796 matches, ~1.9MB as parquet. That's small enough to preprocess once at build time into flat JSON and ship as static files, rather than standing up a server to parse parquet on every request. This cuts the architecture down to "one deploy, zero moving parts": no API server, no database, no cold starts, nothing to keep alive. A Level Designer opens a URL and it just works.

Canvas over SVG for the map layer: a full-map traffic heatmap or an "all matches" aggregate view can involve tens of thousands of points. SVG would mean tens of thousands of DOM nodes and would fall over well before that; Canvas draws all of it in one pass and stays smooth on playback scrubbing.

Python (pandas/pyarrow) for the one-time preprocessing step, since the source data is parquet and pandas is the path of least resistance for grouping/reshaping it. This only runs at build time, not in the deployed app.

## Data flow

```
full_data.parquet
      │
      │  scripts/preprocess.py  (pandas groupby: map -> match -> user)
      ▼
public/data/manifest.json          (list of all 796 matches + their map/day/
                                     humans/bots/kill/death/storm/loot counts —
                                     used to populate every filter dropdown
                                     without loading any match's point data)
public/data/{MapName}.json  × 3     (per-map bundle: every match on that map,
                                     each player's [time, x, z] position samples
                                     and [time, x, z, type] event markers)
public/minimaps/{MapName}.jpg × 3   (resized minimap art)
      │
      ▼
React app fetches manifest.json on load (134KB), then lazily fetches one
map bundle (147KB–1.4MB) whenever the user switches maps. Everything after
that — filtering by date/match, playback, heatmap generation — happens
entirely client-side against data already in memory.
```

**Why bundle per-map instead of per-match:** 796 individual match files would mean 796 HTTP requests to build an "all matches" heatmap. Bundling per map means exactly one fetch per map switch (worst case 1.4MB for Ambrose Valley, which has 566 of the 796 matches), and every other filter/selection change is instant since it's just re-slicing data already in memory.

## Coordinate mapping — the tricky part

The README documents the transform as:
```
u = (x - originX) / scale
v = (z - originZ) / scale
pixelX = u * mapWidth
pixelY = (1 - v) * mapHeight     (z is flipped: image Y grows downward)
```

The catch: the README says minimaps are 1024×1024, but the actual source files are **4320×4320** (Ambrose Valley), **2160×2158** (Grand Rift — not even square), and **9000×9000** (Lockdown). Hardcoding 1024 would have put every marker in the wrong place on all three maps.

The fix: `mapWidth`/`mapHeight` in the formula above are never a constant — they're read from the *actual rendered image* at whatever size we chose to ship it at. I resized each minimap to a web-friendly size (1600×1600, 1400×1399, 1600×1600 respectively) while preserving each one's native aspect ratio exactly, recorded those exact dimensions in `manifest.json`, and the client-side transform (`src/mapMath.js`) uses those recorded numbers. This makes the mapping correct regardless of what resolution the minimap is ultimately served at — if I re-exported the images at a different size tomorrow, I'd only need to update the two numbers in the manifest, not touch any rendering code. I sanity-checked this against the data's actual x/z ranges per map before trusting it (all three maps land within the expected 0–1 UV range with no clipping).

## Assumptions

| # | What was ambiguous | What I assumed / did |
|---|---|---|
| 1 | README says minimaps are 1024×1024; real files are 4320², 2160×2158, and 9000² | Coordinate transform uses each image's *actual* displayed width/height (read from the manifest), never a hardcoded constant. See above. |
| 2 | `ts` (timestamp) spans well under 1 second of real time per match (13–890 units total, even for matches with 10+ loot events and multiple kills) | Treated `ts` as a relative/synthetic ordering index rather than true wall-clock milliseconds, and scaled it for comfortable scrubbing during playback (adjustable 0.25×–4× speed) rather than replaying at "real" speed, which would be imperceptibly fast. |
| 3 | `Kill`/`BotKill` and `Killed`/`BotKilled` are separate event types (PvP vs. bot combat) | Grouped both into a single "kill" / "death" marker visually (a Level Designer scanning the map cares *that* a kill happened and *where*, not the granular event name), but kept them numerically distinct in the stats panel and in `INSIGHTS.md`, since the human/bot split turned out to be one of the most important findings in the data. |
| 4 | Some matches have 0 human players (16 of 796) or, in one case, 2 concurrent humans | Left these in rather than filtering them out — the near-total absence of multi-human matches is itself a significant, actionable finding (see `INSIGHTS.md` #1). |
| 5 | No explicit spec for what "aggregate across matches" should show | When a specific match isn't selected, the tool shows a heatmap + event markers aggregated across every match in the current map/date filter, but disables path playback (a spaghetti of 500+ overlapping paths isn't useful to anyone). Selecting one match switches to full path + timeline playback. |

## Major tradeoffs

| Decision | Chosen | Alternative considered | Why |
|---|---|---|---|
| Backend | None — fully static | Node/FastAPI server parsing parquet per-request | Dataset is small enough to preprocess once; a server adds hosting cost, cold-start latency, and a failure point for zero benefit at this data size. |
| Rendering | HTML5 Canvas | SVG, or a mapping library (Leaflet/deck.gl) | SVG chokes on tens of thousands of nodes; a full GIS library is overkill for a flat image + point overlay and adds bundle weight/learning curve for no real gain here. |
| Data granularity | Per-map JSON bundles (3 files) | Per-match files (796 files), or a single monolithic bundle | Per-match means hundreds of requests for any aggregate view; one giant bundle means loading 2MB+ before the user picks a map. Per-map is the middle ground: one request per map switch, instant filtering after that. |
| Heatmap | Hand-rolled canvas radial-gradient accumulation | A heatmap library (heatmap.js, deck.gl HeatmapLayer) | ~150 lines of dependency-free code covers exactly what's needed (additive blobs → color ramp) without pulling in a library whose API surface is 10x what this needs. |
| Framework | Vite + plain React | Next.js | No server rendering, API routes, or routing is needed for a single-view tool — Next.js's extra structure (pages, server/client split) would be pure overhead here. Vite gives the same dev experience with a smaller, simpler build. |
