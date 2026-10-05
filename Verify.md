# Verify

This file holds checklists for Bobby to run or review, newest first. Tick a box when it checks out, and tell Claude in chat about anything that doesn't.

**Run the site locally:** from the repo root, run `python -m http.server 8000`, open http://localhost:8000, and close the intro tour.

---

## Roadmap item 2: A filter refactor (approved, ready to build)

- [x] Plan approved in chat (2026-10-04), with the recommended choice for all four decisions at the end.

**Why the filters need it:**
- **They're hard to read.**
  - **Hidden options:** each housing type is a checkbox that reveals more checkboxes, already checked.
  - **Double negatives:** options like "Not Restricted to Elderly Only".
  - **A false alarm:** an empty group turns red, though empty actually means "no limit".
  - **Cryptic sizes:** lot sizes read ".01-.46" acres.
- **Several options change nothing on today's map** (counted in `final.geojson`):
  - **Minimum home size:** no district has one, in any of the 4 housing types.
  - **Elderly-only rules:** no district has one, for any housing type or for ADUs.
  - **ADUs after a public hearing:** no district requires one.
  - **"Not restricted to primary structure":** no district says yes. It only hides the 117 districts the researchers left blank.
- **The HTML is hand-written:** five near-identical blocks, about 300 lines. Under the filter contract, a new filter has to touch this HTML, the data, and the notebook.
- **Markup problems:**
  - two elements share the ID `PermittedResidentialUses`
  - `<div id="Overlays">` is never closed
  - the sidebar is all Tachyons classes

**What you'll see** (the sidebar on desktop, the drawer on phones):

```
Housing types                                      [✕ Clear]
Districts that allow every type you turn on stay colored.

[✓] 1-family homes
      How it's allowed   (•) Either way  ( ) By right only  ( ) Only after a hearing
      Lot size needed    (•) Any  ( ) Under ½ acre  ( ) Under 1 acre  ( ) Under 2 acres
[ ] 2-family homes (duplexes)
[ ] 3-family homes
[ ] 4+ family homes (small apartment buildings)
[✓] Accessory dwelling units (ADUs)
      Only show districts where it…
      [ ] doesn't need the owner to live on the property
      [ ] can be rented out
      [ ] can house anyone, not just family or employees
      [ ] has no size cap
```

- **Approval:** "Either way", "By right only", or "Only after a hearing", one choice. A group can no longer be left empty.
- **Lot sizes:** each choice is a ceiling. "Under ½ acre" means no minimum, or a minimum under half an acre.
  - **Exact ranges:** the notebook's buckets top out at 0.46, 0.91, and 1.83 acres, so the labels are exact.
  - **Blank minimums:** 12 districts that allow 1-family homes have a blank minimum lot size. The notebook counts those as "no minimum", the same convention as Feature 7's "no limit" answers.
- **Positive wording:** ADU options say what's allowed, and none are double negatives.
- **Matching:** unchanged. Turning on two types still shows districts that allow both, and now the panel says so.

**How it's built:**
- **One config, [data/filters.json](data/filters.json) (new):** it lists each housing type, its options, their labels, and the data value each option matches.
  - **`map.js`:** it builds the controls from the config, with `<fieldset>` and `<legend>`, real radio groups, and labels.
  - **Adding a filter:** that becomes one entry in this file, plus the notebook and data steps that already exist.
- **Links:** shared links keep the same format (`1F=&1F=A&1F=AH&1MLS=A&1MLS=B`).
  - **Reading and writing:** a small translation layer turns the controls into those pairs and back, using the config.
  - **Old links:** every link people have shared still opens the same filters, apart from the odd lot-size mixes covered in decision 1.
- **[check_data.py](data-pipeline/check_data.py):** it reads the config instead of the HTML. A config value missing from the data fails the check, as a missing checkbox does today.
- **The rest of the sidebar:** the zone-type key, the overlays, and the opacity slider become semantic HTML with `style.css` classes.
  - **Labels:** the opacity slider gets a proper `<label>`.
  - **Bugs:** the duplicate ID and the unclosed `<div>` get fixed.
  - **Tachyons:** none is left in the sidebar. The area panel keeps its Tachyons for now.
- **Tour:** its filter, overlay, and opacity steps get rewritten for the new controls.
- **Docs:** CLAUDE.md (the filter contract changes), the README, and Verify.md.

**How Claude will check it** (headless Edge, old vs. new):
- **Same results:** for a set of links covering every kind of filter, each county colors the same districts as today. The set includes:
  - each housing type
  - by right only, and hearing only
  - each lot-size ceiling
  - two types at once
  - ADU rules
  - the 7 bad links
- **Same links:** the new controls write the same link format, and Clear filters and the drawer's filter count still work.
- **Keyboard and screen readers:**
  - every option is reachable by Tab
  - radio groups move with the arrow keys
  - every group has a legend
  - every control shows a focus ring
- **Phones:** the drawer holds the new controls, with tap targets of at least 44px. The tour's steps still open and close the drawer.
- **`check_data.py`:** it passes with the config, and fails on a deliberately broken one.
- **Errors:** none.

**Decisions** (approved in chat, 2026-10-04; all the recommended choices):
1. [x] **Lot sizes:** ceilings as radio buttons. A rare old link with an unusual mix, like only ".47–.91", opens as "Any".
2. [x] **Options that change nothing today:** hidden while the data can't tell districts apart. The page checks this as the data loads, so an option comes back on its own once the spreadsheet starts recording it.
3. [x] **ADU rules and blank answers:** a checked rule also hides districts the researchers left blank, as today, and a hint says so.
4. [x] **Wording:** the draft is below, and you edit it when you review the build.

**Build notes** (for whichever session builds this; it may be a cloud session, which sees only the repo):
- **When an option counts as "changes nothing":** checking it can't change which districts stay colored. That means every district that allows its housing type already has the option's value.
  - **Compute it from `final.geojson` as it loads.** Today that hides:
    - minimum home size, for all four types
    - elderly-only, for all four types and for ADUs
    - the ADUs' whole "How it's allowed" choice, because no ADU district needs a hearing
  - **"Can be a separate building" (`APrim`) stays.** It does hide districts the researchers left blank, so it gets decision 3's hint.
- **The translation layer:** `getFilters()`, `getFormParams()`, and `setFilters()` go through the config, not raw checkbox names and values.
  - **Two values from one choice:** a radio like "Either way" stands for two values (`1F=A&1F=AH`), so links and filtering must still produce exactly today's name and value pairs.
  - **Matching stays as is:** `satisfiesFilters()` keeps working on `{name: [values]}`.
- **Loading:** the config is a JSON file, so `initMap()` fetches it before `setFilters()` restores a link. Build the controls first, then restore the link, then start the tour.
- **Test links that must color the same districts as `main`:**
  - each type on its own
  - each type by right only, and only after a hearing
  - 1-family under ½, 1, and 2 acres
  - 2-family and 3-family together
  - ADUs with each rule
  - the 7 bad links in Feature 2's section
  - the shared link `#12/21.33752/-157.86051/1F=&1F=A&1F=AH&1MLS=A&1MLS=B&townActive=Honolulu&Overlay=transit&opacity=90`
- **Testing gotchas:**
  - **Folder paths:** the test server has to serve `index.html` for `/map/`.
  - **House and Senate:** they stack in whichever order their files arrive, so turn them off before screenshots.
  - **CDNs:** a cloud session can't reach them, so its fonts differ. The VS Code session re-tests with the real ones before merging.

<details>
<summary><strong>Wording draft</strong> (edit freely)</summary>

- **Section heading:** Housing types. It replaces "Permitted Residential Uses".
- **Under the heading:** "Turn on a type to see only the districts that allow it. Districts that allow every type you turn on stay colored."
- **The types:**
  - 1-family homes
  - 2-family homes (duplexes)
  - 3-family homes (triplexes)
  - 4+ family homes (apartment buildings)
  - Accessory dwelling units (ADUs), with the hint "A second, smaller home on the same lot, like a backyard cottage or an ʻohana unit."
- **How it's allowed:**
  - **Options:** Either way · By right only · Only after a public hearing.
  - **Hint:** "By right means the county approves it when it meets the rules, with no public hearing."
- **Lot size needed:**
  - **Options:** Any size · Under ½ acre · Under 1 acre · Under 2 acres.
  - **Hint:** "The smallest lot this kind of home needs. Districts with no minimum count as any size."
- **ADU rules:**
  - **Legend:** "Only show districts where an ADU…"
  - **Options:**
    - doesn't need the owner to live on the property
    - can be rented out
    - can house anyone, not just family or employees
    - can be a separate building, like over a garage
    - has no size cap
  - **Hint:** "A rule also hides districts the researchers left blank on it."
- **Overlays:**
  - Waterways
  - Federal lands
  - State lands
  - Hawaiian Home Lands (DHHL)
  - Rail stations (½-mile circles)
  - State House districts
  - State Senate districts
- **Opacity:** "Zone opacity", as a real label for the slider.

</details>

**Size:** this is the biggest item so far. If you'd like to spend your cloud credits, a cloud session could build it once you've approved it. I'd then re-test its branch here with the real CDNs before you merge.

---

## Census data on Home (built and committed)

- [x] Plan approved in chat (2026-10-04).

