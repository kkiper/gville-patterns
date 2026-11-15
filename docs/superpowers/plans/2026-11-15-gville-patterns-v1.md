# G-Ville Patterns v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v1 of a personal Lake Guntersville fishing PWA: map with sections, pattern heat and wind exposure; 7-day forecast with a bite rating; water/current screen; a filterable tournament patterns database with bait suggestions; and an on-device catch log, all fed by an hourly GitHub Action.

**Architecture:** A static site with no build step (plain ES modules + Leaflet from CDN) served by GitHub Pages. Pure logic lives in `js/lib/` and is shared by the browser and by Node fetcher scripts in `scripts/`. An hourly GitHub Action runs the fetchers, which write `data/*.json` and commit them. The app only reads those files. Catches live in IndexedDB on the phone.

**Tech Stack:** HTML/CSS/JS (ES modules), Leaflet 1.9.4 (unpkg CDN), CARTO dark tiles, Node 22 (`node --test`, global `fetch`, no npm dependencies), GitHub Actions + Pages. Data: Open-Meteo (forecast + archive), NOAA NWPS gauges GVHA1/SCRA1, USGS NWIS IV site 03573500, TVA (if an endpoint is found), OpenStreetMap via Overpass (lake outline, fetched once by the Action).

**Spec:** `docs/superpowers/specs/2026-11-15-guntersville-fishing-app-design.md`

**Plan decision vs. spec:** forecast data comes from **Open-Meteo instead of NWS**, because the NWS hourly forecast has no pressure and the bite rating needs a pressure trend. Open-Meteo is free for non-commercial use and needs no key.

## Global Constraints

- Lake Guntersville only. Default map center `[34.40, -86.27]`, zoom 11. Timezone `America/Chicago` for every displayed date and day grouping.
- No npm dependencies. Tests run with `node --test tests/`. The shell has no network, so fetchers are tested against hand-written fixtures in `tests/fixtures/` that follow each API's documented shape.
- Never display a value without a source. Missing → show "—" plus a reason. Never fill with a guess.
- Data older than 3 hours shows a visible "Data last updated X ago" warning.
- Pattern records: no angler name, hometown or local flag. `summary` written fresh (≤ 2 sentences). `source_url` required.
- No Deep Dive name, logo, icons or screenshots. Working name "G-Ville Patterns".
- Look: dark navy/charcoal background `#0f1720`, surface `#18232f`, text `#e6edf3`, accent `#3ddc97`, warning `#ffb547`. Full-screen map home, floating layer picker, bottom tab bar (Map, Forecast, Water, Patterns, Log), pull-up sheets.
- The app works offline with the last-fetched data. Catches never leave the device except by explicit export.

## Review Focus

1. **The Action fails or an API is down for hours.** The user expects to see how old the data is, not stale numbers presented as current. → Task 11 test `staleness banner after 3h`.
2. **An API returns an error, empty or changed-shape response.** The fetcher must not overwrite good data with empty data. It keeps the previous values and records the error. → Task 5 test `writeDataSafely keeps previous file on empty result`.
3. **Filters that match zero patterns, or records with null water temp/section.** The user expects "Not enough matching patterns" and a wider-filter suggestion, never a crash or an empty bait list shown as advice. → Task 8 tests `rankBaits on empty`, `null water temp excluded only when temp filter set`.
4. **Importing a malformed or already-imported catch file.** The user expects a clear rejection message, and no duplicates on re-import. → Task 9 tests `rejects malformed`, `merge dedupes by id`.
5. **Location permission denied, or offline when logging a catch.** The user expects to log by tapping the map and have it saved locally. → Task 15 manual check and Task 9 test `snapshot with missing water data`.

---

### Task 1: Repo, test harness and geo helpers

**Files:**
- Create: `package.json`, `.gitignore`, `js/lib/geo.js`
- Test: `tests/geo.test.mjs`

**Interfaces:**
- Produces:
  - `haversineMiles([lat1,lng1],[lat2,lng2]) -> number`
  - `destination([lat,lng], bearingDeg, miles) -> [lat,lng]`
  - `pointInPolygon([lat,lng], ring: [lng,lat][]) -> boolean` (ring in GeoJSON order)
  - `COMPASS16: string[]` (`['N','NNE',…,'NNW']`), `compassIndex(deg) -> 0..15`

