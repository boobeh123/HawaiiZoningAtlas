# Verify

This file holds checklists for Bobby to run or review, newest first. Tick a box when it checks out, and tell Claude in chat about anything that doesn't.

**Run the site locally:** from the repo root, run `python -m http.server 8000`, open http://localhost:8000, and close the intro tour.

---

## Feature 7: Fix the broken filters in the data pipeline (built, not committed yet)

- [x] Plan approved in chat (2026-10-02).

**What changed:**
- [data-pipeline/CombineJurisdictions.ipynb](data-pipeline/CombineJurisdictions.ipynb):
  - **"Allowed Only After Public Hearing":** the spreadsheet's `Public Hearing` now maps to `AH`.
  - **ADU checkboxes:** the three ADU column names are corrected, so "Allows Renters", "Allows Non-Family/Non-Employees", and "Not Restricted to Primary Structure" get data.
  - **"No limit" answers:** blank, `NONE`, `None`, `No`, `N/A`, and `n/a` no longer count as a minimum unit size or an ADU size limit.
  - **APrim:** a `None` answer to "restricted to only the primary structure?" now reads as `No`.
  - **Flag formats:** the ADU size flag is written as `Yes`/`No`, which is what its checkbox sends.
  - **GIS name aliases:** Maui's five `-MRA` districts map to the spreadsheet's `-WRA` rows, and Kauaʻi's `\` maps to `OS`.
  - **Steady output:** blank cells are defined explicitly, the GIS files are read in sorted order, and the trim step selects pandas 3's text columns.
- [data-pipeline/hawaii-zoning-data.csv](data-pipeline/hawaii-zoning-data.csv): the Maui `P` row gets `HI`, `Maui`, `Maui`, and Kauaʻi's `OD/PD` becomes `OS/PD`.
- [data-pipeline/requirements.txt](data-pipeline/requirements.txt):
  - **Pins:** versions for Python 3.13.
  - **Added:** `nbclient` and `ipykernel`, so `jupyter execute CombineJurisdictions.ipynb` runs the notebook.
  - **Dropped:** `rtree`. `flake8` is unchanged.
- **Regenerated:** `data-pipeline/final.geojson`, `data-pipeline/final.csv`, and `data/final.geojson`. The two GeoJSON files are identical, so git stores them once.
- [CLAUDE.md](CLAUDE.md): the run commands and the pipeline notes.

`index.html` and `scripts/map.js` didn't change for this feature. Your `index.html` edit, with House and Senate checked by default, is committed separately. The tests below ran without it. A separate load with it and the new data showed both overlays and 15 labels at the statewide view, with no errors.

- [ ] **Known issue from that edit:** a shared link can't turn House or Senate off. A link restores only the boxes it lists, and those two now start checked. So a link someone made with House off opens with House on. The fix is a small change to `setFilters()`: when a link has filters, start from every box unchecked.

**Claude's checks** (all passed):
- **Install:** `requirements.txt` installs cleanly in a fresh Python 3.13.5 environment. `jupyter execute` runs the notebook in 53 seconds.
- **Repeatable:** running it in the repo produced files byte-identical to a run on a scratch copy.
- **All four counties:** Hawaiʻi 114, Honolulu 35, Kauaʻi 55, and Maui 57, so 261 districts (it was 262). Kauaʻi's `\` polygon merged into Open Space, whose acreage grew by exactly that polygon's 41.29 acres.
- **Old file vs. new file, district by district:** every change traces to a fix.
  - **Public hearing:** 21 Kauaʻi districts changed from `Public Hearing` to `AH` for 1-family, and 14 each for 2-, 3-, and 4+-family.
  - **Minimum unit size:** every "has a minimum" flag is now off. That's 130 for 1-family, 86 for 2-family, 78 each for 3- and 4+-family, and 135 for the tooltip's flag.
  - **ADU size:** 68 false "has a size limit" flags were cleared, and 43 real limits stay `Yes`.
  - **New data:** `ARent`, `AFam`, and `APrim`.
  - **Newly joined:** 7 districts are Maui's five `-WRA` districts, Maui's Public Use, and Kauaʻi's Open Space/Project District.
  - **Unchanged:** county, district name, zone type, acreage, lot-size ranges, elderly and affordable flags, and owner occupancy.
  - **Shapes:** identical to the helper agent's checked run, with no invalid shapes. The live file had 2.
