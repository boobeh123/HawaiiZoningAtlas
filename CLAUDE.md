# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Interactive Leaflet map (live at https://hawaiizoningatlas.netlify.app) showing which housing types Hawaii's zoning districts permit. This repo is a fork: `origin` is boobeh123/HawaiiZoningAtlas and `upstream` is the CodeWithAloha org repo. Per its README, the org project is in maintenance mode. This fork is being actively improved, and `Verify.md` tracks the work in progress. It was forked from the Connecticut Zoning Atlas. Some leftovers from the fork aren't Hawaii data and nothing loads them: `data/transit.js` (CT rail stations), comments about "169 towns", and the geocoder bounds in commented-out code.

Two independent halves:
- **Site** (repo root): static HTML/CSS/JS. No build step, package.json, tests, or JS linting.
- **Data pipeline** (`data-pipeline/`): Python + Jupyter. Turns the research spreadsheet and the county GIS files into `final.geojson`.

## Commands

**Site.** `$.getJSON` can't load the data over `file://`, so serve the repo root over HTTP:

```sh
python -m http.server 8000   # then open http://localhost:8000
```

The Driver.js intro tour shows on each visit until it's closed or finished once in that browser. That sets the localStorage flag `hzaTourSeen`. To see the tour again, run `localStorage.removeItem('hzaTourSeen')` in the console and reload. Test at desktop width and with the DevTools device toolbar (Ctrl+Shift+M), because phones get a different layout (see Layout below).

**County stats.** `tools/fetchDemographics.js` generates `data/demographics.js` from the Census API, using Node built-ins only. The key lives in `.env` as `CENSUS_API_KEY` (see `.env.example`).

```sh
node --env-file=.env tools/fetchDemographics.js --check   # which release and definitions match the current numbers; writes nothing
node --env-file=.env tools/fetchDemographics.js 2024      # rewrite data/demographics.js from the 2020–2024 release
```

**Data pipeline.** `data-pipeline/README.md` has the full steps. Run these from `data-pipeline/`; the pins in `requirements.txt` were tested on Python 3.13.

```sh
pip install -r requirements.txt -r csv-validation/requirements.txt
python pull_sheet.py                         # sheet → hawaii-zoning-data.csv, prints what changed
(cd csv-validation && python validation.py ../hawaii-zoning-data.csv)   # prints "Success!" or raises "Invalid Data"
jupyter execute CombineJurisdictions.ipynb   # about a minute; writes final.geojson and final.csv here
cp final.geojson ../data/final.geojson       # the site reads data/final.geojson
python check_data.py                         # exits 1 if the map data looks broken
```

- **`jupyter execute` stays quiet:** it doesn't show cell output, and `read_zoning_file()` swallows load errors. `check_data.py` catches a missing county.
- **`HOME_DIRECTORY`:** it defaults to `.`. The manually triggered `hza-data-notebook.yml` action runs the notebook through papermill and sets `HOME_DIRECTORY` from `.github/params.json`.
- **Windows line endings:** the global `core.autocrlf=true` checks the CSV out with CRLF. `pull_sheet.py` keeps whichever line endings the file already has, so a run with no sheet changes leaves `git status` clean.

**Python tooling.** `black` is pinned in `csv-validation/requirements.txt` and `flake8` in `data-pipeline/requirements.txt`. The code uses black's 4-space indent, which contradicts the 2 spaces set in `.pylintrc`.

Don't use the `data-pipeline/Dockerfile`. Its `CMD` runs `hzadata.py`, which doesn't exist.

## Deployment

