# Verify

This file holds checklists for Bobby to run or review, newest first. Tick a box when it checks out, and tell Claude in chat about anything that doesn't.

**Run the site locally:** from the repo root, run `python -m http.server 8000`, open http://localhost:8000, and close the intro tour.

---

## Basemap key fix (built and committed)

- [x] Key received in chat (2026-10-01). It works for both localhost and the live site.
- [X] In the CARTO basemaps dashboard, restrict the key to `hawaiizoningatlas.netlify.app` and `localhost`. Right now it works from any website (Claude tested a random one), so anyone could use up your free requests.

**What changed:**
- [scripts/map.js](scripts/map.js): a `cartoApiKey` constant in `initMap()`, added as `?key=` to both CARTO tile URLs (the base map and the labels).
- [CLAUDE.md](CLAUDE.md): the Deployment section now describes Netlify and notes which keys can live in site code. The Overview links the Netlify site and explains the fork.

**Claude's checks** (headless Edge, old code vs. new):
- Before: all 60 CARTO tiles on the first screen were the "API KEY REQUIRED" image.
- After: none of the 60 are, and every tile request carries the key.
- The screenshots show the light basemap and the place names back above the zones. No errors.

- [X] On localhost, the map shows the light basemap with place names (Honolulu, Kāneʻohe, Kailua-Kona, and so on) and no "API KEY REQUIRED" anywhere. Zoom in and out a few levels.
- [X] Switch to **Satellite** and back to **Map**. Both work.
- [ ] After you push, check https://hawaiizoningatlas.netlify.app the same way.

**Production key** (added 2026-10-01, not committed yet): the map uses the localhost key on `localhost` and `127.0.0.1`, and your production key everywhere else.
- **Claude's check:** on `127.0.0.1`, all 60 tiles carried the localhost key. On a production-like hostname, all 60 carried the production key. No watermarks, no errors.
- **Heads-up:** both keys still return real tiles when a request claims to come from `example.com`, so CARTO isn't enforcing the restrictions yet. They may still be taking effect. Recheck the dashboard later.

- [ ] On localhost, open DevTools → **Network** and filter for `cartocdn`. The tile URLs contain `key=cb1_476c_1_`.
- [ ] After you push, do the same on the live site. The tile URLs contain `key=cb1_476c_2_`.

---

## Feature 3b: Refresh the county stats from the Census API (built and committed)

- [x] Scope decided in chat (2026-10-01): refresh the three current stats to the latest ACS 5-year release (2020–2024). Broader options can come later.
- [x] Plan approved in chat (2026-10-01).
- [x] The key is in `.env` as `CENSUS_API_KEY`.
- [x] Ran the check (2026-10-01).
  - The current numbers mix two releases: income and cost burden match 2015–2019, and Native Hawaiian matches 2016–2020.
  - The cost-burden definition is `allHouseholds` from table DP04, which matched all four counties exactly. It's now set in the script.
- [x] Ran the update (2026-10-01). Every county now shows 2020–2024 numbers:

| County | Income | Native Hawaiian | Cost-burdened |
|---|---|---|---|
| Hawaii | $62,409 → $78,639 | 9% → 9% | 33.4% → 33.2% |
| Honolulu | $85,857 → $106,195 | 5.4% → 5.1% | 41.2% → 41.5% |
| Kauai | $83,554 → $97,668 | 7.5% → 7.7% | 35.8% → 37.3% |
| Maui | $80,948 → $97,161 | 8.1% → 7.9% | 38.8% → 39.5% |

**Built so far:**
- **[.env.example](.env.example):** contains `CENSUS_API_KEY=`.
- **[tools/fetchDemographics.js](tools/fetchDemographics.js):** CommonJS, Node built-ins only.
  - `--check` compares today's numbers with each release from 2013–2017 through 2017–2021. It tests income, Native Hawaiian, and five possible cost-burden definitions, then prints which ones match all four counties.
  - `2024` rewrites data/demographics.js from the 2020–2024 release, using the cost-burden definition that the check confirms. It refuses to run until that definition is set.
  - The key is only sent to the Census API. Errors show the HTTP status, never the URL.
- **[CLAUDE.md](CLAUDE.md):** documents the two commands and the rule that the Census key never goes in site code.

**Claude's checks so far** (no key needed):
- Every label resolves to exactly one variable in each release from 2017 to 2024, including Native Hawaiian moving from `DP05_0053PE` to `DP05_0071PE` in 2024.
- The cost-burden math is correct on hand-made numbers, a Census "no estimate" value stops the script, and the generated file loads as a browser script.
- Without a key, with bad arguments, or before the definition is set, the script stops with a clear message.

**After the update:** [scripts/map.js](scripts/map.js) now takes the Native Hawaiian label's release name from `demographicsSource` in the new [data/demographics.js](data/demographics.js).