- **Checkbox coverage:** every sidebar checkbox now matches at least one district, except ADU "Allowed Only After Public Hearing", which no county's ADU answer uses.
- **Headless Edge, old data vs. new:** both runs used the same `index.html` and `map.js`, so only the data differed.
  - **1-Family Housing on:** Kauaʻi went from 28 to 50 matching districts, and its panel went from 56.5% to 57.0%.
  - **Plus "No Minimum Unit Size Requirement":** Hawaiʻi went from 0 districts to 69, and its panel from 0.0% to 2.7%. Honolulu went from 3 to 19, and Maui from 2 to 30.
  - **ADU sub-filters, one at a time:** Allows Renters went from 0 districts to 128, Allows Non-Family/Non-Employees from 0 to 103, Not Restricted to Primary Structure from 0 to 130, and No Maximum Size Limitation from 0 to 90.
  - **Tooltips:** Hawaiʻi's Single-Family Residential - 10,000 square feet no longer says "Requires a Minimum Home Size". Wailuku's Commercial Mixed Use - WRA shows its name and color instead of gray "Not Zoned".
  - **Shared link:** a link with Allows Renters and No Maximum Size Limitation restores both boxes and matches 82 districts. With the old data it matched 0.
  - **Errors:** none in either run, whether exceptions, console errors, or failed requests.

**Your checks.** Open each link in a new tab, or press F5 after pasting it:
- [ ] Open http://localhost:8000/#15/19.96332/-155.78734 (Waikoloa Village). Hover the purple district in the middle. The tooltip says SINGLE-FAMILY RESIDENTIAL - 10,000 SQUARE FEET and Hawaii, with no "Requires a Minimum Home Size" line.
- [ ] Turn on **1-Family Housing** and click that district. The panel says 2.7% of Hawaii. Now check **No Minimum Unit Size Requirement**. It stays at 2.7%. Before this fix, it dropped to 0.0%.
- [ ] Open http://localhost:8000/#16/21.92291/-159.52101 and turn on **1-Family Housing**. The purple district in the middle stays purple. Hover it: RESIDENTIAL (4 UNITS/ACRE)/SPECIAL TREATMENT - PUBLIC. Before this fix, it turned gray. Click it: the panel says 57.0% of Kauai.
- [ ] Open http://localhost:8000/#16/20.88754/-156.50056 (downtown Wailuku). The blocks around Main Street are colored, not gray. Hover the middle: COMMERCIAL MIXED USE - WRA, Maui.
- [ ] Turn on **Accessory Dwelling Units** and check **Allows Renters**. Districts stay colored. Before this fix, the whole map went gray. Uncheck it and try **Allows Non-Family/Non-Employees**, **Not Restricted to Primary Structure**, and **No Maximum Size Limitation** one at a time.
- [ ] With DevTools open (F12, Console tab), reload the page. No red errors.
- [ ] Optional, after the commit: run the notebook yourself from `data-pipeline/` (see CLAUDE.md, Notebook). Afterwards, `git status` shows no changes to `final.geojson`, which means your machine produces the same file.

**Your follow-up:** make the same two cell fixes in the Google Sheet, so the next export keeps them. Feature 8 depends on it.
- [ ] Maui `P` (Public Use) row: State `HI`, Jurisdiction `Maui`, County `Maui`.
- [ ] Kauaʻi `OD/PD`: change to `OS/PD`.

---

## Data questions from the master spreadsheet

Claude compared `Hawaii Zoning Atlas Master.xlsx` with the CSV the map was built from, and with the GIS files. The spreadsheet itself holds up: for every column that feeds the map, it matches the CSV, apart from rounding that never changes a lot-size bucket.

The odd numbers come from three other places:
1. **A methodology choice** about farm dwellings, recorded in the Hawaiʻi agricultural rows' Special Notes and in the **Discrepancies** tab.
2. **Pipeline mapping bugs**, which are fixable in Feature 7.
3. **District names that differ between the GIS files and the spreadsheet.** Those districts show as "Not Zoned".

One decision for you:

