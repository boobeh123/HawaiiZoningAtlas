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

**CSV validation.** Run from `data-pipeline/csv-validation/`, since it reads `../hawaii-zoning-data.csv` relative to the working directory:

```sh
pip install -r requirements.txt   # petl, black
python validation.py              # prints "Success!" or raises "Invalid Data"
```

**Notebook.** Run it from `data-pipeline/`. The pins in `requirements.txt` were tested on Python 3.13.

```sh
pip install -r requirements.txt
jupyter execute CombineJurisdictions.ipynb   # about a minute; writes final.geojson and final.csv here
cp final.geojson ../data/final.geojson       # the site reads data/final.geojson
```

`jupyter execute` doesn't show cell output, and `read_zoning_file()` swallows load errors. So after a run, count the `T` values (see Inspecting data) to confirm all four counties are there. `HOME_DIRECTORY` defaults to `.`. The manually triggered `hza-data-notebook.yml` action runs the notebook through papermill and sets `HOME_DIRECTORY` from `.github/params.json`.

**Python tooling.** `black` is pinned in `csv-validation/requirements.txt` and `flake8` in `data-pipeline/requirements.txt`. The code uses black's 4-space indent, which contradicts the 2 spaces set in `.pylintrc`.

Don't follow the Docker steps in `data-pipeline/README.md`. The Dockerfile's `CMD` runs `hzadata.py`, which doesn't exist.

## Deployment