- [ ] **Step 1:** `git init`. Create `package.json` with `{"name":"gville-patterns","private":true,"type":"module","scripts":{"test":"node --test tests/"}}` and `.gitignore` (`node_modules/`, `.DS_Store`).
- [ ] **Step 2: Write failing tests**

```js
test('haversine Guntersville→Scottsboro ≈ 25 mi', () => {
  const d = haversineMiles([34.358,-86.294],[34.672,-86.034]);
  assert.ok(d > 24 && d < 27);
});
test('destination round-trips with haversine', () => {
  const p = destination([34.4,-86.27], 90, 2);
  assert.ok(Math.abs(haversineMiles([34.4,-86.27], p) - 2) < 0.01);
});
test('pointInPolygon square', () => {
  const ring = [[-86.3,34.3],[-86.2,34.3],[-86.2,34.4],[-86.3,34.4],[-86.3,34.3]];
  assert.equal(pointInPolygon([34.35,-86.25], ring), true);
  assert.equal(pointInPolygon([34.45,-86.25], ring), false);
});
test('compassIndex', () => {
  assert.equal(compassIndex(0), 0); assert.equal(compassIndex(359), 0);
  assert.equal(compassIndex(22.5), 1); assert.equal(compassIndex(180), 8);
});
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement `js/lib/geo.js` (spherical earth, R = 3958.8 mi; ray-casting point-in-polygon).
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Commit `feat: repo scaffold and geo helpers`.

---

### Task 2: Lake sections and fetch distances

**Files:**
- Create: `data/sections.json`, `scripts/fetch-outline.mjs`, `scripts/build-fetch.mjs`, `js/lib/fetch-calc.js`
- Test: `tests/fetch-calc.test.mjs`

**Interfaces:**
- Consumes: `destination`, `pointInPolygon` (Task 1)
- Produces:
  - `data/sections.json`: `[{id:string, name:string, center:[lat,lng], radius_mi:number, source:string}]`
  - `fetchMiles(center:[lat,lng], bearingDeg, waterRings:[lng,lat][][], stepMi=0.05, maxMi=8) -> number` (distance until the ray leaves water)
  - `data/section-fetch.json`: `{generated:string, fetch:{[sectionId]: number[16]}}` (index = `COMPASS16` direction the wind comes FROM)
  - `data/lake-outline.geojson` (written by `fetch-outline.mjs` in the Action)

- [ ] **Step 1: Research section centers.** Use web search to find coordinates for these 15 sections: Spring Creek, Browns Creek, Town Creek, North Sauty, South Sauty, Mud Creek, Roseberry Creek, Jones Creek, Siebold Creek, Goose Pond, Honeycomb Creek, Big Spring Creek, Short Creek, Main River Ledges (dam to Honeycomb), US-431 Causeway. Write `data/sections.json` with a `source` note per entry (a URL, or "approximate, verify on map"). Ids are kebab-case (`spring-creek`).
- [ ] **Step 2: Write failing tests** for `fetchMiles` on a synthetic 4 mi × 1 mi rectangle lake:

```js
test('fetch from west edge looking east ≈ 4 mi', ...) // center near west edge, bearing 90 → 3.9–4.05
test('fetch looking north across 1 mi width ≈ 0.5 from middle', ...) // 0.45–0.55
test('point on land returns 0', ...)
test('caps at maxMi', ...)
```

- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement `fetchMiles` in `js/lib/fetch-calc.js`. A point counts as water if it's inside an outer ring and not inside any hole.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Implement `scripts/fetch-outline.mjs`. It POSTs an Overpass query for `relation["name"="Guntersville Lake"]["natural"="water"]`, falling back to `way` with the same tags, and writes `data/lake-outline.geojson` as MultiPolygon. It exits 0 without overwriting if the file already exists, unless `--force` is passed.
- [ ] **Step 7:** Implement `scripts/build-fetch.mjs`. It reads the outline + sections and writes `data/section-fetch.json`, using the bearing the wind comes FROM: `fetchMiles(center, dirDeg, rings)` for `dirDeg = i*22.5`. If the outline is missing, it logs and exits 0 without writing.
- [ ] **Step 8:** Commit `feat: lake sections and fetch-distance builder`.

---

### Task 3: Wind exposure

**Files:**
- Create: `js/lib/exposure.js`
- Test: `tests/exposure.test.mjs`

**Interfaces:**
- Consumes: `compassIndex` (Task 1), `section-fetch.json` shape (Task 2)
- Produces: `exposure(fetch16:number[], windFromDeg:number, windMph:number) -> 'windblown'|'partial'|'calm'`

Rules (my call): `windblown` if wind ≥ 10 mph and fetch ≥ 1.5 mi. Otherwise `partial` if wind ≥ 5 mph and fetch ≥ 0.5 mi. Otherwise `calm`. Fetch = `fetch16[compassIndex(windFromDeg)]`.

- [ ] **Step 1: Failing tests:** 12 mph from S with fetch 2.0 → windblown; 12 mph from S with fetch 0.3 → calm; 7 mph, fetch 1.0 → partial; 3 mph, fetch 5 → calm; boundary 10 mph/1.5 mi → windblown; `fetch16` missing → `null`, so the UI shows "—" (constraint: no guesses).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: wind exposure rules`.

