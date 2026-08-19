# LILA BLACK — Player Journey Explorer

A browser-based tool for the Level Design team to visually explore player telemetry from **LILA BLACK** — see where players move, fight, loot, and die to the storm, across all three maps.

**Live URL:** _[add your deployed URL here after deploying — see below]_

![screenshot placeholder](docs/screenshot.png)

## What it does

- Renders player movement paths and event markers (kills, deaths, storm deaths, loot) directly on each map's minimap, using the game's world-space coordinates
- Distinguishes human players from bots at a glance
- Filters by map, date, and individual match
- Scrubs through a single match on a timeline to watch it unfold, with adjustable playback speed
- Generates traffic / kill-zone / death-zone heatmaps, either for one match or aggregated across every match matching the current filter

## Stack

- **React 18 + Vite** — plain client-side SPA, no backend/server needed at runtime
- **HTML5 Canvas** — all path/marker/heatmap rendering (chosen over SVG for performance at tens of thousands of points; see `ARCHITECTURE.md`)
- **Python (pandas + pyarrow)** — a one-time, build-time preprocessing script that turns the source parquet into static JSON bundles the app fetches
- No runtime backend, no database — the entire app is static files, deployable anywhere that serves static assets

## Project structure

```
lila-viz/
├── index.html
├── src/
│   ├── App.jsx          # top-level state, data loading, filtering
│   ├── FilterPanel.jsx  # left sidebar: map/date/match filters, layer toggles
│   ├── MapCanvas.jsx    # canvas rendering: minimap, paths, markers, heatmap
│   ├── Timeline.jsx     # playback scrubber
│   ├── StatsPanel.jsx   # right sidebar: stats + legend
│   ├── mapMath.js       # coordinate transform + heatmap renderer
│   └── styles.css
├── public/
│   ├── minimaps/        # resized minimap JPGs (generated)
│   └── data/            # manifest.json + per-map JSON bundles (generated)
├── scripts/
│   └── preprocess.py    # parquet -> JSON build step (run once against source data)
├── ARCHITECTURE.md
├── INSIGHTS.md
└── package.json
```

## Setup

**Requirements:** Node 18+, Python 3.9+ (only needed if you want to regenerate the data bundles from the raw parquet — the repo already ships with `public/data/*.json` and `public/minimaps/*.jpg` pre-built, so a normal clone doesn't need Python at all).

```bash
# 1. Install JS dependencies
npm install

# 2. (Optional) Regenerate data bundles from the raw parquet + minimaps
#    Only needed if the source data changes. Requires:
#    pip install pyarrow pandas pillow
python3 scripts/preprocess.py

# 3. Run locally
npm run dev
# -> http://localhost:5173

# 4. Build for production
npm run build      # outputs to dist/
npm run preview    # sanity-check the production build locally
```

## Environment variables

None. The app is fully static — all data ships as pre-built JSON/JPG files under `public/`, fetched client-side at runtime. There is no API key, database connection string, or backend URL to configure.

## Deploying

Any static host works. The two easiest options:

**Vercel**
1. Push this repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → import the repo → framework preset "Vite" is auto-detected → Deploy.
3. No environment variables to set.

**Netlify**
1. Push this repo to GitHub.
2. [app.netlify.com](https://app.netlify.com) → "Add new site" → import the repo.
3. Build command: `npm run build`, publish directory: `dist`.

## Data notes

See `ARCHITECTURE.md` for the coordinate-mapping approach and documented assumptions, and `INSIGHTS.md` for what the data actually revealed.