The site deploys on Netlify (https://hawaiizoningatlas.netlify.app) from the repo root, with no build step, so **a push to `main` is a production deploy**. The root `CNAME` file is the org's old GitHub Pages setting for hawaiizoningatlas.com, and Netlify ignores it. Each visit downloads `data/final.geojson` (12.6 MB, about 3.0 MB as Netlify's Brotli sends it) and `counties.geojson`, plus each overlay's file the first time its box is checked. House and Senate are checked by default. Keep committed GeoJSON simplified and minified. `data-pipeline/shrink_geojson.py` rounds coordinates to 5 decimal places and drops the spaces.

**Keys.** Anything the browser loads is public, so only public keys belong in site code.
- **CARTO basemap keys:** `cartoApiKey` in `initMap()`, sent as `?key=` on both basemap tile URLs. There are two keys. On `localhost` and `127.0.0.1` the map uses the localhost key, and everywhere else it uses the production key.
- **Without it:** CARTO serves an "API KEY REQUIRED" image for every tile. This started in September 2026.
- **How it's protected:** with domain restrictions in CARTO's basemaps dashboard, not by hiding it.
- **Census API key:** secret. Only `tools/fetchDemographics.js` uses it, on your machine, and the script bakes the numbers into `data/demographics.js`. The key never goes in site code.

## Site architecture (`index.html` + `scripts/map.js`)

- **Script loading.** Plain global script tags, no modules or bundler, so every script shares one set of global names. That's why the map's layer is called `zonesLayer`: Google Analytics owns `window.dataLayer`.
  - jQuery 3.5.1, Leaflet 1.7.1, Driver.js 0.9.8, and Tachyons CSS load from CDNs. Esri Leaflet also loads, but nothing uses it.
  - `scripts/` holds `map.js` and `analytics.js`. `analytics.js` sets up Google Analytics and skips it on localhost.
  - It also holds vendored plugins: leaflet-hash, Leaflet.pattern (`L.StripePattern` for the striped overlays), and jquery.unserialize, which nothing calls anymore.
  - `data/demographics.js` defines the global `demographics` and must load before `map.js`.
- **Tachyons.** The markup uses Tachyons utility classes. `map.js` toggles `dn` (display:none) to show and hide filter subgroups and the area calculator.
- **Custom properties.** `style.css` defines its colors, fonts, font sizes, and spacing on `:root`, for example `--colorText`, `--fontHeading`, `--fontSizeBase`, `--spaceMd`, and `--edgeGap`. Use them instead of raw values.
  - **`em` sizes:** they stay relative on purpose.
  - **Tachyons:** its classes in `index.html` still set most text colors and sizes.
- **Layout.** All media queries live in the Media queries block at the bottom of `style.css`.
  - **Phones (600px and narrower):** the map fills the screen above a 48px bar (`--phoneMapHeight`), and `#sidebar` is a drawer along the bottom.
    - **Same breakpoint in JS:** `phoneMediaQuery` in `map.js`. `initMap()` uses it to start phones at zoom 6.
    - **The drawer:** the bar is `#drawerToggle`. `setDrawerOpen()` toggles `.drawerOpen` (70dvh) and `aria-expanded`.
      - **Closed:** `#HiZoningAtlas` is `inert`, so Tab and screen readers skip it.
      - **Open:** it covers the map's bottom corners, so `.leaflet-bottom` is `inert` instead. It sits at z-index 1001, above Leaflet's controls (1000).
      - **The bar's click:** opening pans the map up (`map.panBy`), so the middle of the map lands in the strip above the drawer, and closing pans back.
      - **Without the tour:** the listener is attached before `new Driver`, so it still works if Driver.js fails to load (`driver?.isActivated`).
      - **Grows instead of sliding:** Driver.js's `.driver-fix-stacking` forces `transform: none` on the highlighted element's parents.
      - **`overflow: clip`:** unlike `hidden`, it can't be scrolled, so a rotation or a `#link` can't shift the bar out of place.
      - **Filter count:** `#drawerFilterCount` shows how many housing filters are on. `countHousingFilters()` is shared with `updateResetButton()`.
      - **Overlay messages:** `#overlayStatus` is inside the drawer, so while it's inert `syncOverlayAnnouncement()` copies it to the hidden live region `#overlayStatusAnnounce`.
    - **The area card:** `buildAreaCardToggle()` adds a header ("56.8% of Honolulu") that's hidden on wider screens.
      - **Collapsed:** only the header, the district's name, and one line of its note show. `.areaExpanded` shows everything.
      - **Expanded:** it stays expanded while you switch districts, and resets when the card closes.
      - **Size:** it's capped at 40% of the map's height, or the strip above the open drawer, and scrolls as one box. The tapped district comes first (flex `order`).
      - **Hiding:** `#activeAreaCalculator:not(.dn)` keeps Tachyons' `dn` able to hide it.
    - **The tour:** `showTourStep()` opens the drawer for steps inside `#sidebar` and closes it for the map's steps.
      - **Drawer height:** `.drawerTour` holds it at 45dvh, so the popovers keep room.
      - **Placement:** each step's element goes as low in the drawer as it fits.
      - **Stray taps:** Driver.js changes steps on `touchstart`, so the tap's own click would land on whatever the new step put under the finger. After a touch step change, `swallowNextClick` eats that one click.
      - **The bar:** it does nothing while the tour runs.
  - **601–1139px:** the area panel moves beside the sidebar. A centered panel would overlap it.
  - **Tour popovers on phones:** they're pinned across the top with `!important`, because Driver.js positions them inline and `driver.min.css` loads after `style.css`.
- **Data loading.** `initMap()` calls `loadMapData()`, which uses `fetch` to get `data/counties.geojson` (non-interactive county outlines) and `data/final.geojson` (zoning districts). `#mapStatus` shows "Loading zoning data…" until the zones arrive, or an error if they don't.
- **Overlays load on first toggle.**
  - **The loaders:** `overlayLoaders` maps each Overlay checkbox `value` to an async `loadX()`. Each loader fetches its file and returns a Leaflet layer.
  - **Turning overlays on and off:** `syncOverlays()` runs on every form change and after a link is restored, and it calls `showOverlay()` or `hideOverlay()`.
  - **Downloads:** each overlay downloads once and is cached in `overlays`. It's only added to the map if its box is still checked when the file arrives.
  - **Messages:** `#overlayStatus`, a live region, shows loading and error text.
  - **Exception:** `loadSewer()` is still in the old style, and nothing calls it.
- **District labels.** `buildDistrictOverlay()` adds a Leaflet tooltip ("House 23" or "Senate 12") at each House or Senate district's `getLabelPlacement()` point.
  - **Visibility:** `updateDistrictLabels()` runs on `zoomend` and whenever an overlay turns on or off. A label shows only if its district has room on screen and it doesn't collide with another label, placing the largest districts first.
  - **Two Leaflet traps:**
    - **`permanent: true`:** these labels need it, or Leaflet closes them on any map click.
    - **Hiding:** hidden labels use `visibility: hidden`, not `display: none`. Leaflet centers tooltips using their size, and a `display: none` label has no size, so it drifts off its spot.
- **Rendering data.** Leaflet's `bindTooltip`/`bindPopup` and jQuery's `.html()` parse strings as HTML. Build anything that contains data or URL text with `createTextElement()` or `textContent`, as `buildZoneTooltip()`, `buildDistrictDetails()`, and `calculateActiveArea()` do. Never build it from HTML strings. Some Special Notes contain `<`.
- **Filter contract.** A sidebar checkbox's `name` is a property key in `final.geojson`, and its `value` is one accepted value of that key (`name="1MLS" value="B"`). `getFilters()` builds `{name: [checked values]}`. `satisfiesFilters()` requires `feature.properties[name]` to be in that list for every name except `Overlay`. If a key or value is missing from the data, nothing errors; every zone just renders gray as "not satisfying". So any filter change has to touch `index.html`, the data, and the notebook's `cols_xwalk`/`vals_xwalk` together.
- **Group checkboxes.** The main checkbox in each `.filter-group` has `value=""`, so `getFilters` skips it. All it does is reveal its `.subgroup` and check that group's `.checked-by-default` boxes.
- **Overlay checkboxes.** Checkboxes with `name="Overlay"` toggle layers rather than filter zones. Each `value` is a key in `overlays`: `hydro`, `federal`, `state`, `DHHL`, `transit`, `house`, `senate`. They also carry the `main-in-group` class, so check `name !== 'Overlay'` whenever code means "housing filters".
- **Clear filters.** The ✕ (`#resetFilters`) is a `<button>`.
  - **`clearFilters()`:** unchecks every housing filter group and clears the county from the map, the form, and the URL. Then it dispatches one `change` on the form, so the usual update runs. Overlays and opacity stay as they are.
  - **`updateResetButton()`:** shows the ✕ only while a housing filter or a county is active.
  - **Hiding:** it hides the ✕ with the `hidden` attribute, not Tachyons `dn`. Google's `.material-icons` sets `display: inline-block` and loads later, so it beats `dn`. `#resetFilters[hidden]` in `style.css` wins by ID.
- **Property keys.**
  - `T`: county.
  - `Z`: full district name.
  - `Ty`: zone type `R`/`M`/`N` (null means not zoned), mapped to colors by `zone2color`.
    - **Shared:** `zone2color` fills both the zones and the legend's squares.
    - **Checked:** the three zone colors pass the dataviz skill's palette validator as drawn: blended at the default 90% opacity over the basemap (`#fafaf8`), with every pair checked. Re-run it before changing one.
    - **Overlays:** their colors don't pass yet (see Verify.md).
  - `MA`: municipal acres, i.e. zone area minus federal/state land. Feeds the area calculator.
  - `TN`: tooltip note. It's empty everywhere. `AHD`, `EHD`, and `MUS` are tooltip flags (`getZoneFlags()`).
  - `SN`: the spreadsheet's Special Notes, as free text, so render it only as text. The tooltip shows `shortenNote()`'s ~160-character preview, and the area panel shows the full note.
- **Tooltips.** `syncZoneTooltips()` binds the hover tooltips. It skips them where `noTooltipsQuery` matches: phones, or touch-only screens (`hover: none`). There a tooltip covers much of the map, and the area panel shows the same details. It re-syncs when the query changes.
- **County selection.** Clicking a zone selects it (`districtActive`) and its county (`townActive`).
  - **Panel:** `buildDistrictDetails()` adds the district's name, flags, and full note to the area panel.
  - **Clicking:** another district in the same county switches the panel without moving the map. Clicking the same district again clears both.
  - **Zoom:** `showCounty()` handles a newly selected county. Desktop fits the whole county; phones only zoom in, never out.
  - **Outline:** `drawCountyOutlines()` restyles the outlines. The selected county gets 5px cyan (`#00e5ff`, used by no other layer) and goes on top, and the rest get 2px faint white.
  - **Pane:** the outlines live in the `countyOutlines` pane (z-index 502), just above the `overlays` pane (501) that holds the House and Senate lines.
  - **Matching:** each `T` value should match two things:
    - a `name20` in `counties.geojson`, for the outline highlight
    - a key in `demographics` (`Hawaii`, `Honolulu`, `Kauai`, `Maui`, no ʻokina), for the stats row. Without a match, the panel leaves the stats out.
- **URL state.** The hash is `#zoom/lat/lng/<serialized form>`.
  - `scripts/leaflet-hash.js` is a **modified** leaflet-hash that keeps everything after the third segment. Don't replace it with the upstream library.
  - `updateUrl()` writes the filter part with `getFormParams()`, which is `URLSearchParams` over `FormData`. That's the same format jQuery's `serialize()` produced.
  - `setFilters()` reads it with `getUrlFilterParams()` and only restores values that match a real input.
  - **A link defines the whole form:** when a link has a filter part, `setFilters()` unchecks every box first. Boxes checked in `index.html` (House and Senate) only apply when there's no link. Otherwise a link couldn't turn them off.
  - `loadZones()` drops a `townActive` that has no zoning data, and rewrites any link that carried junk.
  - Never build selectors from URL text. The bad-link regression list is in `Verify.md`.

## Data pipeline (spreadsheet → `data/final.geojson`)

1. **Source.** The research team's Google Sheet, with one tab per county. It's the team's record, so it's only ever read, never edited. The weekly sync is `spreadsheet.yml`: Mondays at 10:00 UTC, plus a **Run workflow** button.
   - **Pull:** `pull_sheet.py` downloads the four tabs through Google's public CSV export and writes `data-pipeline/hawaii-zoning-data.csv`, the notebook's input.
   - **Corrections on the way in:** it changes the sheet's "Kauaʻi" to "Kauai", fills in Maui `P`'s blank State, Jurisdiction, and County, and fixes the `OD/PD` typo.
   - **Format:** it takes both header rows from Maui's tab and refuses to run if any tab's column names differ. With an unchanged sheet, its output is byte-identical to the committed CSV.
   - **Checks:** `validation.py` checks the CSV. If it changed, the workflow runs the notebook, and `check_data.py` checks the result: all four counties, no county losing over a fifth of its districts, every checkbox still matching, and flag formats.
   - **Push:** after the checks, `github-actions[bot]` commits with `pull_sheet.py`'s summary of changed cells and pushes to `main`, which deploys. A failure pushes nothing, and GitHub emails the owner.
   - **Old copy:** `data/hawaii-zoning-data.csv` is from the old sync. Nothing writes or reads it now.
   - **Inactivity:** GitHub pauses scheduled workflows after 60 days without repo activity. Re-enable it from the Actions tab.
2. **Reading the CSV.**
   - **Two header rows:** the CSV starts with a row of section numbers, then the column names. The notebook reads it with `skiprows=1`.
   - **Blank cells:** the CSV is read with an explicit `blank_values` list, pandas' usual list without `None`. Newer pandas reads the text `None` as blank, but the researchers use it as an answer.
   - **"No limit" answers:** `has_requirement()` counts a size limit only when the cell holds a real value. Blank, `NONE`, `None`, `No`, `N/A`, and `n/a` all mean no limit. The master sheet's Conventions tab defines `NONE` as "I checked and there is no limit".
3. **GIS input.** The notebook reads every `data-pipeline/gis/*.gpkg`, sorted, so features come out in the same order on any machine.
   - **Columns:** each file needs `State`, `Jurisdiction`, `AbbreviatedDistrict`, and geometry. The README's mention of `FullDistrictName` is outdated.
   - **Load errors:** a file that fails to load only prints "Error when reading …", and its county silently drops out of the output.
   - **Name aliases:** `gis_district_aliases` maps GIS names that differ from the spreadsheet's before the join: Maui's `-MRA` districts to the sheet's `-WRA`, and Kauai's `\` to `OS`. The GIS files come from the counties, so their names get mapped in code. Spreadsheet problems are fixed in `pull_sheet.py` (see Source), since the sheet itself stays untouched.
   - **Special Notes:** the notebook drops the researchers' own reminders (`internal_notes`, starting with "missing MG10"). It also copies A-100a's "For all Agricultural Districts…" note to the other Hawaii `A-` districts that have no note.
4. **Join.** `create_id()` links GIS features to spreadsheet rows on `HI--<JURISDICTION>--<DISTRICT>`, uppercased, with `-` and spaces stripped from the district. A district that doesn't match ends up with null attributes, and the map draws it as Not Zoned.
5. **Acreage.** Areas are computed in EPSG:6933. Federal/state land (`federal-state-dissolve.geojson`) is subtracted to get `MunicipalAcres`, which becomes `MA`.
6. **Output.**
   - **Shortened names and values:** `cols_xwalk` renames the columns and `vals_xwalk` shortens the values (`Allowed/Conditional`→`A`, `Public Hearing`→`AH`, `Primarily Residential`→`R`, …). Any `cols_xwalk` column the CSV lacks is silently dropped, which is how the ADU filters once broke.
   - **Flag formats:** the save cell writes the true/false flags as the text the checkboxes send. The minimum unit size flags (`1MUS`…`4MUS`, `MUS`) become `'1'`/`'0'`, and `ASize` becomes `'Yes'`/`'No'`. Without that, pyogrio writes `'True'`/`'False'`, which breaks those filters and the tooltip's minimum-size line.
   - **Smaller file:** the save cell snaps every point to a 0.00001° grid (about 1 m) with `set_precision`. Then `shrink_geojson.py` writes the file with 5 decimal places and no spaces, which halves it. Plain rounding would leave some districts invalid (crossing edges, collapsed slivers): Leaflet still draws them, but GIS tools reject them. The notebook imports the script from `HOME_DIRECTORY`, so it has to stay in `data-pipeline/`.
   - **Two copies:** the notebook writes `data-pipeline/final.geojson`, but the site reads `data/final.geojson`, so copy the file across by hand. The two should be identical. The action doesn't commit anything.
   - **CSV location:** `final.csv` is written to the working directory, not `HOME_DIRECTORY`.

## Inspecting data

`data/final.geojson` (~12.6 MB, all on one line), `data/hydro.min.geojson` (~11 MB), and `data-pipeline/federal-state-dissolve.geojson` (~34 MB) are too large to Read, so query them with a script. The data contains ʻokina (U+02BB), so use `python -X utf8` on Windows:

```sh
python -X utf8 -c "import json,collections; d=json.load(open('data/final.geojson',encoding='utf-8')); print(collections.Counter(k for f in d['features'] for k in f['properties']))"
```

`.gpkg` files are SQLite. `sqlite3` can list their layers and columns without geopandas.

## Contributing

Per `.github/CONTRIBUTING.md`, branch from `main` as `patch/<issue#>-<name>` and open PRs against `CodeWithAloha/Hawaii-Zoning-Atlas` `main`.