**Claude's checks after the update** (headless Edge, old code vs. new):
- A zone was clicked in each of the four counties. Every panel shows the numbers from the table above.
- The Native Hawaiian label reads "2020–2024 ACS 5-year estimates".
- No errors before or after.
- Honolulu's six-figure income still fits the panel layout.
- `.env` is ignored by git, and `.env.example` isn't.

- [X] Click a zone in each county. The panel shows the numbers from the table above.
- [X] Hover over the Native Hawaiian stat. The label reads "Residents who identify as Native Hawaiian (2020–2024 ACS 5-year estimates)".
- [X] Run `git status`. `.env` isn't listed, so your Census key can't be committed.
- [X] Once a year, when the Census publishes a new 5-year release (usually in December), rerun `node --env-file=.env tools/fetchDemographics.js <year>`.

---

## Feature 3: Move Google Analytics into its own file (built and live)

- [x] Plan approved in chat (2026-10-01). You chose (c): keep the org's ID, `G-ZTZX623WY7`.

**What changed:**
- **New [scripts/analytics.js](scripts/analytics.js):** holds the Analytics setup with the org's ID. It skips Analytics on `localhost` and `127.0.0.1`. Everywhere else it loads `gtag.js` and sends the same `js` and `config` commands as before.
- **[index.html](index.html):** the inline script and the `gtag.js` tag are replaced by `<script src="scripts/analytics.js" defer></script>`. The page has no inline scripts now (#4).
- **[scripts/map.js](scripts/map.js):** the zoning layer is now called `zonesLayer` instead of `dataLayer`, so it no longer overwrites Analytics' queue.
- **[CLAUDE.md](CLAUDE.md):** updated the notes on script loading, county selection, and URL state, and added a note on rendering data as text. The URL-state note had been out of date since Feature 2.

**Claude's checks** (headless Edge, old code vs. new, with Google's servers blocked so no hits were sent; all passed):
- **The collision:** before, once the zones loaded, `window.dataLayer` was the map layer and `gtag()` threw `dataLayer.push is not a function`. After, it stays Analytics' queue and `gtag()` works.
- **Inline scripts and localhost:** before, there was one inline script, and Analytics loaded on localhost too. After, there are no inline scripts, and on localhost nothing goes to Google.
- **Production:** on a fake production hostname pointed at the test server, the page requests `gtag.js` with `G-ZTZX623WY7` and queues the `js` and `config` commands.
- **Features 1 and 2:** unchanged. The tooltip and county panel are pixel-identical, the URL round trip works, and the quote-in-name bad link still loads cleanly.

