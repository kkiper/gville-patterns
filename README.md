# G-Ville Patterns

A personal Lake Guntersville fishing app that you install on your phone. It shows:

- **Map:** 14 named lake sections, a "Best Areas" layer shaded by how often each section shows up in tournament patterns for this time of year, and a wind layer that marks which sections are windblown, partly exposed or calm, hour by hour.
- **Forecast:** 7 days with a simple bite rating whose reasons are shown on screen (pressure trend, wind, moon periods).
- **Water:** pool elevation (with TVA's operating range), the Scottsboro gauge, river discharge, and water temperature when a gauge reports it.
- **Patterns:** 103 top-finisher patterns from 16 Guntersville tournaments (2014–2026), filterable by month, water temperature, technique, section and water color. Each one is a short summary that links to its source article.
- **Log:** record catches. Weather and water conditions are saved with each one automatically. Catches stay on your phone; use Export to back them up.

It costs nothing to run. A GitHub Action pulls fresh public data every hour, and GitHub Pages hosts the app.

## Set it up (first time, about 15 minutes)

1. **Make a GitHub account** at https://github.com/signup (free).
2. **Create a repository:** click **+ → New repository**, name it `gville-patterns`, choose **Public** (free GitHub Pages needs a public repo; nothing private is stored in it), and click **Create repository**.
3. **Upload the project:** on the new repo page click **uploading an existing file**, drag in everything from this folder *including* the hidden `.github` folder (on a Mac, press Cmd+Shift+. in Finder to show it), and click **Commit changes**.
   *(If you use git: `git remote add origin https://github.com/YOU/gville-patterns.git && git push -u origin main`.)*
4. **Turn on Pages:** **Settings → Pages → Build and deployment → Source: Deploy from a branch**, Branch **main**, folder **/ (root)**, then **Save**.
5. **Let the data job write to the repo:** **Settings → Actions → General → Workflow permissions → Read and write permissions → Save**.
6. **Run the data job once:** **Actions → Update lake data → Run workflow**. It takes about a minute. After that it runs every hour on its own.
7. **Open the app on your phone:** your address is `https://YOU.github.io/gville-patterns/`.
   - **iPhone:** open it in Safari → Share → **Add to Home Screen**.
   - **Android:** open it in Chrome → ⋮ menu → **Install app**.
   Open it once while you have signal so the map and data get saved for offline use.

## Things to know

- **Back up catches.** They live only on the phone. Log → **Export** saves a file; **Import** brings it back (duplicates are skipped). The app reminds you if it's been more than 30 days.
- **Approximate sections.** Six section centers are marked "approximate, verify on map" in `data/sections.json`. If a circle sits in the wrong spot, edit its `center` there. The wind layer recalculates on the next hourly run.
- **No live generation schedule yet.** TVA doesn't publish one in a form the app can read, so the Water tab links to TVA's page and app instead.
- **Water temperature** shows only if the USGS gauge at Guntersville reports it. Most of the time it won't, so jot your own readings in catch notes.
- **Stale data warning.** If the hourly job fails, a yellow banner says how old the data is. Check the **Actions** tab for errors.

## How it works

| Piece | What it does |
|---|---|
| `index.html`, `css/`, `js/` | The app: plain JavaScript modules, Leaflet map, no build step |
| `js/lib/` | The logic (wind exposure, moon periods, bite rating, pattern matching, catch log) with tests in `tests/` |
| `scripts/` | Data fetchers run by the hourly Action. They never overwrite good data with an empty response |
| `data/patterns.json` | The tournament pattern database (regenerate with `python3 tools/build_patterns.py`) |
| `.github/workflows/update-data.yml` | Hourly job: tests, fetch, validate, commit `data/` |

Run the tests with `npm test` (Node 22+). Preview locally with `python3 -m http.server` and open http://localhost:8000.

## Data sources

- Forecast: [Open-Meteo](https://open-meteo.com/) (free for non-commercial use)
- Pool elevation and Scottsboro stage: NOAA National Water Prediction Service gauges [GVHA1](https://water.noaa.gov/gauges/gvha1) and [SCRA1](https://water.noaa.gov/gauges/scra1), with observed and forecast data from TVA
- Discharge and water temperature: [USGS 03573500](https://waterdata.usgs.gov/monitoring-location/USGS-03573500), Tennessee River at Guntersville
- Lake outline: © OpenStreetMap contributors (ODbL), via Overpass
- Map tiles: © OpenStreetMap contributors © CARTO
- Tournament patterns: summarized from Bassmaster, Major League Fishing / FLW, BassFan via Tackle Warehouse, In-Fisherman, Fishing North Alabama and News Channel 9 coverage. Each record links to its source.