---

### Task 4: Solunar periods

**Files:**
- Create: `js/lib/solunar.js`
- Test: `tests/solunar.test.mjs`

**Interfaces:**
- Produces:
  - `moonPhase(date:Date) -> number` (0 = new, 0.5 = full; synodic month 29.530588853 d, reference new moon 2000-01-06T18:14:00Z)
  - `moonAltitude(date:Date, lat, lng) -> degrees` (low-precision lunar position, Meeus ch. 47 abbreviated or equivalent, written from the formulas)
  - `solunarPeriods(dayStart:Date, lat, lng) -> [{type:'major'|'minor', start:Date, end:Date}]`. Major = ±1 h around upper and lower transit. Minor = ±30 min around moonrise/moonset (altitude crossing +0.125°). Found by scanning the 24 h in 5-minute steps and refining.

- [ ] **Step 1: Failing tests:** phase at reference ≈ 0 (±0.01); phase at reference + 14.765 d ≈ 0.5 (±0.01); for 2026-11-15 at `[34.40,-86.27]`, every major period's midpoint is a local altitude max or min (alt(mid) ≥ alt(mid ± 10 min) for upper transit); every minor midpoint has altitude within ±0.5° of 0.125°; the result is sorted and has 2–4 majors over a day.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: solunar periods`.

---

### Task 5: Weather fetcher, safe writes, and weather normalization

**Files:**
- Create: `scripts/lib/write-data.mjs`, `scripts/fetch-weather.mjs`, `js/lib/weather.js`, `tests/fixtures/open-meteo-forecast.json`
- Test: `tests/weather.test.mjs`, `tests/write-data.test.mjs`

**Interfaces:**
- Produces:
  - `writeDataSafely(path, data, {isEmpty:(d)=>boolean}) -> {written:boolean, reason?:string}`. If `isEmpty(data)` is true, it keeps the existing file and only updates its `errors` array (`{at, message}`, last 10). Otherwise it writes `{...data, updated: ISO string, errors: []}`.
  - `normalizeOpenMeteo(json) -> {hours:[{time:ISO, tempF, windMph, gustMph, windFromDeg, pressureHpa, cloudPct, precipPct}], days:[{date:'YYYY-MM-DD', hours:[...]}]}`, with days grouped in `America/Chicago` (Open-Meteo is requested with `timezone=America/Chicago`, so `time` strings are local; keep them as-is with no UTC conversion).
  - `data/weather.json`: `{updated, errors, hours, days}`
- Fetch URL (pinned): `https://api.open-meteo.com/v1/forecast?latitude=34.40&longitude=-86.27&hourly=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation_probability&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=America/Chicago&forecast_days=7`