The site deploys on Netlify (https://hawaiizoningatlas.netlify.app) from the repo root, with no build step, so **a push to `main` is a production deploy**. The root `CNAME` file is the org's old GitHub Pages setting for hawaiizoningatlas.com, and Netlify ignores it. Each visit downloads `data/final.geojson` (~25 MB) and every overlay GeoJSON, so keep committed GeoJSON simplified and minified.

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
- **Layout.** All media queries live in the Media queries block at the bottom of `style.css`.
  - **Phones (600px and narrower):** the map takes the top `--phoneMapHeight` (55dvh) of the screen, and `#sidebar` is a scrolling panel under it. `initMap()` uses the same breakpoint to start phones at zoom 6.
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
- **Rendering data.** Leaflet's `bindTooltip`/`bindPopup` and jQuery's `.html()` parse strings as HTML. Build anything that contains data or URL text with `createTextElement()` or `textContent`, as `buildZoneTooltip()` and `calculateActiveArea()` do. Never build it from HTML strings.
- **Filter contract.** A sidebar checkbox's `name` is a property key in `final.geojson`, and its `value` is one accepted value of that key (`name="1MLS" value="B"`). `getFilters()` builds `{name: [checked values]}`. `satisfiesFilters()` requires `feature.properties[name]` to be in that list for every name except `Overlay`. If a key or value is missing from the data, nothing errors; every zone just renders gray as "not satisfying". So any filter change has to touch `index.html`, the data, and the notebook's `cols_xwalk`/`vals_xwalk` together.
- **Group checkboxes.** The main checkbox in each `.filter-group` has `value=""`, so `getFilters` skips it. All it does is reveal its `.subgroup` and check that group's `.checked-by-default` boxes.
- **Overlay checkboxes.** Checkboxes with `name="Overlay"` toggle layers rather than filter zones. Each `value` is a key in `overlays`: `hydro`, `federal`, `state`, `DHHL`, `transit`, `house`, `senate`.
- **Property keys.**
  - `T`: county.
  - `Z`: full district name.
  - `Ty`: zone type `R`/`M`/`N` (null means not zoned), mapped to colors by `zone2color`.
  - `MA`: municipal acres, i.e. zone area minus federal/state land. Feeds the area calculator.
  - `TN`: tooltip note. `AHD`, `EHD`, and `MUS` are tooltip flags.
- **County selection.** Clicking a zone selects its county. Each `T` value should match two things:
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

1. **Source.** A Google Sheet with one tab per county. `spreadsheet.yml` (daily cron) pulls and merges the tabs and commits `data/hawaii-zoning-data.csv`. Nothing reads that copy. The pipeline's real input is `data-pipeline/hawaii-zoning-data.csv`, which is updated by hand.
2. **Reading the CSV.**
   - **Two header rows:** the CSV starts with a row of section numbers, then the column names. The notebook reads it with `skiprows=1`.
   - **Blank cells:** the CSV is read with an explicit `blank_values` list, pandas' usual list without `None`. Newer pandas reads the text `None` as blank, but the researchers use it as an answer.
   - **"No limit" answers:** `has_requirement()` counts a size limit only when the cell holds a real value. Blank, `NONE`, `None`, `No`, `N/A`, and `n/a` all mean no limit. The master sheet's Conventions tab defines `NONE` as "I checked and there is no limit".
3. **GIS input.** The notebook reads every `data-pipeline/gis/*.gpkg`, sorted, so features come out in the same order on any machine.
   - **Columns:** each file needs `State`, `Jurisdiction`, `AbbreviatedDistrict`, and geometry. The README's mention of `FullDistrictName` is outdated.
   - **Load errors:** a file that fails to load only prints "Error when reading …", and its county silently drops out of the output.
   - **Name aliases:** `gis_district_aliases` maps GIS names that differ from the spreadsheet's before the join: Maui's `-MRA` districts to the sheet's `-WRA`, and Kauai's `\` to `OS`. The GIS files come from the counties, so their names get mapped in code. Fix spreadsheet typos in the CSV itself, and in the Google Sheet so the next export keeps them.
4. **Join.** `create_id()` links GIS features to spreadsheet rows on `HI--<JURISDICTION>--<DISTRICT>`, uppercased, with `-` and spaces stripped from the district. A district that doesn't match ends up with null attributes, and the map draws it as Not Zoned.
5. **Acreage.** Areas are computed in EPSG:6933. Federal/state land (`federal-state-dissolve.geojson`) is subtracted to get `MunicipalAcres`, which becomes `MA`.
6. **Output.**
   - **Shortened names and values:** `cols_xwalk` renames the columns and `vals_xwalk` shortens the values (`Allowed/Conditional`→`A`, `Public Hearing`→`AH`, `Primarily Residential`→`R`, …). Any `cols_xwalk` column the CSV lacks is silently dropped, which is how the ADU filters once broke.
   - **Flag formats:** the save cell writes the true/false flags as the text the checkboxes send. The minimum unit size flags (`1MUS`…`4MUS`, `MUS`) become `'1'`/`'0'`, and `ASize` becomes `'Yes'`/`'No'`. Without that, pyogrio writes `'True'`/`'False'`, which breaks those filters and the tooltip's minimum-size line.
   - **Two copies:** the notebook writes `data-pipeline/final.geojson`, but the site reads `data/final.geojson`, so copy the file across by hand. The two should be identical. The action doesn't commit anything.
   - **CSV location:** `final.csv` is written to the working directory, not `HOME_DIRECTORY`.

## Inspecting data

`data/final.geojson` (~25 MB), `data/hydro.min.geojson` (~11 MB), and `data-pipeline/federal-state-dissolve.geojson` (~34 MB) are too large to Read, so query them with a script. The data contains ʻokina (U+02BB), so use `python -X utf8` on Windows:

```sh
python -X utf8 -c "import json,collections; d=json.load(open('data/final.geojson',encoding='utf-8')); print(collections.Counter(k for f in d['features'] for k in f['properties']))"
```

`.gpkg` files are SQLite. `sqlite3` can list their layers and columns without geopandas.

## Contributing

Per `.github/CONTRIBUTING.md`, branch from `main` as `patch/<issue#>-<name>` and open PRs against `CodeWithAloha/Hawaii-Zoning-Atlas` `main`.