- [ ] **Hawaiʻi County agricultural districts** (A-1a … A-8000a): every row says 1-family *Prohibited* but ADU *Allowed*. **Claude checked the code: this is a deliberate choice, not a typo.**
  - **Why it matters:** these districts are most of the county's zoned land, which is where "1-family allowed on only 2.7%" comes from.
  - **The county code allows a house** (chapter 25, January 2026 edition; the county site blocks scripts, so Claude read [an archived copy](http://web.archive.org/web/20260902090202/https://www.hawaiicounty.gov/home/showdocument?id=302520)):
    - **§25-5-72(a)(11)** permits "Dwelling, single-family, as permitted under chapter 205, Hawai‘i Revised Statutes and as permitted under section 25-5-77(b)."
    - **§25-5-77(b):** "One single-family dwelling or one farm dwelling shall be permitted on any building site in the A district."
    - **§25-5-77(d)** allows an ADU on any A-district building site, which matches the spreadsheet's ADU *Allowed*.
  - **But state law narrows it.** On State Agricultural land rated class A or B, [HRS §205-4.5](http://web.archive.org/web/20250311033538/https://www.capitol.hawaii.gov/hrscurrent/vol04_ch0201-0257/hrs0205/HRS_0205-0004_0005.htm) permits "farm dwellings", meaning "a single-family dwelling located on and accessory to a farm". Apart from special permits, it allows ordinary houses only on lots that existed before June 4, 1976.
  - **The researchers' reasoning,** from the A-100a row's Special Notes: "All dwellings, including the primary dwelling, must be occupied by people who will operate the agricultural enterprise." The atlas doesn't count housing limited to certain occupants as 1-family. The Discrepancies tab applies the same rule to Honolulu's farm dwellings and caretaker units.
  - **Claude's recommendation:** keep the researchers' coding. Changing it would override the team's documented method. The real gap is that the map never explains it: the tooltip shows Tooltip Notes, and those are empty. Showing the Special Notes could be its own small feature.

**Resolved by Claude from the GIS files' own descriptions** (Maui's `zone_class` column and Kauaʻi's `Full District Name`):
- [x] **Maui `-MRA`:** the GIS describes these as "Commercial Mixed Use - MRA", "Business Multi Family - MRA", and so on, which match the spreadsheet's `-WRA` rows one for one. That's 35 polygons, so this is a naming fix.
- [x] **Maui `PR` = Proposed Road (25 polygons) and `DR` = Drainage (10):** not zoning districts. "Not Zoned" is correct.
- [x] **Maui `BRW` = Beach Right-of-Way, `UZR` = Unzoned Road, `NZ` = Not Zoned:** correctly unzoned.
- [x] **Kauaʻi `OS/PD`:** the GIS calls it "Open Space/Project District", and so does the spreadsheet's `OD/PD` row, so the sheet's abbreviation is a typo.
- [x] **Kauaʻi polygon `\`:** the GIS calls it "Open Space", so it's a typo for `OS`.

**Fixed in Feature 7** (no new research needed):
- **Maui `P` (Public Use):** the row exists in both the master and the CSV, but its State, Jurisdiction, and County cells are blank, so its 6 polygons can't join and show as "Not Zoned". The fix is filling in `HI`, `Maui`, `Maui`. *(Correction: Claude first reported it as missing from the CSV.)*
- **"Public Hearing" is the value the researchers used**, and no row says "Special Permit". The pipeline only maps "Special Permit", which is why "Allowed Only After Public Hearing" matches nothing.
- **The three ADU occupancy columns** exist as "ADU Renter Occupancy Prohibited", "ADU Employee or Family Occupancy Required", and "ADU Restricted to Only Primary Structure …". The notebook looks for different names, so it drops them.
- **"No limit" is written several ways:** blank, `N/A`, `n/a`, `NONE`, `None`, `No`. The workbook's Conventions tab defines `NONE` as "I checked and there is no limit". The pipeline counts every non-blank value as a requirement, which breaks two things:
  - **ADU max size:** most "has a size limit" flags are false.
  - **Minimum unit size:** the CSV has no actual minimum unit size anywhere, yet 135 districts are flagged as having one, including 90 of Hawaiʻi County's 108. Their tooltips wrongly say "Requires a Minimum Home Size", and the "no minimum unit size" filters gray them out.
- **Tooltip Notes are empty in every county,** which is why no tooltip ever shows a note. **Special Notes** are filled in for some districts, for example the farm-dwelling note on Hawaiʻi County's agricultural rows. Showing those instead would be a content decision for you.
- **The Master's numbers match the CSV:** across 908 lot-size cells, the rounding differences never move a district into a different lot-size bucket. So the CSV doesn't need re-exporting.

**Checked and correct:** Honolulu's 3-family-but-not-1-family districts are real zoning, not errors: BMX-4 downtown, Kakaʻako Mixed Use, and Waikīkī Resort Mixed Use allow apartments but not detached houses.

**About the file itself:** the workbook includes team members' names (Jurisdiction Information, Analysts, and the Discrepancies "Question for" column). Keep it out of the public repo.

---

## Feature 5: Label the House and Senate districts (built and committed)

- [x] Plan approved in chat (2026-10-01). You chose labels like "House 23" over "H23".

**What changed** (in [scripts/map.js](scripts/map.js) and [style.css](style.css)):
- **Labels:** each district gets a chip reading "House 23" or "Senate 12", filled with its overlay's line color, pink or yellow, with black text. Labels ignore the mouse, so clicks reach the zones underneath.
- **Placement:** each label sits at the center of the district's largest piece. House 35 is curved enough that its center falls outside it, so its label falls back to the middle of the widest part of the shape.
- **Only where there's room:** a label shows only if its district has room on screen and it doesn't overlap a label already showing. Larger districts go first. Labels are rechecked after every zoom, so they appear as you zoom in.
- **Popups:** the district popups that could never open are gone.

**Two bugs Claude found and fixed while testing:**
- **Labels vanished after a click:** they disappeared after the first click anywhere on the map. Leaflet closes tooltips not marked `permanent` on any map click in browsers with pointer events, which is every modern one. Fixed with `permanent: true`.
- **Labels drifted after a zoom:** hidden labels came back about 35 px off their spot. Leaflet centers each label using its size, and a `display: none` element has no size. Fixed by hiding with `visibility: hidden`.

**Claude's checks** (headless Edge, old code vs. new; all passed):
- **Old code:** a real click on a district opens nothing, confirming #6.
- **Labels by zoom:** House labels showing at zooms 9, 10, 11, 12, and 13 were 13, 27, 43, 50, and 51, so every district is labeled at zoom 13.
- **Every zoom:**
  - No two labels overlap.
  - Every label is centered on its spot within 1 px.
  - Every label sits inside its own district.
- **Both overlays on:**
  - House and Senate labels show together. At zoom 11 that's 28 House and 24 Senate.
  - None overlap.
- **Click-through:** a real mouse click on "House 18" went through to the zone and opened Honolulu's panel.
- **Turning House off:** removes its labels and leaves Senate's.
- **Links:** a link with House checked shows its labels once the page loads.
- **Regressions:** none.

- [ ] Turn on **House District**. A few labels show at the statewide view. Zoom in on Honolulu and more appear, and they never overlap.
- [ ] Click a zone right through a label. The county panel opens.
- [ ] Click a few more places on the map. The labels stay. This was the first bug.
- [ ] Also turn on **Senate Districts**. Yellow labels join the pink ones without overlapping.
- [ ] Turn **House District** off. Its labels disappear, and the Senate labels stay.

---

## Feature 4: Load overlays only when they're turned on (built and committed)

- [x] Plan approved in chat (2026-10-01).

**What changed:**
- **[scripts/map.js](scripts/map.js):**
  - **Async loaders:** each overlay loader is now an `async` function. It fetches its file with `fetch` and returns its layer. Transit fetches its two files in parallel.
  - **Load on first toggle:** `showOverlay()` downloads an overlay the first time you check it, keeps it for later toggles, and only adds it if the box is still checked. `hideOverlay()` and `syncOverlays()` handle the rest. Nothing downloads at startup anymore.
  - **Zoning data:** `loadMapData()` loads the county outlines and the zones with a loading message and an error message.
  - **Kept:** `loadSewer` stays as it was.
- **[index.html](index.html):** two `role="status"` messages, one at the top of the map (`#mapStatus`) and one under the Overlays heading (`#overlayStatus`). Screen readers announce both.
- **[style.css](style.css):** styles for the two messages. The error red has 7.3:1 contrast.
- **[CLAUDE.md](CLAUDE.md):** describes how data and overlays load now.

**Claude's checks** (headless Edge, old code vs. new; all passed):
- **Fresh visit:** the old code downloads all 8 overlay files (about 17 MB). The new code downloads none.
- **Toggling:** every overlay shows when checked, hides when unchecked, and shows again without a second download. The URL keeps every checked overlay.
- **The #5 crash:** checking Waterways while its file was still downloading (delayed on purpose) made the old code throw `Cannot read properties of undefined (reading 'addTo')`, and the overlay never appeared. The new code shows "Loading Waterways…", then the overlay, with no errors.
- **Unchecking early:** unchecking an overlay before its file arrives keeps it off.
- **Failed overlay:** a failed Federal Lands download shows the red error, unchecks the box, and removes it from the URL. Checking it again retries and works.
- **Failed zoning data:** the old code fails silently. The new code shows "Couldn't load the zoning data. Check your connection and reload the page."
- **Link with overlays checked:** a link with Transit and State Lands checked shows both, and downloads only those two overlays' files.
- **Regressions:** tooltips, the Honolulu panel's 2020–2024 numbers, and the bad-link cleanup still work.

- [ ] Open DevTools → **Network**, then reload. No overlay files (`hydro`, `federal-land`, `state-land`, `dhhl-land`, `rail-transit`, `house-districts`, `senate-districts`) download until you check an overlay.
- [ ] Check **Waterways**. "Loading Waterways…" appears under the Overlays heading, then the overlay shows and the message goes away.
- [ ] Uncheck and re-check **Waterways**. It comes back right away, with no second download in the Network tab.
- [ ] Reload with DevTools → **Network** → throttling set to **Slow 4G**. "Loading zoning data…" shows at the top of the map until the zones appear. Set throttling back to **No throttling** afterwards.
- [ ] Optional error check: in the Network tab, right-click `federal-land.min.geojson` and choose **Block request URL**, then check **Federal Lands**. The red error appears and the box unchecks. Unblock it afterwards.

---

## Intro tour shows once (built and committed)

**What changed:**
- [scripts/map.js](scripts/map.js) saves an `hzaTourSeen` flag in localStorage when the tour is closed or finished, and skips the tour on later visits.
- It uses Driver.js's `onReset` hook, which fires for both Close and Done. That's sturdier than watching for clicks inside `driver-popover-item`, because Driver.js rebuilds that popover at every step.
- If storage is blocked, as in some private windows, the tour simply shows every time, like before.

**Claude's checks** (headless Edge, fresh profile; all passed):
- **Close:** on the first visit the tour shows. Clicking Close sets the flag, and after a reload there's no tour.
- **Done:** removing the flag brings the tour back. Finishing it with Next through to Done (7 clicks) also sets the flag.
- **Storage blocked:** the tour shows and closes normally, then comes back on reload. Nothing throws.

- [ ] Close the tour, then reload. It doesn't come back.
- [ ] To see it again, run `localStorage.removeItem('hzaTourSeen')` in the console and reload.
- [ ] Localhost and the live site keep separate storage, so you'll see the tour once on each.

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

- [X] On localhost, open DevTools → **Network** and filter for `cartocdn`. The tile URLs contain `key=cb1_476c_1_`.
- [X] After you push, do the same on the live site. The tile URLs contain `key=cb1_476c_2_`.

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

- [X] Press Ctrl+U to view the page source. Several `<script>` tags in the `<head>` is fine. Each one should have a `src="…"` and nothing between its opening and closing tags. A `<script>` with code written between its tags is an inline script, and there should be none. `scripts/analytics.js` loads with `defer`.
- [X] On localhost, open DevTools → **Network**, reload, and filter for `googletagmanager`. Nothing shows up. (`fonts.googleapis.com` is expected. That's Google Fonts serving the icons.)
- [X] In the console, run `zonesLayer.getLayers().length`. It returns `262`.
- [X] In the console, run `window.dataLayer`. It's an empty array (`[]`), because Analytics is skipped locally.
- [X] On the live site, open DevTools → **Network** first, then reload. Requests made before DevTools opened aren't listed.
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

- [X] [Quote and bracket in a name](http://localhost:8000/#9/20.4/-157.4/1F%22%5Dx=A).
  - Before: the map never loaded (selector error).
  - Now: it loads, and the filter part of the URL becomes `townActive=&opacity=90`.
- [X] [Broken `%` sequence](http://localhost:8000/#9/20.4/-157.4/opacity=%E0%A4%A).
  - Before: the map never loaded (`URIError`).
  - Now: it loads with the default opacity of 90, and the URL ends in `/townActive=&opacity=90`.
- [X] [Unknown county](http://localhost:8000/#9/20.4/-157.4/townActive=Nowhere).
  - Before: the bogus county stayed in the URL.
  - Now: it's cleared, so the URL ends in `/townActive=&opacity=90`. `townActive=` with nothing after it means no county is selected.
- [X] [County with no zoning data](http://localhost:8000/#9/20.4/-157.4/townActive=Kalawao).
  - Before: Kalawao was outlined in yellow as if selected.
  - Now: no outline, and the county is cleared.
- [X] [Opacity out of range](http://localhost:8000/#9/20.4/-157.4/opacity=9999).
  - Before: the slider jumped to 100.
  - Now: the slider stays at the default of 90, and the URL ends in `/townActive=&opacity=90`.
- [X] [A value no checkbox has](http://localhost:8000/#9/20.4/-157.4/1MLS=Z).
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
