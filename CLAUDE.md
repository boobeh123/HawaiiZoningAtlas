# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Interactive Leaflet map (https://hawaiizoningatlas.com) showing which housing types Hawaii's zoning districts permit. Per the README, the project is in maintenance mode: bug fixes only, no new features. It was forked from the Connecticut Zoning Atlas. Some leftovers from the fork aren't Hawaii data and nothing loads them: `data/transit.js` (CT rail stations), comments about "169 towns", and the geocoder bounds in commented-out code.

Two independent halves:
- **Site** (repo root): static HTML/CSS/JS. No build step, package.json, tests, or JS linting.
- **Data pipeline** (`data-pipeline/`): Python + Jupyter. Turns the research spreadsheet and the county GIS files into `final.geojson`.

## Commands

**Site.** `$.getJSON` can't load the data over `file://`, so serve the repo root over HTTP:

```sh
python -m http.server 8000   # then open http://localhost:8000
```

The Driver.js intro tour starts on every page load; step through or close it to reach the map. Test at desktop width, because the sidebar, filters included, is hidden below 600px.

**CSV validation.** Run from `data-pipeline/csv-validation/`, since it reads `../hawaii-zoning-data.csv` relative to the working directory:

```sh
pip install -r requirements.txt   # petl, black
python validation.py              # prints "Success!" or raises "Invalid Data"
```

**Notebook.** Run `data-pipeline/CombineJurisdictions.ipynb` from `data-pipeline/`; `HOME_DIRECTORY` defaults to `.`. The manually triggered `hza-data-notebook.yml` action runs it through papermill and sets `HOME_DIRECTORY` from `.github/params.json`. The pins in `data-pipeline/requirements.txt` (pandas 1.4.3, geopandas 0.11.1) need Python ≤ 3.10. Jupyter and papermill aren't listed there, so install them separately.

**Python tooling.** `black` is pinned in `csv-validation/requirements.txt` and `flake8` in `data-pipeline/requirements.txt`. The code uses black's 4-space indent, which contradicts the 2 spaces set in `.pylintrc`.

Don't follow the Docker steps in `data-pipeline/README.md`. The Dockerfile's `CMD` runs `hzadata.py`, which doesn't exist.

## Deployment

`CNAME` points hawaiizoningatlas.com to GitHub Pages (`codeforhawaii.github.io`), which serves the repo root as-is, so **a push to `main` is a production deploy**. Each visit downloads `data/final.geojson` (~25 MB) and every overlay GeoJSON, so keep committed GeoJSON simplified and minified.

## Site architecture (`index.html` + `scripts/map.js`)

- **Script loading.** Plain global script tags, no modules or bundler, so every script shares one set of global names. That's why the map's layer is called `zonesLayer`: Google Analytics owns `window.dataLayer`.
  - jQuery 3.5.1, Leaflet 1.7.1, Driver.js 0.9.8, and Tachyons CSS load from CDNs. Esri Leaflet also loads, but nothing uses it.
  - `scripts/` holds `map.js` and `analytics.js`. `analytics.js` sets up Google Analytics and skips it on localhost.
  - It also holds vendored plugins: leaflet-hash, Leaflet.pattern (`L.StripePattern` for the striped overlays), and jquery.unserialize, which nothing calls anymore.
  - `data/demographics.js` defines the global `demographics` and must load before `map.js`.
- **Tachyons.** The markup uses Tachyons utility classes. `map.js` toggles `dn` (display:none) to show and hide filter subgroups and the area calculator.
- **Data loading.** `initMap()` fetches `data/counties.geojson` (non-interactive county outlines) and `data/final.geojson` (zoning districts). Each `loadX()` overlay function fetches its own file and fills `overlays[key]` asynchronously.
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
  - `loadZones()` drops a `townActive` that has no zoning data, and rewrites any link that carried junk.
  - Never build selectors from URL text. The bad-link regression list is in `Verify.md`.

## Data pipeline (spreadsheet → `data/final.geojson`)

1. **Source.** A Google Sheet with one tab per county. `spreadsheet.yml` (daily cron) pulls and merges the tabs and commits `data/hawaii-zoning-data.csv`. Nothing reads that copy. The pipeline's real input is `data-pipeline/hawaii-zoning-data.csv`, which is updated by hand.
2. **Two header rows.** The CSV starts with a row of section numbers, then the column names. The notebook reads it with `skiprows=1`.
3. **GIS input.** The notebook reads every `data-pipeline/gis/*.gpkg`. Each needs `State`, `Jurisdiction`, `AbbreviatedDistrict`, and geometry; the README's mention of `FullDistrictName` is outdated. A file that fails to load only prints "Error when reading …", and its county silently drops out of the output.
4. **Join.** `create_id()` links GIS features to spreadsheet rows on `HI--<JURISDICTION>--<DISTRICT>`, uppercased, with `-` and spaces stripped from the district. A district that doesn't match ends up with null attributes.
5. **Acreage.** Areas are computed in EPSG:6933. Federal/state land (`federal-state-dissolve.geojson`) is subtracted to get `MunicipalAcres`, which becomes `MA`.
6. **Output.**
   - `cols_xwalk` renames the columns and `vals_xwalk` shortens the values (`Allowed/Conditional`→`A`, `Primarily Residential`→`R`, …). Any `cols_xwalk` column the CSV lacks is silently dropped.
   - The notebook writes `data-pipeline/final.geojson`, but the site reads `data/final.geojson`, so copy the file across by hand. The action doesn't commit anything.
   - The committed `data-pipeline/final.geojson` is stale and has no Kauai.

## Inspecting data

`data/final.geojson` (~25 MB), `data/hydro.min.geojson` (~11 MB), and `data-pipeline/federal-state-dissolve.geojson` (~34 MB) are too large to Read, so query them with a script. The data contains ʻokina (U+02BB), so use `python -X utf8` on Windows:

```sh
python -X utf8 -c "import json,collections; d=json.load(open('data/final.geojson',encoding='utf-8')); print(collections.Counter(k for f in d['features'] for k in f['properties']))"
```

`.gpkg` files are SQLite. `sqlite3` can list their layers and columns without geopandas.

## Contributing

Per `.github/CONTRIBUTING.md`, branch from `main` as `patch/<issue#>-<name>` and open PRs against `CodeWithAloha/Hawaii-Zoning-Atlas` `main`.