- [ ] **Step 1:** Write the fixture: 48 hourly entries in Open-Meteo's `{hourly:{time:[…], temperature_2m:[…], …}}` shape, starting `2026-11-15T00:00`.
- [ ] **Step 2: Failing tests:** `normalizeOpenMeteo(fixture).hours.length === 48`; `days.length === 2`; `days[0].date === '2026-11-15'`; field mapping spot-check on hour 0; a missing array (e.g. no `pressure_msl`) gives `pressureHpa: null`, not a throw. `writeDataSafely keeps previous file on empty result` (temp dir: write good → write empty → file still has good hours and `errors.length === 1`); `writeDataSafely writes and clears errors on good data`.
- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement. `fetch-weather.mjs` = fetch → normalize → `writeDataSafely('data/weather.json', …, {isEmpty: d => !d.hours.length})`. A network error counts as empty. Exit 0 so other fetchers still run.
- [ ] **Step 5:** Run → PASS. **Step 6:** Commit `feat: weather fetcher with safe writes`.

---

### Task 6: Bite rating

**Files:**
- Create: `js/lib/bite.js`
- Test: `tests/bite.test.mjs`

**Interfaces:**
- Consumes: `hours` (Task 5), `solunarPeriods` (Task 4)
- Produces:
  - `hourScore(hours, i, periods) -> {score:1..5, reasons:string[]}`
  - `dayRating(day, allHours, periods) -> {score, bestHour:ISO, reasons}`: max `hourScore` over 6:00–19:00 local.

Rules (shown on screen as the reasons): start 3. Pressure 6 h trend from `hours[i-6]` to `hours[i]`: falling ≥ 2 hPa → +1 "Pressure falling", rising ≥ 2 hPa → −1 "Pressure rising fast". Wind 5–15 mph → +1 "Wind making chop", > 20 mph → −1 "Too windy". Inside a major period → +1 "Major solunar period", minor → +0.5 "Minor solunar period". Round, then clamp 1–5. If there's no pressure data, skip that rule and add the reason "No pressure data".

- [ ] **Step 1: Failing tests:** neutral → 3 with empty reasons; falling pressure + 10 mph + major → 5 with three reasons; 25 mph + rising → 1; `i < 6` → pressure rule skipped (reason "Not enough pressure history"); `dayRating` ignores a 3:00 a.m. hour scoring 5.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: bite rating`.

---

### Task 7: Water fetcher (NWPS, USGS, TVA)

**Files:**
- Create: `scripts/fetch-water.mjs`, `js/lib/water.js`, `tests/fixtures/nwps-gvha1.json`, `tests/fixtures/usgs-iv.json`
- Test: `tests/water.test.mjs`

**Interfaces:**
- Consumes: `writeDataSafely` (Task 5)
- Produces:
  - `normalizeNwps(json) -> {observed:[{time, value}], forecast:[{time, value}], units}` (from `observed.data[].validTime/primary` and `forecast.data[]`)
  - `normalizeUsgs(json) -> {waterTempF:{time,value}|null, dischargeCfs:{time,value}|null}` (parameters `00010` °C→°F, `00060`)
  - `data/water.json`: `{updated, errors, pool:{gauge:'GVHA1', …normalizeNwps}, scottsboro:{gauge:'SCRA1', …}, usgs:{…}, generation:null|{source, schedule:[{date, hours:string}]}, operatingBand:{winterMin:593, summerMin:594, summerMax:595}}`
- URLs: `https://api.water.noaa.gov/nwps/v1/gauges/GVHA1/stageflow`, `…/SCRA1/stageflow`, `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03573500&parameterCd=00010,00060,00065&period=P2D`

- [ ] **Step 1: TVA endpoint discovery (one attempt, time-boxed).** If a browser tool is available, open `https://www.tva.com/environment/lake-levels/guntersville`, read the network requests, and note the JSON URL behind "Generation Releases" and "Observed Data". If one is found, save a fixture and add `normalizeTva`. If not, `generation` stays `null` and the Water screen says "TVA generation schedule not available — check the TVA Lake Info app", with a link. Record the outcome in the commit message.
- [ ] **Step 2:** Write the fixtures in each API's documented shape. The USGS fixture includes `00060` and omits `00010`, so the test covers missing water temp.
- [ ] **Step 3: Failing tests:** NWPS observed/forecast counts and units; USGS `waterTempF === null` when `00010` is absent; °C→°F conversion when present (20 °C → 68 °F); malformed JSON gives empty arrays/nulls, not a throw.
- [ ] **Step 4:** Run → FAIL. **Step 5:** Implement. `fetch-water.mjs` treats "all sources empty" as empty for `writeDataSafely`. When some sources fail, it writes what it has and pushes an error per failed source.
- [ ] **Step 6:** Run → PASS. **Step 7:** Commit `feat: water fetcher (NWPS/USGS[/TVA])`.

