# Verify

This file holds checklists for Bobby to run or review, newest first. Tick a box when it checks out, and tell Claude in chat about anything that doesn't.

**Run the site locally:** from the repo root, run `python -m http.server 8000`, open http://localhost:8000, and close the intro tour.

---

## Feature 2: URL state with `URLSearchParams` (planned, not built)

- [ ] Review the plan below, then approve or change it in chat.

**Goal:** a crafted or mangled link can no longer break the map, and only values that match a real input are restored from the URL. This fixes review items #3 and #10.

**Today:** `setFilters()` runs URL text through `$.unserialize`, which decodes it twice, then builds jQuery selectors from it ([map.js:213-239](scripts/map.js#L213-L239)). A broken `%` sequence or a quote in the link throws an error. `setFilters()` runs inside `initMap()`, so when it throws, the whole map fails to load.

**Changes** (all in [scripts/map.js](scripts/map.js)):

1. **Two small helpers.**
   - `getUrlFilterParams()` reads the filter part of the hash with `URLSearchParams`, which decodes once and never throws.
   - `getFormParams()` builds the query string from the form with `FormData`.
2. **`updateUrl()`** ([95-99](scripts/map.js#L95-L99)) uses `getFormParams()` instead of jQuery's `serialize()`. For this form's values, the output is identical, so existing shared links keep working.
3. **Rewrite the restore part of `setFilters()`** ([213-239](scripts/map.js#L213-L239)):
   - **`townActive`:** keep the first value, and check it once the data loads (step 4).
   - **`opacity`:** use it only if it's a whole number within the slider's min and max. Otherwise the default (90) stays.
   - **Everything else:** check the checkbox whose `name` and `value` both match exactly. The match compares input properties, so URL text never becomes a selector. Pairs that match nothing are ignored.
   - The selector typo on line 218 (#10) goes away with the old code.
4. **In `loadZones()`:**
   - If `townActive` isn't a county in the zoning data, clear it. That includes Kalawao, which has a county outline but no zones.
   - Then, if the link had a filter part, rewrite the URL from the restored state. Bad links clean themselves up; good links stay exactly the same.

**Not changing:**
- the URL format
- the rest of `setFilters()`: revealing subgroups, the red "at least one" warnings, and the Clear filters button (Feature 6 handles that)
- jQuery used elsewhere

`jquery.unserialize.js` stays in place under your keep-everything rule. Nothing will call it anymore.

**How Claude will test it** (headless browser, old code vs. new):
- Links made by the old code restore the same checkboxes, county, and opacity.
- The new URL output matches `$('#form').serialize()` exactly across sample states.
- Setting filters, a county, and opacity, then reloading, gives back the same state.
- Each of these bad links loads the map with no errors and gets cleaned up:
  - `1F"]x=A` (throws a selector error today)
  - `opacity=%E0%A4%A` (throws `URIError` today)
  - `townActive=Nowhere`
  - `townActive=Kalawao`
  - `opacity=9999`
  - `1MLS=Z`
- A fresh visit keeps its plain `#9/…/` URL.

---

## Feature 1: Safe tooltips, popups, and area calculator (built and committed)

**What changed:** tooltips, popups, and the area panel are built from plain text, so text in the data or the URL can't inject HTML. The Native Hawaiian stat's hover label now describes the stat correctly.

**Claude's checks** (headless Edge, old code vs. new):
- The tooltips and the panel are pixel-identical before and after.
- All 262 zone tooltips match the old markup.
- An injected `<img onerror>` stays plain text.
- The bad-link `TypeError` is gone.

- [ ] Hover over a few zones. The tooltips look the same as before (name, county, flags).
- [ ] Hover over a "Not Zoned" area. It shows **Not Zoned** and the county.
- [ ] Click a zone. The panel shows the acreage sentence and three stats: HH Income, Native Hawaiian, Cost-Burdened.
- [ ] Hover over the Native Hawaiian stat. The label reads "Residents who identify as Native Hawaiian (2020 ACS 5-year estimates)".
- [ ] Turn on **Transit Stations (Rail)** and click a station marker. Its name appears.
- [ ] In the DevTools console, run `dataLayer.eachLayer((l) => { l.feature.properties.Z = '<img src=x onerror=alert(1)>' })`, then hover over a zone. The tooltip shows that text exactly as typed, and no alert pops up. Reload the page afterwards.
- [ ] Open http://localhost:8000/#9/20.4/-157.4/townActive=Nowhere. The map loads, no panel appears, and the console shows no red errors.

**Expected console noise:** one yellow warning, "Deprecated include of L.Mixin.Events". It comes from the vendored [leaflet-pattern.js](scripts/leaflet-pattern.js) and was already there before Feature 1.

---

## Repo housekeeping

- [ ] In your repo's **Actions** tab, disable **Pull and Validate Spreadsheet Data**: pick it in the left sidebar, open the `⋯` menu, and choose **Disable workflow**. It runs daily and will fail until Feature 8.
- [ ] Disable **Auto-assign issue** the same way. It's broken because `new Octokit` isn't defined in github-script v4.