**Now, from data the site already has:** a "The four counties at a glance" table on Home. It comes from `data/demographics.js`, the file the map's area panel already uses (under 1 KB). These are today's numbers:

| County | Median household income | Households spending 30%+ of income on housing | Native Hawaiian residents |
|---|---|---|---|
| Hawaiʻi | $78,639 | 33.2% | 9.0% |
| Honolulu | $106,195 | 41.5% | 5.1% |
| Kauaʻi | $97,668 | 37.3% | 7.7% |
| Maui | $97,161 | 39.5% | 7.9% |

- **Where:** a new section right after "How to read the map". It's the same three numbers the map's panel shows, side by side.
- **How:**
  - **Data:** `index.html` loads `/data/demographics.js`.
  - **Script:** a small, deferred `scripts/countyStats.js` builds the table with DOM methods. There's one data file, so a rerun of `tools/fetchDemographics.js` updates the map and Home together.
  - **Markup:** a real `<table>` with a caption, column headers, and county names as row headers. The source line comes from the file: "2020–2024 ACS 5-year estimates".
  - **Without JavaScript:** a sentence says the figures need it.
- **Phones:** the table fits a 375 px screen, or scrolls sideways inside its own box, never the page.
- **Later, with item 3:** new Census tables, like housing units by the number of units per building, or rent and home values. Those need `tools/fetchDemographics.js` extended and then run with your key.

**What changed:**
- **[index.html](index.html):** the new section, plus two deferred scripts in the head: `/data/demographics.js` and `/scripts/countyStats.js`.
- **[scripts/countyStats.js](scripts/countyStats.js) (new):** builds the table with DOM methods, and sets every value as text. The data has no ʻokina in its keys, so the script spells out Hawaiʻi and Kauaʻi.
- **[style.css](style.css):** the table's styles. Numbers are right-aligned in tabular figures, so the columns line up.
- **Docs:** CLAUDE.md and the README.

**Claude's checks** (headless Edge; all passed, no errors):
- **Accuracy:** the table matches `data/demographics.js` exactly, from Hawaiʻi's $78,639 to Maui's 7.9%.
- **Structure:** the caption names the source ("U.S. Census Bureau, 2020–2024 ACS 5-year estimates"). The four column headers are marked as columns, and the county names as row headers.
- **iPhone SE (375 px):** the table fits at 343 px, and the page doesn't scroll sideways.
- **320 px phones:** the table is a little wider than the screen, so it scrolls inside its own box while the page stays put.
- **If the data file fails to load:** it says "The county figures couldn't load. Try reloading the page."
- **With JavaScript off:** the note in the HTML stays: "The county figures need JavaScript to show."

**Your checks:**
- [ ] Run the site locally and open http://localhost:8000. Under "How to read the map" there's "The four counties at a glance", a table of the four counties' income, housing cost burden, and Native Hawaiian residents. Honolulu has the highest income and also the highest share of households spending 30% or more of their income on housing.
- [ ] Open the map, click any Honolulu district, and compare the panel's three figures with Honolulu's row on Home. They match ($106,195, 41.5% cost-burdened, 5.1% Native Hawaiian), because both read the same file.
- [ ] In DevTools' device toolbar with iPhone SE, the table fits the screen without the page scrolling sideways.

---

## Roadmap item 1: A navbar and two pages (built and committed)

- [x] Plan approved in chat (2026-10-04), with the four decisions at the end and Home's wording as drafted.

**The goal:** Home, at `/`, explains what the atlas shows and how to read it. The map moves to `/map/`. A navbar links the two: Home · Map.

```
Phone: Home                 Phone: Map                  Desktop: Map
┌──────────────────────┐    ┌──────────────────────┐    ┌───────────────────────────────────┐
│ Hawaii Zoning Atlas  │    │                  [+] │    │ Hawaii Zoning Atlas     Home  Map │
├──────────────────────┤    │                  [−] │    ├─────────────┬─────────────────────┤
│ Where can you build  │    │    full-screen map   │    │ sidebar     │                     │
│ homes in Hawaiʻi?    │    │                      │    │ (filters,   │        map          │
│ [ Open the map ]     │    │            [Map/Sat] │    │  overlays)  │                     │
│ How to read the map  │    ├──────────────────────┤    │             │                     │
│ Try it: Maui …       │    │ ▴ Filters & overlays │    │             │                     │
├──────────────────────┤    ├──────────────────────┤    │             │                     │
│    Home      Map     │    │    Home      Map     │    │             │                     │
└──────────────────────┘    └──────────────────────┘    └─────────────┴─────────────────────┘
```

**The navbar.** It copies Wea Da Bus's tab bar, at this site's own 600px breakpoint:
- **Phones:** fixed along the bottom, 3.75rem tall plus the safe area. Each tab is an icon above its label.
  - **The current tab:** it gets a 3px bar on top as well as color, so it doesn't rely on color alone.
  - **The map's controls:** the bar sits above them (Leaflet's controls sit at z-index 1000).
- **Wider screens:** it becomes the top bar, with the brand on the left and the tabs on the right. The current tab gets a 3px bar underneath.
- **Markup:** `<nav aria-label="Main">` with real links, and `aria-current="page"` on the current tab.
- **Icons:** inline SVGs (a house and a map), with `aria-hidden`.

**Home** (`index.html`, rewritten):
- **Plain page:** semantic HTML and `style.css` only. No Tachyons, jQuery, Leaflet, or 3 MB of map data, so first-time visitors land on a fast page.
- **Hero:** "Where can you build homes in Hawaiʻi?", what the atlas is, and an **Open the map** link. The words come from today's sidebar intro and the tour's first step.
- **How to read the map:**
  - **The colors:** the three zone types, with their swatches.
  - **Filters:** colored means a district allows the housing you picked, and gray means it doesn't.
  - **The area panel:** the share of the county's zoned land.
  - **Overlays:** a line on what each one is.
- **What to take away:** "Try it" links that open the map already set up.
  - **Example:** "Where Maui allows apartment buildings" opens `/map/` zoomed to Maui, with 4+-Family Housing on.
  - **No hard-coded numbers:** the map shows the live data, so nothing goes stale. Numbers come with item 3's stats.
  - **No Honolulu examples yet:** they wait for the Honolulu data check.
- **Sources and credits:** the National Zoning Atlas method, the county maps, the research spreadsheet, the Census data, and the partners and GitHub links from today's sidebar.
- **Old links:** a small `scripts/home.js` forwards any link with a map view (`/#zoom/lat/lng…`) to `/map/` with the same hash. So every link people have shared keeps working.