---

### Task 8: Patterns library and schema validator

**Files:**
- Create: `js/lib/patterns.js`, `scripts/validate-patterns.mjs`, `data/patterns.json` (start as `[]`), `tests/fixtures/patterns-sample.json`
- Test: `tests/patterns.test.mjs`

**Interfaces:**
- Produces:
  - Record shape (from the spec): `{id, date:'YYYY-MM-DD', event, finish:number|null, water_temp_f:number|null, conditions:{sky, wind, water_color, level_trend, front, backfilled:boolean}, season_phase:string|null, technique:string, baits:string[], cover_structure:string|null, section:string|null, summary:string, source_url:string}`
  - `validateRecord(r, sectionIds:Set) -> string[]` (errors: missing required `id,date,event,technique,summary,source_url`; `section` not in ids; summary > 2 sentences; forbidden keys `angler,hometown,local`)
  - `filterPatterns(records, {months?:number[], tempRange?:[min,max], technique?, section?, waterColor?}) -> records` (a record with null temp is excluded only when `tempRange` is set)
  - `likeToday(records, {date:Date, waterTempF:number|null}) -> records`: month within ±1 (wrapping Dec/Jan) and temp ±5 °F when known
  - `rankBaits(records) -> [{technique, count, baits:[{name,count}]}]` sorted desc; `[]` for empty
  - `sectionCounts(records) -> {[sectionId]: number}`
  - `MIN_MATCHES = 3`: below this the UI shows "Not enough matching patterns"

- [ ] **Step 1: Failing tests:** `rankBaits on empty` → `[]`; `null water temp excluded only when temp filter set`; `likeToday` wraps December→January; `validateRecord` flags an `angler` key and an unknown section; `sectionCounts` skips null sections.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. `validate-patterns.mjs` validates `data/patterns.json` against `data/sections.json` and exits 1 on any error.
- [ ] **Step 4:** Run → PASS, and `node scripts/validate-patterns.mjs` → exit 0. **Step 5:** Commit `feat: patterns library and validator`.

---

### Task 9: Catch log library and store

**Files:**
- Create: `js/lib/catches.js`, `js/store.js`
- Test: `tests/catches.test.mjs`

**Interfaces:**
- Consumes: `weather.json` hours (Task 5), `water.json` (Task 7)
- Produces:
  - `snapshotConditions(now:Date, weather, water) -> {tempF, windMph, windFromDeg, pressureHpa, poolFt, waterTempF, generation}`, using the weather hour nearest `now` and the latest observed water values. Any missing value is `null`.
  - `makeCatch({latlng, species, weightLb, bait, notes, now, weather, water}) -> catch` with `id` from `crypto.randomUUID()`
  - `validateImport(json) -> {ok:true, catches}|{ok:false, error:string}` (needs `{app:'gville-patterns', version:1, catches:[…]}`)
  - `mergeCatches(existing, incoming) -> {merged, added:number, skipped:number}` (dedupe by `id`)
  - `exportReminderDue(lastExportISO|null, now) -> boolean` (true if null or > 30 days)
  - `js/store.js` (browser only, untested): `loadCatches()`, `saveCatch(c)`, `replaceAll(list)`, `getMeta(key)`, `setMeta(key,val)` on IndexedDB `gville` with stores `catches` and `meta`.