- [ ] Press Ctrl+U to view the page source. Several `<script>` tags in the `<head>` is fine. Each one should have a `src="…"` and nothing between its opening and closing tags. A `<script>` with code written between its tags is an inline script, and there should be none. `scripts/analytics.js` loads with `defer`.
- [ ] On localhost, open DevTools → **Network**, reload, and filter for `googletagmanager`. Nothing shows up. (`fonts.googleapis.com` is expected. That's Google Fonts serving the icons.)
- [X] In the console, run `zonesLayer.getLayers().length`. It returns `262`.
- [X] In the console, run `window.dataLayer`. It's an empty array (`[]`), because Analytics is skipped locally.
- [ ] On the live site, open DevTools → **Network** first, then reload. Requests made before DevTools opened aren't listed.
  - Filter for `gtag`. You should see a `gtag/js?id=G-ZTZX623WY7` request.
  - Filter for `collect`. You should see a request to Google Analytics.
  - If neither shows up, an ad blocker or your browser's tracking prevention may be stopping them. Try an InPrivate window with extensions turned off.
  - Claude's live check on 2026-10-01 saw the `gtag.js` request.

---

## Feature 2: URL state with `URLSearchParams` (built and committed)

- [x] Plan approved in chat (2026-10-01).

**What changed** (all in [scripts/map.js](scripts/map.js)): the map reads its filters from the link with `URLSearchParams`.
- It only restores values that match a real checkbox, the opacity slider's range, or a county that has zoning data.
- URL text is only ever compared, never turned into a jQuery selector.
- After the data loads, a link with junk in it is rewritten to the state that was actually restored, so bad links clean themselves up.
- Links shared before this change work exactly as before.

This fixes review items #3 and #10.

**Claude's checks** (headless Edge, old code vs. new; all passed):
- Links made by the old code restore the same state in the new code, and stay byte-for-byte the same. This covered four sample states, from a single filter up to every checkbox at once.
- The new URL output matches jQuery's `serialize()` exactly. Reloading restores the same state, and checking a box still updates the URL right away.
- A fresh visit keeps its plain `#9/20.4162/-157.4015/` URL.
- Every bad link below loads with no errors.

- [X] Check **2-Family Housing**. The URL updates. Reload the page and the same boxes come back.
- [X] Click a county and move the opacity slider, then paste the URL into a new tab. The same county, boxes, and opacity come back.
- [ ] Open each bad link below **in a new tab**, or paste it and then press F5. For each one, the map loads, the console shows no red errors, and the URL cleans itself up as described.

**Bad links to keep testing.** Re-run these whenever URL handling changes.

**How to open them:** use a new tab, or paste the link and press F5. If you paste a link into a tab that already shows the map, only the part after `#` changes. The browser doesn't reload the page, and the map only reads the link when the page loads, so nothing changes. Claude reproduced exactly that: after pasting, the URL kept the bad link and the slider stayed at 10%. After F5, the URL cleaned itself up.

**What "cleans itself up" looks like:** a few seconds after the page loads, everything after the third `/` is rewritten to what was actually restored. For most links below that's `townActive=&opacity=90`, meaning no county is selected and opacity is at its default. The map numbers before it (`#9/20.4/-157.4`) may also round a little, for example to `#9/20.4013/-157.4011`.

- [ ] [Quote and bracket in a name](http://localhost:8000/#9/20.4/-157.4/1F%22%5Dx=A).
  - Before: the map never loaded (selector error).
  - Now: it loads, and the filter part of the URL becomes `townActive=&opacity=90`.
- [ ] [Broken `%` sequence](http://localhost:8000/#9/20.4/-157.4/opacity=%E0%A4%A).
  - Before: the map never loaded (`URIError`).
  - Now: it loads with the default opacity of 90, and the URL ends in `/townActive=&opacity=90`.
- [ ] [Unknown county](http://localhost:8000/#9/20.4/-157.4/townActive=Nowhere).
  - Before: the bogus county stayed in the URL.
  - Now: it's cleared, so the URL ends in `/townActive=&opacity=90`. `townActive=` with nothing after it means no county is selected.
- [X] [County with no zoning data](http://localhost:8000/#9/20.4/-157.4/townActive=Kalawao).
  - Before: Kalawao was outlined in yellow as if selected.
  - Now: no outline, and the county is cleared.
- [ ] [Opacity out of range](http://localhost:8000/#9/20.4/-157.4/opacity=9999).
  - Before: the slider jumped to 100.
  - Now: the slider stays at the default of 90, and the URL ends in `/townActive=&opacity=90`.
- [ ] [A value no checkbox has](http://localhost:8000/#9/20.4/-157.4/1MLS=Z).
  - Before: it stayed in the URL.
  - Now: it's dropped, meaning `1MLS=Z` disappears from the URL. The URL ends in `/townActive=&opacity=90`.
- [X] [Good and bad values mixed](http://localhost:8000/#9/20.4/-157.4/townActive=Honolulu&1F=&1F=A&opacity=50&bogus=1&1MLS=Z).
  - Now: Honolulu, **1-Family Housing** with "Allowed As of Right", and opacity 50 come back, and `bogus=1` and `1MLS=Z` drop out of the URL, which ends in `/townActive=Honolulu&1F=&1F=A&opacity=50`.
  - The lot-size group turns red because none of its boxes are checked. That's the existing "pick at least one" warning, not a bug.

---

## Feature 1: Safe tooltips, popups, and area calculator (built and committed)

**What changed:** tooltips, popups, and the area panel are built from plain text, so text in the data or the URL can't inject HTML. The Native Hawaiian stat's hover label now describes the stat correctly.

**Claude's checks** (headless Edge, old code vs. new):
- The tooltips and the panel are pixel-identical before and after.
- All 262 zone tooltips match the old markup.
- An injected `<img onerror>` stays plain text.
- The bad-link `TypeError` is gone.

- [X] Hover over a few zones. The tooltips look the same as before (name, county, flags).
- [X] Hover over a "Not Zoned" area. It shows **Not Zoned** and the county.
- [X] Click a zone. The panel shows the acreage sentence and three stats: HH Income, Native Hawaiian, Cost-Burdened.
- [X] Hover over the Native Hawaiian stat. The label reads "Residents who identify as Native Hawaiian (2020 ACS 5-year estimates)". (Since Feature 3b, it reads "2020–2024 ACS 5-year estimates".)
- [X] Turn on **Transit Stations (Rail)** and click a station marker. Its name appears.
- [X] In the DevTools console, run `zonesLayer.eachLayer((l) => { l.feature.properties.Z = '<img src=x onerror=alert(1)>' })`, then hover over a zone. The tooltip shows that text exactly as typed, and no alert pops up. Reload the page afterwards. (Before Feature 3, this variable was called `dataLayer`.)
- [X] Open http://localhost:8000/#9/20.4/-157.4/townActive=Nowhere. The map loads, no panel appears, and the console shows no red errors.

**Expected console noise:** one yellow warning, "Deprecated include of L.Mixin.Events". It comes from the vendored [leaflet-pattern.js](scripts/leaflet-pattern.js) and was already there before Feature 1.

---

## Repo housekeeping

- [X] In your repo's **Actions** tab, disable **Pull and Validate Spreadsheet Data**: pick it in the left sidebar, open the `⋯` menu, and choose **Disable workflow**. It runs daily and will fail until Feature 8.
- [X] Disable **Auto-assign issue** the same way. It's broken because `new Octokit` isn't defined in github-script v4.