**The map page** (`map/index.html`, today's `index.html` moved):
- **Paths:** asset paths become root-relative (`/style.css`, `/data/…`), including the `./data/…` paths in `map.js`.
  - **Where that works:** Netlify and `python -m http.server`, both of which serve the repo root.
  - **Where it wouldn't:** hosting from a subfolder, which this site doesn't do.
- **Phones:** the drawer's bar sits just above the tab bar, the way Wea Da Bus's refresh bar does.
  - **Map height:** the map ends at the drawer's bar: 559px of an iPhone SE's 667, up from 367 before Feature 12.
  - **Open drawer:** it takes 70% of the space above the tab bar.
  - **The pan:** it measures the open drawer instead of parsing the CSS variable, so the islands still land in the strip.
- **Desktop:** the map, sidebar, area panel, and status line all start below the top bar.
- **Tour:** step 1 shrinks to a welcome that points to Home for what the atlas means. The filter steps wait for item 2.
- **Accessibility fixes in these files:**
  - **`lang`:** `<html lang="en">` on both pages.
  - **Logo:** it loses its inline style.
  - **Landmarks:** `<header>`, `<nav>`, and `<main>` landmarks.
  - **Unchanged for now:** the sidebar markup waits for item 2.

**Other files:**
- [check_data.py](data-pipeline/check_data.py): reads the checkboxes from `map/index.html`.
- [scripts/analytics.js](scripts/analytics.js): both pages load it, so each page view counts.
- [style.css](style.css): new Tab bar and Home blocks, built on the custom properties. `--tabBarHeight` and `--topBarHeight` drive the map's new offsets.
- **Docs:** CLAUDE.md, the README, and Verify.md.

**Not in this item:**
- **Filters and the sidebar's Tachyons:** item 2.
- **Stats:** item 3.
- **The unclosed `<div id="Overlays">`:** item 2.

**What changed:**
- **[index.html](index.html):** rewritten as Home, with the approved wording and both Oʻahu "Try it" links.
- **[map/index.html](map/index.html):** the old `index.html`, moved with `git mv` so its history follows it. It gets:
  - the navbar
  - root-relative paths
  - `<html lang="en">` and a `<main>` landmark
  - the title "Map | Hawaii Zoning Atlas"
  - the logo without its inline style
- **[scripts/home.js](scripts/home.js) (new):** forwards old `/#zoom/lat/lng…` links to `/map/`. Home loads it without `defer` on purpose: it runs before the page draws, so an old link doesn't flash Home first. It's the one exception to your defer rule, and it doesn't touch the page.
- **[scripts/map.js](scripts/map.js):**
  - **Paths:** data paths start at the root.
  - **The pan:** it reads `--drawerOpenShare` and the tab bar's height.
  - **Tour:** step 1 is a short welcome that points to the Home tab.
- **[style.css](style.css):**
  - **New blocks:** Tab bar and Home.
  - **New variables:** `--colorBrand` (the logo's teal, deepened to 5:1 on white), `--colorZone*` for Home's key, `--topBarHeight`, `--tabBarHeight`, `--tabBarSpace`, and `--mapTop`.
  - **The drawer:** its share variables now sit above the tab bar.
  - **Hover effects:** they apply only with a mouse.
- **[check_data.py](data-pipeline/check_data.py):** reads the checkboxes from `map/index.html`.
- **[scripts/analytics.js](scripts/analytics.js):** its comment now names both pages.
- **GitHub links:** Home's credits and the map's sidebar now point to your repo, boobeh123/HawaiiZoningAtlas, instead of the org's. You asked for this in chat.
- **Docs:** CLAUDE.md and the README.

**Claude's checks** (headless Edge, old site vs. new; all passed, no errors):
- **Old links:** all 8 test links, opened at `/`, now land on `/map/`. They clean up exactly as before: the 7 bad links and a shared one.
- **The map on desktop:** these match the old page:
  - the filter results per county
  - Clear filters
  - the rail overlay
  - the click zoom (it stays at 13)
  - **Layout:** the top bar is 56 px, and the map and sidebar start below it.
  - **Assets:** none returned a 404.
- **The map on an iPhone SE:**
  - **Tab bar:** it takes the bottom 60 px, with the drawer's bar above it. The map gets 559 of 667 px, and the Map/Satellite switch and the credits sit above the drawer's bar.
  - **The drawer:** open, it takes 425 px (70% of the space above the tab bar).
  - **The pan:** the islands land within 1 px of the strip's middle, and return exactly.
  - **The card:** it works as before.
- **The tour:** all 7 steps on a phone and on desktop, old and new.
  - **The drawer:** on phones, it's open for the sidebar steps and closed for the map steps.
  - **Taps:** none selected anything.
  - **The end:** the tour is remembered.
- **Home:**
  - **Loading:** it loads no map scripts. It downloads 0.11 MB, against 14.2 MB for landing on the old map (measured locally, without compression).
  - **Structure:** its headings go h1, h2, h3 in order, and it has header (on phones), nav, main, and footer landmarks.
  - **Keyboard:** every Tab stop shows a focus ring.
  - **Touch:** every standalone link is at least 44 px tall: the tabs, the brand, the button, and the "Try it" links.
  - **One miss:** the four links inside the credits sentence are 18 px tall. WCAG's target-size rule exempts links inside a sentence, but they'd need to become a list to reach 44 px.
- **"Try it" links:** both open `/map/` with exactly the right boxes checked.
  - **Desktop:** Oʻahu fits whole.
  - **iPhone SE:** Oʻahu's two tips run slightly past the edges.
- **The pipeline:** `check_data.py` passes with the new path.

**Your checks:**
- [X] Run the site locally and open http://localhost:8000. Home shows "Where can you build homes in Hawaiʻi?" On desktop, the top bar has Home underlined in teal.
- [X] Click **Open the map**. The map opens at `/map/`, with Map underlined in the top bar, and works as before. Then click **Home** in the bar to come back.
- [X] On Home, click the first **Open this view** link. The map opens on Oʻahu with 1-Family Housing on and only the two smallest lot sizes checked. The colored areas are where a house is allowed on less than half an acre, and the gray covers the rest of the island.
- [X] Open http://localhost:8000/#13/21.33752/-157.86051, an old-style link. It lands on `/map/#13/…` at the same spot.
- [X] In DevTools' device toolbar with iPhone SE, open http://localhost:8000. The brand is at the top and Home · Map is along the bottom. Tap **Map**: the Filters & overlays bar sits just above the tab bar, and tapping it opens the drawer with the islands still in view.

**Decisions** (answered in chat, 2026-10-04):
1. [x] **Phone map page:** no brand header, so the map stays full-screen.
2. [x] **The map's URL:** `/map/`.
3. [x] **Home's wording:** you approved the draft below ("Looks good").
4. [x] **"Try it" examples:** start with Oʻahu, but with examples that don't depend on the coding under question:
   - **Small-lot homes:** the lot-size data is straightforward.
   - **ADUs:** the notes back up the coding.
   - **Apartment buildings on Oʻahu:** they wait for the Honolulu data check.

**Two findings for that check,** from Honolulu's own Special Notes:
- **Apartments in R-5:** the note says housing with 3 or more units is allowed only through planned developments (PD-H) that "require … a public hearing". But 3- and 4+-family housing is coded "allowed as of right", which the map shows as allowed with no hearing. If the hearing is the only path, the coding should be "public hearing" instead.
- **Farm dwellings:** Honolulu's Agricultural districts allow only farm dwellings and are coded as allowing 1-family homes. Hawaiʻi County codes the same situation as prohibited. That alone explains much of the 61% vs. 3% gap between the two counties.

<details>
<summary><strong>Draft of Home's wording</strong> (edit freely)</summary>

**Where can you build homes in Hawaiʻi?**

Zoning is the most important local law you've never heard of. It decides where homes can go, how big they can be, and what kind they can be: a single-family house, a duplex, or an apartment building. The Hawaii Zoning Atlas maps what every zoning district in all four counties allows, so anyone can see where housing can and can't be built.

**[Open the map]**

**How to read the map**

Each shape on the map is a zoning district, and its color says what the district is mainly for:
- **Primarily Residential:** housing is the main use.
- **Mixed with Residential:** housing alongside shops, offices, or other businesses.
- **Nonresidential:** housing isn't an independent use there, as in farm, industrial, and conservation districts.

Pick a kind of housing under the filters, and the map keeps color only where it's allowed. Everywhere else turns gray.

Click or tap a district to see what share of its county's zoned land allows what you picked. You'll also see the county's median household income, the share of households spending 30% or more of their income on housing, and the share of residents who are Native Hawaiian.

Overlays add context: waterways, federal and state land (which counties can't zone), Hawaiian Home Lands, rail stations, and State House and Senate districts. On a phone, the filters and overlays live in the bar along the bottom of the map.

**Try it on Oʻahu**

- **Small lots: where can you build a house on less than half an acre?** The colored areas are where a single-family home is allowed on a small lot. Most of the rest of the island needs a much bigger lot, or doesn't allow homes at all. *(Opens the map on Oʻahu with 1-Family Housing on and only the two smallest lot sizes checked.)*
- **Backyard homes: where can you add an ADU or ʻohana unit?** An accessory dwelling unit lets one lot hold a second, smaller home. Click a district to read its rules. Some ʻohana units require family members to live in both homes. *(Opens the map on Oʻahu with Accessory Dwelling Units on.)*

**About the data**

Our research team read the complete zoning codes of all four counties and recorded what each district allows, following the National Zoning Atlas's method. Federal and state land is left out of the acreage, because counties can't zone it. Every week, the map checks the team's research spreadsheet and updates when it has changed. County statistics come from the U.S. Census Bureau's 2020–2024 American Community Survey.

This atlas supports the National Zoning Atlas movement, with support from Code with Aloha, Faith Action, and the Mercatus Center. The data and code are open source on GitHub.

</details>

---

## Your feedback from the iPhone SE pass (2026-10-04; the zoom change is built and committed)

- [x] **Desktop click zoom:** approved in chat. It's one rule everywhere now: a click zooms in to the county when you're zoomed out farther than the county, and never zooms out.
- [x] **Default opacity:** decided in chat: it stays at 90%. The zone colors pass the palette checks only at 90%.
  - **At 35%:** the closest pair would fall to 7.3, against a floor of 15, and to 3.6 with colorblindness, against a target of 8.
  - **The gray:** the "doesn't allow it" gray would all but disappear (1.14:1 on the basemap), and that's the main thing the map shows.
- [x] **Default basemap:** decided in chat: Map stays the default, with Satellite one tap away.
  - **Performance wasn't the problem.** Tiles cost 0.1 to 0.7 MB per view either way, and each view settles in about a second.
  - **Readability was.** At 90%, the zones hide the photo, and at 35% they're hard to read over it.

**What changed for the zoom:**
- [scripts/map.js](scripts/map.js): `showCounty()` drops its phones-only check, so desktop follows the phone rule.
- **Docs:** CLAUDE.md and the README.

**Claude's checks** (headless Edge, `main` vs. the new code; all passed, no errors):

| Case | Before | Now |
|---|---|---|
| Desktop at zoom 13, click a district | zoomed out to 11 to fit Oʻahu | stays at 13, same spot |
| Desktop statewide (zoom 8), click Maui | zooms in to fit Maui (10) | the same |
| Desktop at 13, then click a second Honolulu district | stuck at 11 after the first zoom-out | stays at 13, and the panel switches districts |
| Desktop at 13, click the same district twice | stuck at 11 | stays at 13, and the second click clears the selection |
| Phone at 13 or at 7 | only zooms in | the same |

**Your checks** (on desktop):
- [X] Open http://localhost:8000/#13/21.33752/-157.86051 and click the district in the middle. The panel opens, and the map stays where it is: the URL still starts with `#13/`. Before, it zoomed out to fit all of Oʻahu, so you lost your place.
- [X] Zoom out until you see every island, and click Maui. The map zooms in to fit Maui. From far out, a click still takes you to the county you picked.

---

## Feature 11, step 1: Custom properties for `style.css`, and fixed zone colors (built and committed)

- [x] Plan approved in chat (2026-10-04), with zone colors **C**.

**Why:** your standards define colors, fonts, and spacing once, as custom properties on `:root`.
- **Today:** `style.css` has raw values instead: 14 colors used 22 times, 2 font families in 4 places, and 9 font sizes.
- **The review:** the new drawer CSS added more raw values, which the Feature 12 review flagged.
- **Later:** the navbar and Home page (roadmap item 1) will reuse these variables.

**Why the zone colors change too:** you OK'd a new color scheme if it makes sense. Today's zone colors fail the dataviz skill's palette validator, measured as they show on the map: at 90% opacity over the basemap, checking every pair, since any two districts can sit side by side.

| | Primarily Residential | Mixed with Residential | Nonresidential |
|---|---|---|---|
| Today | `#BB22CA` magenta | `#714674` at 92% | `#714674` at 67% |
| **C (chosen)** | `#BB22CA`, unchanged | `#4a2b83`, deep purple | `#aa75b6`, soft orchid |
| D (not chosen) | `#BB22CA`, unchanged | `#4a2b83`, deep purple | `#a498e6`, lavender |

| Check | Today | C |
|---|---|---|
| Mixed vs. Nonresidential, normal vision (needs 15 or more) | 12.2, **fails** | every pair 15.6 or more |
| With colorblindness (target 8) | 10.1 | every pair 10.3 or more |
| Mixed and Nonresidential read as colors, not gray (chroma 0.10 or more) | 0.071 and 0.049, **fail** | all 0.10 or more |
| Nonresidential vs. the "not satisfying" gray | clearly apart | clearly apart (22.0) |
| Nonresidential vs. the basemap (3:1 ideal) | 2.86:1 | 2.95:1 |

- **Why C:** it keeps today's look. The magenta stays, and Nonresidential, which covers 93% of the zoned land, stays a calm mauve. Mixed districts finally stand apart, as deep purple.
- **Below 3:1:** both today's Nonresidential and C's sit just under 3:1, so the legend and the district panel do the identifying.
- **Tried and rejected:** one-purple ramps from dark to light. They passed, but turned whole islands pink.

**What changed:**
- [style.css](style.css): every color, font, and font size, and the repeated spacing, now comes from variables on `:root`.
  - **Colors:** `--colorSurface`, `--colorInk`, `--colorText`, `--colorTextSoft`, `--colorTextMuted`, `--colorTextFaint`, `--colorBorderStrong`, `--colorBorder`, `--colorShadow`, `--colorRule`, `--colorError`, `--colorHouse`, and `--colorSenate`.
  - **Fonts:** `--fontBody` and `--fontHeading`.
  - **Font sizes:** `--fontSize3xs` (10px) through `--fontSizeLg` (20px).
  - **Spacing:** `--spaceXs`, `--spaceSm`, and `--spaceMd`.
  - **Layout:** `--edgeGap`, `--sidebarWidth`, and `--areaPanelWidth`. So the tablet rule's old mystery `400px` is now written as two edge gaps plus the sidebar's width.
  - **Left as is:** sizes in `em`, which stay relative on purpose, and a few one-off nudges like 5px.
- [scripts/map.js](scripts/map.js): `zone2color` has the new Mixed and Nonresidential colors and a note on how they were checked. It's also `const` now.
- **Docs:** CLAUDE.md and the README.

**Claude's checks** (headless Edge, `main` vs. the new code; all passed, no errors):
- **Computed styles:** 40 properties per element, identical on every element except the zone fills and the legend's squares. That held in 9 states:
  - **Desktop and tablet:** a fresh load, and with a district clicked.
  - **Phone:** the drawer closed and open, the card collapsed and expanded, and the tour's first popover.
  - **Size:** each state has 264 to 502 elements.
- **Screenshots:** with the zones and the legend's squares hidden, all 9 states are pixel-identical to `main`.
- **What's drawn:** Mixed districts fill with `#4a2b83` and Nonresidential with `#aa75b6`, and the legend's squares match. Primarily Residential, the not-satisfying gray, and Not Zoned are unchanged.
- **The validator:** C passes every check as drawn, as in the table above.
- **Missed:** the tablet "clicked" state repeated the fresh one, because the test's click landed on the sidebar. The panel's tablet position still compared equal, because computed styles cover hidden elements too.

**Your checks:**
- [X] Run the site locally. The map looks as it did, except for two things: Mixed with Residential districts are deep purple, and Nonresidential ones are a soft orchid. The legend's squares match.
- [X] Open http://localhost:8000/#14/21.2905/-157.8330 (Waikīkī and Ala Moana). Waikīkī, Ala Moana, and Kakaʻako are deep purple Mixed districts, and they stand out from the magenta Primarily Residential neighborhoods inland.
- [X] Turn on **2-Family Housing** and zoom out to Oʻahu. Districts that don't allow it turn gray, which reads clearly differently from the orchid Nonresidential districts that do.
- [X] Everything else looks exactly as before: the sidebar, tooltips, the House and Senate labels, and the drawer and card on iPhone SE.

**Found while checking, for a later step:** the overlay colors fail the same validator.
- **Selection vs. waterways:** the selected county's cyan outline and the waterways' light blue look almost identical with protanopia (ΔE 0.8).
- **Senate vs. federal land:** the Senate yellow and the federal lands' yellow-green are close even with normal vision (9.1).
- **Faint on the basemap:** several overlays, including the Senate yellow at 1.09:1, nearly vanish against the basemap.

These need their own small plan. Some were deliberate choices, such as the cyan you picked.

---

## Next up: a navbar, a filter refactor, and a Home page with stats (roadmap, approved)

- [x] Order approved in chat (2026-10-04): 1, 2, 3. Each item gets its own detailed plan here before any code.

These ideas came from our chat on 2026-10-04 and were only in chat until now. That's why the cloud session built the older drawer plan instead. The drawer stays: it moves onto the map page.

1. **A navbar and two pages**, like Wea Da Bus.
   - **Pages:** Home at `/` and the map at `/map/`. Home forwards old links (`/#zoom/lat/lng…`) to `/map/`, so every link already shared keeps working.
   - **Navbar:** a bottom tab bar on phones (Home · Map) and the top navigation on desktop. On the map page, the drawer's bar sits just above the tab bar, the way Wea Da Bus's refresh bar sits above its tab bar.
   - **Home, to start:** the key zoning info from the sidebar's intro: what the atlas shows, how to read it, and its sources and credits.
     - **Takeaways:** a "what to take away" section, with worked examples like the Maui one under item 3. You said you weren't sure what to look for on the map, and visitors won't be either.
   - **Tour:** Home explains what the atlas means, so the tour can stick to how to use the map.
   - **Standards:** the new markup and CSS follow yours (semantic HTML, custom properties, no Tachyons), which starts Features 10 and 11 for those parts.
2. **A filter refactor.**
   - **One config** lists every filter, and the code builds the controls from it, which was Feature 14's idea. Adding a filter becomes one entry in a list instead of hand-written HTML.
   - **Markup:** `<fieldset>` and `<legend>` groups, and clearer controls than checkboxes that reveal more checkboxes.
   - **Links:** the same names and values in the URL, so shared links keep working. `check_data.py` reads the config instead of `index.html`.
   - **Where:** it fills both the desktop sidebar and the phone drawer.
   - **Tour:** its steps get rewritten for the new controls. Only its phone behavior has changed so far: it opens the drawer. Its text still describes the old sidebar.
3. **Home stats and more Census data.**
   - **Stats:** the pipeline writes a small `data/stats.json`, so Home never downloads the 12.6 MB map file. The weekly sync keeps it current.
   - **Census:** more tables from `tools/fetchDemographics.js`, which you run, since the key stays on your machine. For example, housing units by number of units per building would show what's built next to what zoning allows.
   - **Charts:** plain HTML and CSS, each with a table under it, so no new library.
   - [ ] **To do before any chart, not a check of something built:** settle whether Honolulu's apartment coding is right. Leave this box empty until then.
     - **What the spreadsheet says:** Honolulu's main residential districts (R-5 through R-10) and its farm districts allow buildings with 3 or more homes "as of right", meaning no hearing is needed.
     - **What the districts' own notes say:** buildings with 3 or more homes are allowed only through a planned development, which needs a public hearing. If the notes are right, those districts should say "public hearing" instead.
     - **Why it matters:** as coded, 1-family, 2-family, and 4+-family housing each light up 61% of Honolulu's zoned land, so the map looks almost the same whichever one you pick. Maui shows the story the atlas is meant to tell: 1-family homes are allowed on 35% of its zoned land, and 4+-family homes on 1%.
     - **How:** Claude can read Honolulu's zoning code and propose a fix. Fixes go in `pull_sheet.py`, because the team's sheet stays untouched.

**Recommended order: 1, 2, 3.**
- **The navbar and pages come first:** they're the frame the other two live in.
- **The filter refactor comes second:** its config becomes the one list of housing types, approval levels, and lot-size ranges, and the stats page reuses it for its labels.
- **The Honolulu check should happen soon.** It's needed before item 3, but it also affects the map today: it's why Oʻahu doesn't seem to tell a story yet.

**What happened to Features 10 and 11:** nothing yet, and neither is dropped. After Feature 9, the next plan written here was Feature 12, because you'd asked about the phone layout, so that's the one the cloud session picked up.
- **Feature 11** (plain CSS on custom properties) starts now, with the step above.
- **Feature 10 and the rest of 11** come with items 1 and 2:
  - **Feature 10** is semantic HTML and accessibility.
  - **Why not first:** items 1 and 2 rebuild the same markup, so doing 10 and 11 first would mean redoing them.
  - **Overlays bug:** the unclosed `<div id="Overlays">` that the cloud session found gets fixed in item 2.

---

## Feature 12: A filters drawer and a compact area card on phones (built and committed)

- [x] Started 2026-10-04 in a Claude Code cloud session, from your request to pick up where we left off. It follows the plan that was here, with the changes listed below.

**Where it is:** merged into `main` on 2026-10-04 (`7b8fa24..9d83792`) and live. The cloud session built it on the `claude/brave-meitner-ipdy2j` branch.

**Before, on a 375×667 phone:** the map got the top 367 px. The sidebar always took the bottom 300 px, and a tapped district's panel covered another 147 px of the map.

**Now (phones, 600px and narrower; desktop and tablets unchanged):**

```
Nothing selected            District tapped             Drawer open
┌──────────────────────┐    ┌───────────────────┐[+]   ┌───────────────────┐[+]
│                  [+] │    │ 56.8% of Honolulu ▾│[−]   │ 56.8% of Honolulu ▾│[−]
│                  [−] │    │ Residential - 5,000│      ├────── map ────────┤
│     full-screen      │    │ PD-H PRDs are all… │      ├───────────────────┤
│        map           │    └───────────────────┘      │ ▾ Filters & overlays│
│                      │         full-screen map       │   (scrolls inside)  │
│            [Map/Sat] │               [Map/Sat]       │                     │
├──────────────────────┤    ├──────────────────────┤   │                     │
│ ▴ Filters & overlays │    │ ▴ Filters & overlays │   │                     │
└──────────────────────┘    └──────────────────────┘   └─────────────────────┘
```

| On a 375×667 phone | Before | Now |
|---|---|---|
| Map | top 367 px | top 619 px, everything above the bar |
| Filters | always the bottom 300 px | a 48 px bar; open, 467 px (70%) |
| Tapped district | a 147 px panel | a 96 px card; 248 px at most when expanded |

**Changed from the plan:**
- **The map stops at the bar** instead of running under it. That keeps the Map/Satellite switch and the credits above the bar without moving them.
- **The drawer grows instead of sliding.** It looks the same, but the tour's library turns off slide animations on the parents of whatever it highlights, so a sliding drawer would jump during the tour.
- **During the tour the drawer opens lower,** at 45% of the screen (the old panel's height), so the tour's popovers keep their room at the top. Each step's element sits as low in the drawer as it fits, away from the popover.
- **Opening the drawer pans the map up** (your choice, 2026-10-04). Without it, the strip of map above the open drawer often showed only ocean, because the islands sat behind the drawer. Now what was in the middle of the map moves into the strip, and closing the drawer pans it back.
- **Added after testing** (see Claude's checks):
  - **Stray taps:** the tour changes steps the moment your finger touches Next, so the tap's click used to land on whatever the next step put under your finger. On a phone that could be the drawer's bar or a district. Now that one click is ignored.
  - **The tour and the bar:** the bar does nothing while the tour runs.
  - **Rotation:** turning the phone mid-tour keeps the drawer right.
  - **Overlay messages:** a message like "Couldn't load House District" is still announced by screen readers while the drawer is closed.
  - **Keyboard:** while the drawer is open, keyboard focus skips the map controls it covers.
  - **Narrow phones:** on the narrowest phones (280 px), the bar stays on one line.
  - **The card's touch target:** its whole top edge is a full-size touch target.
  - **Tour wording:** on phones the tour says "the Filters & overlays panel" instead of "the menu on the left-hand side".

**What changed:**
- [index.html](index.html):
  - **The drawer's bar:** a `<button>` with `aria-expanded`.
  - **A hidden status line** outside the drawer, for screen readers.
- [scripts/map.js](scripts/map.js):
  - **The drawer:** `setDrawerOpen()`, and the filter count with `countHousingFilters()`, which the Clear filters button now shares.
  - **The card:** its header button, `buildAreaCardToggle()`.
  - **The tour:** `showTourStep()` and the stray-tap guard.
- [style.css](style.css): the phone media query, and three new variables on `:root` (`--drawerBarHeight`, `--drawerOpenHeight`, `--drawerTourHeight`). `--phoneMapHeight` is now the screen minus the bar.
- **Docs:** CLAUDE.md and the README. Both also say about 3.0 MB for the map data now, which is what your Feature 9 check measured on the live site.

**Claude's checks** (headless Chromium, old code vs. new, with the CDNs served locally because this cloud session can't reach them; blank basemap):
- **Round 1:** six independent testers each took one area: desktop and tablets, the drawer and accessibility, the card, the tour, earlier features, and a code review. Skeptics then tried to reproduce each problem they reported.
  - **Four confirmed problems, all fixed:**
    - **The stray-tap guard also ate keyboard presses:** at phone width without touch, each tour step needed Enter twice.
    - **Overlay errors went silent for screen readers** while the drawer was closed.
    - **After rotating:** going from landscape to portrait could leave the bar showing a sliver of the logo.
    - **After rotating mid-tour:** the drawer stayed at the tour's height.
  - **Smaller fixes:** the remaining items in "Added after testing" above.
- **Round 2:** four fresh testers on the fixed code. I stopped it before its skeptics finished, to save your credit, and checked the findings myself instead.
  - **Fixed:**
    - **The bar needed the tour's library:** if Driver.js failed to load from its CDN, the bar couldn't open the drawer.
    - **The ocean strip:** see "Opening the drawer pans the map up".
    - **Repeated messages:** an old overlay error was announced again every time the drawer closed.
    - **Scroll positions:**
      - After the tour, the drawer first opened scrolled to its bottom.
      - Going back to tour step 1 left it scrolled.
      - Switching districts in an expanded, scrolled card hid the new district's name.
  - **Not fixed:** listed under "Left for later" below.
- **Final checks, after every fix:**
  - **Desktop (1400×900) and tablet (768×1024):** screenshots are byte-identical to the old code, both on a fresh load and with a district clicked.
  - **The pan:** opening the drawer moves the middle of the map to the middle of the strip, within 1 px. Closing it moves it back exactly, with reduced motion on or off.
  - **Rerun:** the tour, keyboard, and rotation checks.
- **Desktop (1400×900 and 1024×768) and tablets (768×1024, and a phone held sideways at 667×375):** screenshots are pixel-identical to the old code. Element positions, styles, and Tab order are the same too, and nothing on these screens is ever inert.
- **The tour on phones:**
  - **Drawer per step:** the drawer is open for the five sidebar steps and closed for the map and Map/Satellite steps. It closes when the tour ends, and every tap on Next or Done leaves no district selected.
  - **Coverage:** the popover covers each step's element no more than before:

    | Step | 375×667 before → now | 320×568 before → now |
    |---|---|---|
    | 1. Hawaii Zoning Atlas | 51 → 3 px covered | 178 → 130 |
    | 2. Zoning Districts | 40 of 40 visible px covered → 11 of 94 | 94 of 94 → 86 of 94 |
    | 3. Permitted Residential Uses | 0 → 0 | 54 → 0 |
    | 5. Overlays | 0 → 0 | 0 → 0 |
    | 7. Zone Opacity | 0 → 0 | 0 → 0 |

- **Keyboard:** the old and new tours both take one Enter per step.
- **Regressions:** none.
  - **Feature 2:** its seven bad links clean up to the same URLs as before.
  - **Everything else:** Clear filters, shared links, overlays and their labels, tooltips, and zone colors behave the same.
  - **Errors:** none in any run.

**Claude's checks in VS Code, before the merge** (headless Edge with the real CDNs, which the cloud session couldn't reach; `main` vs. the branch; all passed, no errors):
- **Desktop and tablet** (1400×900, 1024×768, 768×1024): screenshots are pixel-identical to `main`, on a fresh load and with a district clicked.
- **Phones** (375×667 and 320×568), with real touch taps:
  - **Layout:** the map ends at the bar, with the Map/Satellite switch and the credits above it.
  - **The drawer:** it opens to 70%, and `inert` moves between the drawer and the map's corners.
  - **The pan:** opening moves the islands to within 1 px of the strip's middle, and closing moves them back exactly.
  - **The rest:** "1 filter on" shows, the card is 96 px collapsed and expands and shrinks, and a shared link keeps its count.
- **The tour** (375×667): the drawer is open for steps 1, 2, 3, 5, and 7 and closed for 4 and 6. No tap selected anything, the drawer closes at the end, and the tour is remembered.
- **Real fonts:** step 2's popover is 45 px taller than an iPhone SE screen, the same as on `main`, so it scrolls.
- **Regressions:** the 7 bad links, a shared link, and Clear filters give the same results as `main`.
- **The live site, after the deploy:**
  - **iPhone SE size:** the bar shows, the drawer opens to 467 px and closes, and a tapped district shows its card.
  - **Desktop:** it keeps the sidebar.
  - **Both:** all 261 districts draw, with no errors.
- **Code review against your standards:** two deviations, neither a bug.
  - **The drawer's CSS** uses raw colors and sizes (`white`, `rgba(0, 0, 0, 0.8)`, `0.6`, `0.1`, `16px`, `14px`, `6px`) instead of custom properties.
  - **The new event listeners** sit inside `initMap()`, like every existing one, instead of at the bottom of `map.js`. That belongs to Feature 13.
- [x] Decided in chat (2026-10-04): custom properties now, as Feature 11's first step (see the plan at the top).

**Your checks.** In Edge or Chrome, open DevTools (F12) and turn on the device toolbar (Ctrl+Shift+M) with **iPhone SE**:
- [X] Reload. The map fills the screen above a bar that says "Filters & overlays". The Map/Satellite switch and the credits sit just above the bar.
- [X] Tap the bar. The drawer opens to about two-thirds of the screen, and the map slides up so the islands show in the strip above it. Turn on **1-Family Housing**: the bar says "1 filter on", and the islands above change color. Tap the bar again: the drawer closes and the map slides back.
- [X] Tap a district on Oʻahu. A short card at the top shows the county's percentage, the district's name, and one line of its note. Tap the card's top row. It expands to the full sentence, the three stats, and the whole note. Tap it again, and it shrinks.
- [X] In the console, run `localStorage.removeItem('hzaTourSeen')` and reload. Step through the tour. On step 2, scroll inside the popover to reach Next. The drawer opens for the sidebar steps, closes for the map and Map/Satellite steps, and closes at the end. Nothing gets selected by your taps on Next or Done.
- [X] Turn off the device toolbar. The desktop layout looks the same as before.
- [X] Try it on your own phone on the live site.

**Found along the way, not changed:**
- **`index.html`'s `<div id="Overlays">` is never closed.** So the browser puts Zone Opacity and the credits inside it, and the tour's Overlays step highlights them too.
  - **Why it's left:** closing it changes the credits' line spacing on desktop.
  - **Where it belongs:** the "Semantic HTML and accessibility" item.
- **Overlay messages on phones** only show on screen when the drawer is open, but screen readers hear them either way. Before, they sat in the panel under the map, usually scrolled out of view.
- **Rotating mid-tour across 600 px** keeps the drawer right, but the step 3 text stays worded for the orientation the tour started in.
- **Tour step 2's popover** is taller than a 320×568 screen, and, with the real fonts, an iPhone SE's 375×667 one. So its Next button needs a scroll there. That's unchanged from before.

**Left for later** (round 2 testers' reports, all minor; I didn't reproduce them separately):
- **A district tapped while the drawer is open:** if it's in a new county, the zoom fits that county to the whole map, so part of the county is behind the drawer.
- **Phones held sideways but under 600 px wide** (like 568×320): with the drawer open there's almost no map left.
- **Rotating from portrait to landscape mid-tour** can scroll the page and hide the highlighted element. The tour's wording also stays as it was at load.
- **Driver.js's highlight box** can make the page scroll a little during some tour steps. Step 1 adds 10 px sideways on phones. The old code did this on other steps.
- **Safari before version 16:** it lacks `overflow: clip`, so the rotation sliver can still happen there.
- **Focus when the drawer closes:** if keyboard focus is inside the drawer as it closes, focus drops back to the page.

---

## Feature 9: Shrink the map's data files (built and committed)

- [x] Plan approved in chat (2026-10-04). **Waterways:** you chose to keep their fields, so `hydro.min.geojson` is unchanged.

**Changed from the plan:**
- **Where the script lives:** `data-pipeline/shrink_geojson.py`, not `tools/`. The notebook imports it, and the pipeline's other Python files live there.
- **Snapping instead of plain rounding:** plain rounding left 48 of the 261 districts with invalid shapes, such as edges that cross or slivers that collapse to nothing. Leaflet draws those fine, but GIS tools like QGIS reject them. So the notebook snaps the shapes with `set_precision` first. It uses the same 1 m grid and keeps every shape valid.

**What changed:**
- [CombineJurisdictions.ipynb](data-pipeline/CombineJurisdictions.ipynb): the save cell snaps every point to a 0.00001° grid (about 1 m), then runs `shrink_geojson.py` on the file. The weekly sync now produces the small file.
- [shrink_geojson.py](data-pipeline/shrink_geojson.py) (new, standard library only): rounds a GeoJSON file's coordinates to 5 decimal places and drops the spaces, in place.
  - **Run once on:** `counties.geojson` and `rail-transit-line.geojson`, the two other files at full precision. Both kept valid shapes.
- [.gitignore](.gitignore): ignores the `__pycache__/` folder Python writes when the notebook imports the script.
- **Regenerated:** both `final.geojson` copies. `final.csv` is unchanged.
- **Docs:** CLAUDE.md, the README, and [data-pipeline/README.md](data-pipeline/README.md).

**Result:**

| | Before | After |
|---|---|---|
| Downloaded before the map shows (compressed) | 8.8 MB | **3.2 MB** |
| Map load on a 10 Mbps phone connection | 8.5 s | **3.6 s** |
| `final.geojson` unpacked, which the browser has to parse | 25.4 MB | **12.6 MB** |
| County outlines, unpacked | 1.5 MB | **0.8 MB** |
| Rail line, unpacked, when turned on | 2.7 MB | **0.4 MB** |

Netlify sends today's `final.geojson` as 8.6 MB, so expect about 3.2 MB once this is live.

**Claude's checks** (all passed, no errors):
- **Data,** old vs. new `final.geojson`:
  - **Districts:** all 261, with identical properties in the same order.
  - **Shapes:** none invalid, before or after. No point moved more than 0.76 m, which is half a grid cell corner to corner.
  - **Removed:** 35 slivers left over from digitizing, none bigger than 4.8 m² or wider than 0.34 m.
  - **Acreage:** the area calculator reads `MA`, which the notebook computes before snapping, so its numbers don't change at all. The shapes' own total area changed by 0.0008%.
  - **`check_data.py`:** it passes.
- **The sync:** two notebook runs gave byte-identical files, so a week without sheet changes still commits nothing.
- **Screenshots,** old vs. new, on a blank basemap with House and Senate off: statewide, Honolulu and the rail line up close, Hilo up close, Kauaʻi outlined, and Maui selected.
  - **Differences:** 0.1% to 1% of pixels. All of them sit on zone edges, or on the hairline seams between neighboring zones, moved by about a pixel.
  - **Unchanged:** every zone's color, and every shape big enough to see.
- **Load time:** headless Edge throttled to 10 Mbps with 40 ms latency and no cache, three runs each: 8.4–8.6 s before, 3.5–3.7 s after.
- **Not from this change:** House and Senate lines stack in whichever order their files finish downloading, so their shared borders show pink on some loads and yellow on others. That's been true since both became checked by default.

**Your checks:**
- [X] Run the site locally. Zoom to street level in Honolulu and in Hilo. The districts line up with the streets as before, with no new gaps or slivers.
- [X] With no filters checked, click one district in each county. The area panel's county totals match the ones from before this change: Hawaii 1,046,964 acres, Honolulu 210,239, Kauai 192,516, and Maui 477,001.
- [X] Turn on Transit Stations (Rail). The rail line follows its route, with the stations on it.
- [X] Optional, in Git Bash from the repo root: `~/hza/Scripts/python -X utf8 -c "import geopandas as gpd; print((~gpd.read_file('data/final.geojson').is_valid).sum())"` prints `0`, meaning no invalid shapes.
- [X] In Git Bash: `curl -s -H 'Accept-Encoding: br' -o /dev/null -w '%{size_download}\n' https://hawaiizoningatlas.netlify.app/data/final.geojson` prints about 2990000 (bytes). Before this change it printed 8621444.

---

## Special Notes in the tooltips and the area panel (built and committed)

- [x] Plan approved in chat (2026-10-04), with all three recommendations.
  - **Notes:** a preview in the tooltip, and the full note in the panel.
  - **The farm-dwelling note:** copied to all 20 agricultural districts.
  - **Researcher notes:** hidden.
- [x] **Added at your request:** no tooltips on phones. Phones never zoom out, while desktop keeps fitting the county.

**What changed:**
- [CombineJurisdictions.ipynb](data-pipeline/CombineJurisdictions.ipynb):
  - **New property:** Special Notes reach the map as `SN`, adding 43 KB to `final.geojson`.
  - **Researcher notes:** "missing MG10" is dropped.
  - **The farm-dwelling note:** A-100a's note is copied to the other 19 Hawaiʻi A- districts.
  - **Regenerated:** both `final.geojson` copies and `final.csv`.
- [scripts/map.js](scripts/map.js):
  - **Tooltip:** a ~160-character note preview. When a note is cut, "Click the district for the full note" follows it.
  - **Panel:** clicking a district adds its name, flags, and full note under the county stats.
  - **Clicking:** another district in the same county switches the note without moving the map. Clicking the same district again closes the panel.
  - **Phones and touch-only screens:** no district tooltips. The panel shows the details instead.
  - **Phones only:** a tap zooms in to the county from a wider view and never zooms out. Desktop still fits the whole county.
- [style.css](style.css):
  - **Long notes:** they scroll inside the panel.
  - **On phones:** the panel takes at most 40% of the map's height, and the tapped district comes first.
- **Docs:** CLAUDE.md and the README.

**Claude's checks** (headless Edge, old code and data vs. new; all passed, no errors):
- **Data:** only the new `SN` property changed, across all 261 districts.
  - **Notes on the map:** 161 districts have a note.
  - **The farm-dwelling note:** all 20 Hawaiʻi agricultural districts carry it.
  - **"missing MG10":** it's gone.
  - **`check_data.py`:** it passes.
- **Tooltips:** Honolulu's Residential - 5,000 sf (a 606-character note) shows a clean preview plus the click hint. Kauaʻi's Industrial Limited shows its whole short note with no hint.
- **The panel:**
  - **Clicking Residential - 5,000 sf:** shows its exact full note.
  - **Clicking Apartment - Low-Density:** in the same county, this switches the note without moving the map. Its note contains a `<`, which shows as text, not markup.
  - **Clicking it again:** closes the panel.
  - **A-20a and MG-1a:** A-20a shows the farm-dwelling note, and MG-1a shows "No notes for this district".
  - **Clear filters:** closes the panel.
- **Zoom:**
  - **Desktop:** from zoom 13 in Wailuku, a click still fits Maui at zoom 10.
  - **Phone, from zoom 13:** a tap stays at 13. The old code jumped out to zoom 8.
  - **Phone, from zoom 7:** a tap zooms in to Honolulu.
- **Phones and touch screens:**
  - **No tooltips:** none on a 375px phone, or on a 1,024px touchscreen.
  - **Panel size:** on the phone, it ends at 157 of the map's 367 pixels, so the middle stays free to tap.
- **Regressions:**
  - **Feature 6 checks:** all 14 unchanged.
  - **Mobile layout checks:** unchanged apart from panel heights. Panels are taller where a district note now shows, and shorter on phones with the new cap.

**Your checks:**
- [X] On desktop, open http://localhost:8000/#13/21.33752/-157.86051 in a new tab. Hover the district in the middle. The tooltip ends with "…" and "Click the district for the full note".
- [X] Click it. The panel shows "Residential - 5,000 sf" and the whole note, scrolling if needed. Now click a neighboring Honolulu district. The note changes and the map doesn't move.
- [X] Open http://localhost:8000/#13/19.4504/-155.72565 and click the district in the middle (A-20a). The note begins "For all Agricultural Districts…".
- [X] In DevTools' device toolbar, pick iPhone SE and reload. Zoom in close on a town and tap a district. No tooltip appears, the map doesn't zoom out, and the panel at the top starts with that district's name and note.

---

## Feature 8: Revive the spreadsheet sync (built and committed)

- [x] Plan approved in chat (2026-10-03).
  - **Decisions:** the master stays untouched, changes push straight to `main` on your repo, and the sync runs weekly plus a button.
  - **No AI reviewer:** fixed checks do that job instead.

**What changed:**
- **[data-pipeline/pull_sheet.py](data-pipeline/pull_sheet.py)** (new, standard library only):
  - **Download:** it reads the four county tabs through Google's public export, without editing the sheet.
  - **Corrections:** it applies three: the Kauaʻi spelling, Maui `P`'s blank cells, and `OD/PD` → `OS/PD`.
  - **Output:** it writes `data-pipeline/hawaii-zoning-data.csv` and lists every changed cell.
  - **Safety stop:** it won't run if a tab's column names change, so a renamed column can't quietly break the map.
- **[data-pipeline/check_data.py](data-pipeline/check_data.py)** (new): it fails the run if any of these break:
  - a county is missing, or loses more than a fifth of its districts
  - a sidebar checkbox stops matching any district
  - a flag stops being the text the site expects
- **[data-pipeline/csv-validation/](data-pipeline/csv-validation/):**
  - **Spellings:** the validators accept "Kauai" and the sheet's "Honolulu County".
  - **Input:** `validation.py` checks whichever file it's given.
- **[.github/workflows/spreadsheet.yml](.github/workflows/spreadsheet.yml)** (rewritten):
  - **When it runs:** Mondays at midnight Hawaiʻi time, plus **Run workflow**.
  - **Each run:** pull → validate → if the CSV changed, notebook → checks → commit with the change list → push to `main`.
  - **Actions:** current versions. It stays enabled, since you already switched it on.
- **Docs:**
  - [data-pipeline/README.md](data-pipeline/README.md) is now the real Git Bash steps instead of Docker.
  - CLAUDE.md and the README describe the sync. The README's "Up next" now leads with Special Notes.

**Claude's checks** (all passed):
- **Byte-identical output:** with today's sheet, `pull_sheet.py` reproduces the committed CSV byte for byte. That makes a week without sheet changes a no-op, with nothing committed.
- **The validator:**
  - **Before the change:** it failed on "Kauai", which proves it catches problems.
  - **Now:** it passes the CSV, fails the uncorrected sheet with 113 problems, and fails a copy with only Maui `P`'s blank cells.
- **`check_data.py`:** today's data passes. It fails four broken copies:
  - a missing county
  - Maui down 30%
  - the true/false flag mistake
  - an unmapped "Public Hearing"
- **End to end, in a scratch clone:**
  - **Setup:** I faked an older sheet, with Maui P-1's 1-family answer changed.
  - **Run:** the steps pulled the real sheet, validated it, detected the change, rebuilt the map, and passed the checks.
  - **Commit:** `github-actions[bot]` committed "Maui P-1, 1-Family Treatment: Allowed/Conditional → Prohibited", one line in each of the 4 data files.
  - **Result:** the rebuilt files matched `main` exactly.
- **The workflow file:** actionlint finds no problems. The old version had 8 retired-action errors.
- **`data-pipeline/README.md`:** every step works exactly as written, in your `~/hza` environment.

**Your checks:**
- [x] After the push, open your repo on GitHub → **Actions** → **Pull and Validate Spreadsheet Data** → **Run workflow**. It finishes green, and the "Check whether the spreadsheet changed" step says "The spreadsheet hasn't changed, so there's nothing to push."
  - Your run on 2026-10-04 passed in 21 seconds. It pulled and validated the sheet, found no changes, and skipped the rebuild and push. That also shows the CSV comes out byte-identical on GitHub's Linux servers.
- [X] Optional, in Git Bash from `data-pipeline/`: `~/hza/Scripts/python pull_sheet.py`. It prints "No changes", and `git status` stays clean.

---

## Feature 6: Finish Clear filters, and outline the selected county (built and committed)

- [x] Plan approved in chat (2026-10-02). You chose cyan for the outline.

**What changed:**
- [index.html](index.html): the ✕ beside "Permitted Residential Uses" is a real `<button>` labeled "Clear filters".
- [scripts/map.js](scripts/map.js):
  - **`clearFilters()`:**
    - **Filters:** it unchecks every housing filter and closes their groups.
    - **County:** it clears the county from the map, the form, and the URL.
    - **Update:** then the usual update runs once.
    - **Left alone:** overlays and opacity stay as they are.
  - **`updateResetButton()`:** the ✕ shows only while a housing filter or a county is active.
  - **`townStyle` and `drawCountyOutlines()`:** the selected county is outlined in 5px cyan and drawn on top, and the other counties get 2px. The outlines have their own pane, just above the House and Senate lines.
- [style.css](style.css): one rule, so the button's `hidden` attribute can actually hide it. Google's Material Icons style would otherwise keep it visible.

**Claude's checks** (headless Edge, old code vs. new; all passed, no errors):

| Check | Old | New |
|---|---|---|
| ✕ on a fresh page | showing, with nothing to clear | hidden |
| Overlays after Clear (transit, House, Senate) | all turned off | still on, transit's note still showing |
| County after Clear | gone from the map, still in the URL | gone from the map, the form, and the URL |
| Reload after Clear | Honolulu comes back | stays cleared |
| County picked, no filters | ✕ showed (only because of House and Senate) | ✕ shows. Clear removes the county |
| Keyboard | Tab can't reach it | Tab reaches it, and Enter and Space both clear. Skipped while hidden |
| Selected outline | 3px yellow, under the district lines | 5px cyan, on top |
| Other outlines | 3px | 2px |
| ✕ look, desktop and phone | 20×20 grey circle | identical size, place, and style |

**Your checks:**
- [X] Open http://localhost:8000 in a new tab. With no filters on, there's no ✕ beside "Permitted Residential Uses".
- [X] Turn on **1-Family Housing** and click Oʻahu. The ✕ appears, and Oʻahu gets a thick cyan outline over the yellow Senate lines.
- [x] Click the ✕. The filters clear, the area panel closes, the cyan outline goes away, and House and Senate stay on.
- [X] Press F5. Oʻahu stays unselected.
- [X] Turn on **2-Family Housing**, press Tab until the ✕ has a focus ring, then press Enter. The filters clear.

---

## Mobile layout (built and committed)

- [x] Plan approved in chat (2026-10-02).

**What changed:**
- [style.css](style.css):
  - **Variables:** `--phoneMapHeight`, `--phoneGap`, and `--zoomButtonsClearance` on `:root`.
  - **A Media queries block** at the bottom, in your comment format. It replaces the rule that hid the sidebar on phones.
    - **Phones (600px and narrower):** the map takes the top 55% of the screen, and the sidebar is a scrolling panel underneath.
    - **The area panel on phones:** it spans the top of the map, clear of the zoom buttons.
    - **Map credits on phones:** smaller.
    - **The tour on phones:** popovers sit across the top of the screen without the arrow, and scroll when they're long.
    - **Tablets and phones held sideways (601–1139px):** the area panel sits beside the sidebar.
    - **Your reduced-motion rule.**
- [scripts/map.js](scripts/map.js): `initMap()` starts phones at zoom 6 instead of 9. A link still opens at its own view.

No HTML changes.

**Claude's checks.** Headless Edge compared the committed `style.css` and `map.js` with the new ones. Everything passed, with no errors.
- **Phone, 375×667:**
  - **Opening view:** zoom 6, with all four counties fully on screen. Before, it was zoom 9 with none of them fully on screen.
  - **Layout:** the map is the top 367px, and the panel is the bottom 300px and scrolls on its own. The page itself doesn't scroll.
  - **County selected:** the area panel spans 8–321px, which keeps it off the zoom buttons.
  - **A link:** `#9/21.3/-157.85/` still opens at zoom 9.
- **Phone, 320×568:** the area panel fits, with no overlaps.
- **The tour on a phone:** all 7 popovers fit on screen, and the long ones scroll.
- **Phone held sideways (667×375) and tablet (768×1024):** the area panel used to overlap the sidebar. Now it sits beside it.
- **Desktop, 1400×900:** the same positions and styles as before, with and without a county selected.
- **Reduced motion:** animations drop to nothing, and zooming still works.

**Your checks.** On your computer, open DevTools (F12) and turn on the device toolbar (Ctrl+Shift+M). After a push, you can also use your phone on the live site.
- [X] In the device toolbar's device list, pick **iPhone SE**. It's a built-in preset, so no actual iPhone is needed, and your own phone on the live site works too. Reload. The map shows every island, and the sidebar is a panel underneath it that scrolls.
- [X] Turn on **1-Family Housing** in the panel, then tap Oʻahu. The area panel appears across the top of the map, and the zoom buttons stay clear.
- [X] In the console, run `localStorage.removeItem('hzaTourSeen')` and reload. Step through the tour. Every popover fits on screen.
- [X] Switch to a tablet, such as iPad Mini, and tap a county. The area panel sits beside the sidebar, not under it.
- [X] Turn off the device toolbar. The desktop layout looks the same as before.

**Left for Feature 12 (mobile drawer):** a button to hide and show the panel. Also, the tour text still says "the menu on the left-hand side". *(Both done in Feature 12.)*

---

## Shared links can turn House and Senate off (built and committed)

- [x] Approved in chat (2026-10-02).

**What changed** (in [scripts/map.js](scripts/map.js)): when a link has filters, `setFilters()` now starts with every box unchecked, then checks only the boxes the link lists. So a link reopens exactly as it was shared. Opening the site without a link still shows House and Senate, your default.

**Claude's checks.** Headless Edge compared the old `map.js` with the new one, using the same `index.html`. Everything passed, with no errors.
- **No link, or a link with only the map view:** House and Senate are on in both versions.
- **A link made by unchecking House:** the old code reopens it with House on. The new code reopens it with House off and Senate on.
- **A link with both off** (`townActive=&opacity=90`): the old code turned both back on. The new code keeps them off.
- **A link from before your default** (1-family filters, no overlays): it reopens with the filters and no overlays, and the URL stays as it was shared.
- **The 7 bad links from Feature 2:** all of them clean up to the URLs your Feature 2 checklist expects again. The live code had been adding `Overlay=house&Overlay=senate` to every one.

**Your checks.** Open each link in a new tab:
- [X] Open http://localhost:8000. House and Senate are on.
- [x] Uncheck **House District**, copy the URL, and open it in a new tab. House stays off and Senate stays on.
- [X] Open http://localhost:8000/#9/20.4/-157.4/townActive=Nowhere. After a few seconds, the URL ends in `/townActive=&opacity=90`, and House and Senate are off.

---

## Feature 7: Fix the broken filters in the data pipeline (built and committed)

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

**Known issue from that edit:** a shared link couldn't turn House or Senate off. This is fixed in "Shared links can turn House and Senate off" above.

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
- [X] Open http://localhost:8000/#15/19.96332/-155.78734 (Waikoloa Village). Hover the purple district in the middle. The tooltip says SINGLE-FAMILY RESIDENTIAL - 10,000 SQUARE FEET and Hawaii, with no "Requires a Minimum Home Size" line.
- [ ] Turn on **1-Family Housing** and click that district. The panel says 2.7% of Hawaii. Now check **No Minimum Unit Size Requirement**. It stays at 2.7%. Before this fix, it dropped to 0.0%.
- [X] Open http://localhost:8000/#16/21.92291/-159.52101 and turn on **1-Family Housing**. The purple district in the middle stays purple. Hover it: RESIDENTIAL (4 UNITS/ACRE)/SPECIAL TREATMENT - PUBLIC. Before this fix, it turned gray. Click it: the panel says 57.0% of Kauai.
- [X] Open http://localhost:8000/#16/20.88754/-156.50056 (downtown Wailuku). The blocks around Main Street are colored, not gray. Hover the middle: COMMERCIAL MIXED USE - WRA, Maui.
- [X] Turn on **Accessory Dwelling Units** and check **Allows Renters**. Districts stay colored. Before this fix, the whole map went gray. Uncheck it and try **Allows Non-Family/Non-Employees**, **Not Restricted to Primary Structure**, and **No Maximum Size Limitation** one at a time.
- [X] With DevTools open (F12, Console tab), reload the page. No red errors.
- [X] Optional, after the commit: run the notebook yourself from `data-pipeline/` (see CLAUDE.md, Notebook). Afterwards, `git status` shows no changes to `final.geojson`, which means your machine produces the same file.

**No longer needed** (decided 2026-10-02): the Google Sheet follow-up. You're leaving the master untouched, and Feature 8's pull script applies these two fixes in code instead:
- Maui `P` (Public Use) row: State `HI`, Jurisdiction `Maui`, County `Maui`.
- Kauaʻi `OD/PD`: change to `OS/PD`.

---

## Data questions from the master spreadsheet

Claude compared `Hawaii Zoning Atlas Master.xlsx` with the CSV the map was built from, and with the GIS files. The spreadsheet itself holds up: for every column that feeds the map, it matches the CSV, apart from rounding that never changes a lot-size bucket.

The odd numbers come from three other places:
1. **A methodology choice** about farm dwellings, recorded in the Hawaiʻi agricultural rows' Special Notes and in the **Discrepancies** tab.
2. **Pipeline mapping bugs**, which are fixable in Feature 7.
3. **District names that differ between the GIS files and the spreadsheet.** Those districts show as "Not Zoned".

One decision for you:

- [x] **Hawaiʻi County agricultural districts** (A-1a … A-8000a): every row says 1-family *Prohibited* but ADU *Allowed*. **Claude checked the code: this is a deliberate choice, not a typo.**
  - **Your decision (2026-10-02):** keep the researchers' coding, and add a feature that shows the spreadsheet's Special Notes in the tooltips. Re-checking against the latest zoning code stays an option for later.
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

- [x] Turn on **House District**. A few labels show at the statewide view. Zoom in on Honolulu and more appear, and they never overlap.
- [x] Click a zone right through a label. The county panel opens.
- [x] Click a few more places on the map. The labels stay. This was the first bug.
- [x] Also turn on **Senate Districts**. Yellow labels join the pink ones without overlapping.
- [x] Turn **House District** off. Its labels disappear, and the Senate labels stay.

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

- [X] Open DevTools → **Network**, then reload. No overlay files (`hydro`, `federal-land`, `state-land`, `dhhl-land`, `rail-transit`, `house-districts`, `senate-districts`) download until you check an overlay.
- [X] Check **Waterways**. "Loading Waterways…" appears under the Overlays heading, then the overlay shows and the message goes away.
- [X] Uncheck and re-check **Waterways**. It comes back right away, with no second download in the Network tab.
- [X] Reload with DevTools → **Network** → throttling set to **Slow 4G**. "Loading zoning data…" shows at the top of the map until the zones appear. Set throttling back to **No throttling** afterwards.
- [X] Optional error check: in the Network tab, right-click `federal-land.min.geojson` and choose **Block request URL**, then check **Federal Lands**. The red error appears and the box unchecks. Unblock it afterwards.

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

- [x] Close the tour, then reload. It doesn't come back.
- [X] To see it again, run `localStorage.removeItem('hzaTourSeen')` in the console and reload.
- [X] Localhost and the live site keep separate storage, so you'll see the tour once on each.

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
- [X] After you push, check https://hawaiizoningatlas.netlify.app the same way.

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
- [X] Open each bad link below **in a new tab**, or paste it and then press F5. For each one, the map loads, the console shows no red errors, and the URL cleans itself up as described.

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