- [ ] **Step 1: Failing tests:** `rejects malformed` (wrong app tag, missing array, non-JSON string); `merge dedupes by id` (re-import → `added 0, skipped n`); `snapshot with missing water data` → water fields null, weather fields present; `exportReminderDue` null → true, 29 days → false, 31 days → true.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat: catch log library and IndexedDB store`.

---

### Task 10: Research the first pattern records

**Files:**
- Modify: `data/patterns.json`

- [ ] **Step 1:** Using web search and fetch, find Guntersville tournament reports with pattern details. Major tours first (Bassmaster Elite 2015/2020/2021+, Classics 2014/2020, FLW 2017, MLF/Bass Pro Tour, Toyota Series), then local trails (Alabama Bass Trail, BFL, Toyota Series Central). Target 15–25 events, with top 10 where reported.
- [ ] **Step 2:** For each finisher with a reported pattern, write a record. Write the `summary` fresh with no copied sentences (≤ 2 sentences). Assign a section only when the article clearly names a place that matches one. Otherwise `null`. When the article gives no water temperature, leave it `null`. Fill `conditions` from the article. If the article is silent, set `backfilled:true` and take sky/wind from the Open-Meteo archive (`archive-api.open-meteo.com/v1/archive`) for the event dates.
- [ ] **Step 3:** Run `node scripts/validate-patterns.mjs` → exit 0, and `npm test` → PASS.
- [ ] **Step 4:** Commit `data: initial Guntersville pattern records (N events, M records)`.

---

### Task 11: App shell, theme, data loading, PWA

**Files:**
- Create: `index.html`, `css/app.css`, `js/app.js`, `js/data.js`, `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png` (simple original mark: accent-green hook on navy, made with a script)
- Test: `tests/data.test.mjs`

**Interfaces:**
- Produces:
  - `js/data.js`: `loadAll() -> Promise<{weather, water, sections, sectionFetch, patterns}>` (each `null` on failure); `staleness(updatedISO, now) -> {stale:boolean, label:string}` (stale if > 3 h; label like "2 h ago")
  - `js/app.js`: tab router with `showTab(name)` for `'map'|'forecast'|'water'|'patterns'|'log'`. Each view module exports `render(rootEl, ctx)` where `ctx = {data, now, prefs}`.
  - `sw.js`: precache app shell. Network-first for `data/*.json` with cache fallback. Cache-first for tile URLs inside lake bbox `[34.2,-86.6]–[34.9,-85.8]`, capped at 2,000 entries.

- [ ] **Step 1: Failing tests:** `staleness banner after 3h` (`staleness(t-3h01m, t).stale === true`, `t-2h59m` → false); `null updated` → `{stale:true, label:'never'}`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. The shell is a full-height layout with the bottom tab bar using the Global Constraints colors and system font stack. A stale banner sits at the top when any loaded dataset is stale.
- [ ] **Step 4:** Run → PASS. Serve with `python3 -m http.server 8000`. With a browser tool, check that tabs switch and the banner shows when `data/weather.json` has an old `updated`. **Step 5:** Commit `feat: app shell, theme, PWA`.

---

### Task 12: Map view

**Files:**
- Create: `js/views/map.js`, `js/views/sheet.js`

**Interfaces:**
- Consumes: `ctx.data` (Task 11), `exposure` (3), `likeToday`, `sectionCounts`, `rankBaits`, `MIN_MATCHES` (8)
- Produces: `render(root, ctx)`; `sheet.open(html)` / `sheet.close()` (pull-up sheet reused by other views)

Behavior: Leaflet map with CARTO dark tiles. A floating layer picker (top right) offers **Sections**, **Best Areas**, **Wind** (multi-select). Sections are circles from `sections.json` (radius `radius_mi`) with labels. Best Areas fills circles on a 5-step accent opacity scale by `sectionCounts(likeToday(...))`. Wind colors circles red/amber/none for windblown/partial/calm, plus a bottom time slider over forecast hours (default: current hour). Tapping a section opens a sheet with the name, wind exposure now, matching patterns (top 5 by date), the `rankBaits` top 3 (or "Not enough matching patterns" below `MIN_MATCHES`), and the user's catches in that section's radius.

- [ ] **Step 1:** Implement. **Step 2:** Manual check in the browser with sample data: each layer toggles, the slider changes wind colors, the sheet opens, and missing `section-fetch.json` shows wind as "—". **Step 3:** Commit `feat: map view`.

---

### Task 13: Forecast view

**Files:** Create: `js/views/forecast.js`

**Interfaces:** Consumes `weather.days/hours`, `solunarPeriods`, `dayRating`, `hourScore`, `sheet`.

Behavior: a horizontal strip of 7 day cards (day name, hi/lo, wind range + arrow, pressure trend arrow, rating as 1–5 dots). Tapping a card opens a sheet with hourly rows (time, temp, wind, pressure, score) plus the reasons for the best hour and that day's solunar periods. Below the strip sits "Patterns like today" (top 3 `rankBaits` of `likeToday`, or the not-enough message).

- [ ] **Step 1:** Implement. **Step 2:** Manual check, including a day with no pressure data showing the "No pressure data" reason. **Step 3:** Commit `feat: forecast view`.

---

### Task 14: Water view

**Files:** Create: `js/views/water.js`

**Interfaces:** Consumes `water.json`.

Behavior: cards for **Generation** (schedule, or the "not available" message + TVA Lake Info link), **Pool elevation** (latest GVHA1 value, a 48 h + forecast sparkline drawn as inline SVG, with the operating band shown), **Scottsboro stage**, **Discharge** (USGS), **Water temp** (value + time, or "No live reading on Guntersville. Log yours from the boat."). Each card shows its source name and time.

- [ ] **Step 1:** Implement. **Step 2:** Manual check with the fixtures copied into `data/`. **Step 3:** Commit `feat: water view`.

---

### Task 15: Patterns and Log views

**Files:** Create: `js/views/patterns.js`, `js/views/log.js`

**Interfaces:** Consumes `filterPatterns`, `likeToday`, `rankBaits`, `MIN_MATCHES` (8), `store.js` + `catches.js` (9), `sheet`.

Patterns behavior: a filter bar (Like today [default on], month multi-select, temp range, technique, section, water color). A results count, a bait-ranking summary at top, then a list of cards (date, water temp, conditions, technique, baits, summary, "Source" link). With zero results: "No patterns match. Try widening the temperature range."

Log behavior: a "Log catch" button. It uses GPS if permitted. If denied or unavailable, it switches to the map in pick mode ("Tap where you caught it"). Form fields: species (Largemouth/Spotted/Smallmouth/Other), weight, bait, notes. On save it calls `makeCatch` with current data and `saveCatch`. Below that: a list of catches with their snapshots, and Export (downloads `gville-catches-YYYY-MM-DD.json`, sets `lastExport`) and Import (shows `validateImport` errors and `mergeCatches` counts). A banner appears when `exportReminderDue`.

- [ ] **Step 1:** Implement. **Step 2:** Manual check: deny location → map pick works; log offline (DevTools offline) → saved and listed; export then re-import → "0 added, N skipped"; import a bad file → error message. **Step 3:** Commit `feat: patterns and log views`.

---

### Task 16: Hourly GitHub Action and setup guide

**Files:** Create: `.github/workflows/update-data.yml`, `README.md`

**Interfaces:** Consumes all `scripts/*.mjs`.

Workflow: `on: schedule: cron '7 * * * *'` + `workflow_dispatch`. Steps: checkout, setup-node 22, `npm test`, `node scripts/fetch-outline.mjs`, `node scripts/build-fetch.mjs`, `node scripts/fetch-weather.mjs`, `node scripts/fetch-water.mjs`, `node scripts/validate-patterns.mjs`, then commit `data/` if changed (`git diff --quiet || git commit -m "data: hourly update"` and push), with `permissions: contents: write`.

README: a first-timer guide covering how to create a GitHub account, create a public repo, upload the project (GitHub web upload or `git push`), enable Pages (branch `main`, root), run the workflow once from the Actions tab, open the Pages URL on your phone and "Add to Home Screen", and how to export catches. Plus a short "how it works" section and the data sources with links.

- [ ] **Step 1:** Write the workflow and README. **Step 2:** Run every script locally. With no network each should exit 0 and leave existing files untouched (verifies the safe-write path). **Step 3:** `npm test` → PASS. **Step 4:** Commit `chore: hourly data workflow and setup guide`.
