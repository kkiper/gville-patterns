# Guntersville Fishing App — Design

Date: 2026-11-15
Status: Draft, awaiting approval

## Intent

A personal bass-fishing app for **Lake Guntersville only**, modeled on the Deep Dive app's feature set and general look. The owner wants the information Deep Dive provides (forecasts, current and flow, wind and wave exposure, water clarity, bait suggestions, and proven tournament patterns), but focused on one lake and built from free public data plus a hand-researched tournament patterns database.

It's for one person (the owner) and runs on their phone. It won't be published or sold.

## Goals

1. Answer "where and how should I fish Guntersville today / this week?" from one screen.
2. Put the lake's tournament history to work: what patterns have won or placed under conditions like today's.
3. Cost nothing to run, with nothing for the owner to maintain day to day.

## Non-goals

- Other lakes (though the code shouldn't make adding one impossible).
- Accounts, multiple users, social features, sharing.
- App store distribution.
- Tides (Guntersville isn't tidal).
- Lake-level emphasis: TVA holds the pool between about 593 and 595 ft, so level is shown but kept secondary.

## Anti-goals (a failure even if it works)

- **Copying Deep Dive's brand:** using its name, logo, icons, screenshots or other assets. The app takes on the general *style* (see UI), not their artwork.
- **Copying articles:** pasting tournament articles into the database. Every pattern record is a short summary written fresh, with a link to the source.
- **Made-up data:** a number shown without a real source behind it. Missing data shows as missing, never as a guess dressed up as a reading.
- **Something to babysit:** an app that breaks quietly and needs constant fixing.

## Constraints

- Hosting: free (GitHub Pages + GitHub Actions). The owner needs a free GitHub account. Their GitHub experience is unknown, so setup steps get written for a first-timer.
- Data sources must be free and public: NWS API (weather), TVA lake data (elevations, generation releases, predicted flows), NOAA NWPS gauges GVHA1 (Guntersville Dam headwater) and SCRA1 (Scottsboro), USGS NWIS (e.g. site 03573500), Open-Meteo archive (historical weather for pattern records), Copernicus Sentinel-2 (clarity, later phase).
- The build environment has no outbound network from the shell. Data fetchers get written here and tested against saved sample responses, then run for real in GitHub Actions.
- Phone-first layout and works on iPhone and Android as an installable PWA.
- GitHub Pages on a free account needs a **public repo**. The code, fetched public data and pattern summaries will be publicly viewable (none of it is private). Catches never go in the repo; they stay on the phone.
- Offline (my call): the installed app keeps working with the last-fetched data and cached map tiles for the lake area, so a weak signal on the water doesn't blank it. Catches logged offline save locally as usual.
- On iPhone, data in a *non-installed* web page can be cleared by Safari after a period of disuse. The app should be installed to the home screen, and the Log screen nudges you to export if it's been more than 30 days since the last export.
- Working name: "G-Ville Patterns" (placeholder, easy to change).

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Static PWA on GitHub Pages; hourly GitHub Action fetches public data into JSON files the app reads; patterns DB is a JSON file; catches stored on-device (IndexedDB) with export/import | Free, no server, nothing to maintain. Catches live on one phone unless exported. |
| B | Same PWA plus Supabase/Cloudflare backend | Catches sync across devices and data is easier to query, but there are more pieces, logins, and possibly small costs. Easy to add later without rewriting the app. |
| C | Native iOS/Android app | Best offline maps and GPS, but a much bigger build, and sideloading a personal build is painful (Apple's developer account is $99/yr). Overkill. |

The owner picked **A**.

## What the app does

### Screens (bottom tab bar)

1. **Map (home).** A full-screen dark map of Guntersville with a layer picker:
   - *Lake sections:* about 15 named sections (e.g. Spring Creek, Causeway, Town Creek, North Sauty, South Sauty, Browns Creek, Mud Creek, Seibold, main-river ledges near the dam, Goose Pond, Roseberry, Jones Creek). Hand-drawn polygons.
   - *Best Areas (pattern heat):* sections shaded by how many pattern records match the current filters (by default: this month ±2 weeks and water temp ±5°F).
   - *Wind and waves:* each section/shoreline marked as windblown, partly exposed or calm, from forecast wind speed/direction and fetch (open-water distance upwind). A time slider steps through the forecast hours.
   - *Clarity:* added in phase 3.
   - Tapping a section opens a sheet with that section's patterns, current wind exposure, and any of your catches there.
2. **Forecast.** A 7-day strip, each day a card with wind, temp, pressure trend, sky, a simple bite rating (1–5) and solunar windows. Tapping a day shows hourly detail. The bite-rating formula should be simple and visible (pressure trend + wind + solunar), not a black box.
3. **Water.** Current and generation: TVA scheduled generation at Guntersville and Nickajack dams (current moves when they generate), observed and predicted discharge, pool elevation with its operating band, and water temperature if a usable source exists (see Open questions).
4. **Patterns.** The tournament patterns database as a filterable list: month, water temp range, conditions (sky, wind, water color, rising/falling/stable), technique, section. The default filter is "conditions like today." Each record links to its source.
5. **Log.** Quick catch entry (tap the map or use GPS, then species, weight and bait). The app saves weather, water and generation conditions at that moment automatically. Plus export/import as JSON.

### Bait suggestions (replaces Deep Dive's Bait Tool)

On the Map and Forecast screens: "Patterns that worked in conditions like these," with the top techniques and baits ranked by how often they show up in matching pattern records (and in your own catches, once there are enough). This works off real data rather than a separate rules table. If there are too few matches, it says so.

### Patterns database

- One record per reported top-10 finish (or winner only when that's all that's reported), from Guntersville events across major tours (Bassmaster Elite, Classic, Opens, MLF/Bass Pro Tour, FLW/Toyota Series) and local trails (Alabama Bass Trail, BFL, club events). Local trails are where the local anglers' knowledge comes in.
- Fields: `date`, `event` (internal, for dedupe and the source link), `finish`, `water_temp_f` (null if unreported), `conditions` {sky, wind, water_color, level_trend, front}, `season_phase` (pre-spawn/spawn/etc. if stated), `technique`, `baits[]`, `cover_structure`, `section` (one of the named sections, or null if unclear), `summary` (1–2 sentences in fresh wording), `source_url`.
- Not stored, per the owner: angler name, hometown, local flag.
- When an article doesn't give conditions, fill them from historical weather (Open-Meteo archive) and TVA data for those dates, and mark them as backfilled.
- Researched and written up by Claude in conversation using web search, then saved to `data/patterns.json`. Expect uneven coverage. The goal for v1 is about 15–25 events.

### Look and feel

Same general style as Deep Dive: a dark, map-first interface with the full-screen map as home, a floating layer picker, bottom tab bar, data shown as compact cards and pull-up sheets over the map, and a high-contrast accent color on dark navy/charcoal. It gets its own name, icon and colors. No Deep Dive assets or wordmark.

## Phases

1. **v1:** Map with sections + Best Areas heat + wind/wave exposure, Forecast, Water, Patterns (with the first batch of researched records), Log, and the hourly data job.
2. **v2:** Bait-suggestion ranking blends in your own catch log, plus history replay (daily condition snapshots kept so you can look back at any past day).
3. **v3:** Water clarity layer from Sentinel-2 (turbidity index, e.g. NDTI), refreshed when a cloud-free pass is available, with 30-day history.

## Decided vs. left to the builder

**Decided:** approach A; Guntersville only; feature list and screens above; patterns record fields (no angler identity); summaries in fresh wording with source links; dark map-first style without Deep Dive's assets; phasing.

**Left to the builder (with defaults):**
- Framework: plain HTML/CSS/JS with Leaflet (default, no build step) vs. a small Vite setup. Default: no build step, so it's easy for the owner to tinker.
- Base map tiles: a free dark tile provider that allows personal use (e.g. CARTO dark).
- Lake outline from OpenStreetMap. Section polygons drawn by hand as GeoJSON.
- Fetch-distance computation method, solunar library or formula, exact bite-rating weights (keep it simple and shown on screen).

## Open questions

1. **Water temperature source.** Need to confirm whether any USGS/TVA site on Guntersville reports live water temp. If none: show the nearest available reading clearly labeled, and let the owner log their own readings from the boat. This is checked in planning, not guessed.
2. **TVA data access.** TVA's lake-level pages are JS-driven, so the JSON endpoint behind them needs finding. Fallback: NOAA NWPS gauges (GVHA1/SCRA1), which carry TVA's observed and forecast data.
3. **CORS:** irrelevant for data fetched by the Action. NWS can also be called live from the phone for the freshest forecast.
