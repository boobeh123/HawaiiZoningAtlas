var map // Global variable to store the Leaflet map
var towns // GeoJSON layer for town boundaries
var townActive // Selected town name
let districtActive = null // Properties of the clicked district, shown in the area panel

// Phones: the same breakpoint as the Media queries block in style.css
const phoneMediaQuery = '(max-width: 600px)'

// Phones: whether the filters drawer is open (see setDrawerOpen), and whether
// the area card shows everything or only its first lines (see buildAreaCardToggle)
let drawerOpen = false
let areaCardExpanded = false

// Phones and touch-only screens get no district tooltips (see syncZoneTooltips)
const noTooltipsQuery = matchMedia(`${phoneMediaQuery}, (hover: none)`)

// GeoJSON layer with district data. Don't name it `dataLayer`: Google
// Analytics owns window.dataLayer (see scripts/analytics.js).
let zonesLayer
var overlays = {} // An object to contain overlay layer groups, eg `transit`

// Zone fills, also used for the legend's squares. The three zone types pass
// the dataviz palette checks as drawn (90% opacity over the basemap): any
// two stay easy to tell apart, with or without color blindness, and
// nonresidential stays clear of the gray. Re-run those checks before changing
// one (see CLAUDE.md).
const zone2color = {
  R: '#BB22CA', // primarily residential, satisfied
  M: '#4a2b83', // mixed with residential, satisfied
  N: '#aa75b6', // nonresidential, satisfied
  NS: '#d0d0d0', // not satisfied
  NZ: '#DCDCDB',
}

// Columns in the original spreadsheet
var zName = 'Z'
var zTown = 'T'
var zType = 'Ty'
var zAcres = 'MA' // municipal area

/*
 * Creates an element whose content is plain text. Use it instead of HTML
 * strings for anything that comes from the data or the URL, so that text
 * can never be parsed as markup.
 */
const createTextElement = (tagName, text = '', className = '') => {
  const element = document.createElement(tagName)
  element.textContent = text
  if (className) {
    element.className = className
  }
  return element
}

/*
 * Returns a district's yes/no flags as short labels, for its tooltip and the
 * area panel
 */
const getZoneFlags = (properties) =>
  [
    properties['AHD'] === 'Yes' && 'Affordable Housing Only',
    properties['EHD'] === 'Yes' && 'Elderly Housing Only',
    properties['MUS'] === '1' && 'Requires a Minimum Home Size',
  ].filter(Boolean)

/*
 * Shortens a district's Special Notes for its tooltip. Line breaks become
 * spaces, and a long note is cut at the last whole word before the limit.
 */
const shortenNote = (note, limit = 160) => {
  // Each run of spaces and line breaks becomes one space
  const flat = note.replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) {
    return { text: flat, isShortened: false }
  }
  const cut = flat.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return {
    text: `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`,
    isShortened: true,
  }
}

/*
 * Builds a zone's hover tooltip from its GeoJSON properties
 */
const buildZoneTooltip = (properties) => {
  const tooltip = document.createElement('div')
  const zoneName = properties[zName]

  if (!zoneName || zoneName === 'Not Zoned' || zoneName === 'NULL') {
    // append() inserts strings as text nodes, never as HTML
    tooltip.append(
      createTextElement('strong', 'Not Zoned'),
      document.createElement('br'),
      properties[zTown] ?? ''
    )
    return tooltip
  }

  const notes = getZoneFlags(properties)

  tooltip.append(
    createTextElement('h6', zoneName, 't-t ttu'),
    createTextElement('strong', properties[zTown], 'black-50'),
    document.createElement('br'),
    ...notes.flatMap((note) => [note, document.createElement('br')])
  )

  if (properties['TN']) {
    tooltip.append(
      createTextElement('strong', 'Note:'),
      ` ${properties['TN']}`
    )
  }

  // The start of the Special Notes. The full note shows in the area panel.
  if (properties['SN']) {
    const preview = shortenNote(properties['SN'])
    tooltip.append(createTextElement('strong', 'Note:'), ` ${preview.text}`)
    if (preview.isShortened) {
      tooltip.append(
        document.createElement('br'),
        createTextElement('span', 'Click the district for the full note', 'black-50')
      )
    }
  }

  return tooltip
}

/*
 * Gives each district a hover tooltip, except on phones and touch-only
 * screens. There a tooltip covers much of the small map, and tapping a
 * district shows the same details in the area panel instead.
 */
const syncZoneTooltips = () => {
  zonesLayer.eachLayer((layer) => {
    if (noTooltipsQuery.matches) {
      layer.unbindTooltip()
    } else if (!layer.getTooltip()) {
      // Passing a function means it's built from plain text each time it
      // opens, so Leaflet never parses data as HTML
      layer.bindTooltip(() => buildZoneTooltip(layer.feature.properties), {
        sticky: true,
      })
    }
  })
}

/*
 * Brings a newly selected county into view. A click only ever zooms in: from
 * a wider view the map fits the county, and from closer in it stays where it
 * is. Fitting the whole county would zoom far out from wherever you clicked.
 */
const showCounty = (bounds) => {
  if (map.getBoundsZoom(bounds) <= map.getZoom()) {
    return
  }
  map.fitBounds(bounds)
}

var style = function (filters, feature) {
  var opacity = $('input[name="opacity"]').val() / 100

  let fillColor = satisfiesFilters(filters, feature)
    ? zone2color[feature.properties[zType]]
    : zone2color['NS']

  // If the feature is "Not Zoned" the properties[zType] will be null
  // This fixes the null areas being blue by default
  if (feature.properties[zType] === null) {
    fillColor = zone2color['NZ']
  }
  return {
    fillOpacity: opacity,
    fillColor: fillColor,
    weight: 0,
  }
}

/*
 * Returns the filter part of the URL hash (everything after #zoom/lat/lng/).
 * URLSearchParams decodes it once and never throws on a malformed link.
 */
const getUrlFilterParams = () =>
  new URLSearchParams(location.hash.split('/').slice(3).join('/'))

/*
 * Returns the sidebar form's current state in the same format jQuery's
 * serialize() produced, so links shared before this change keep working
 */
const getFormParams = () =>
  new URLSearchParams(new FormData(document.querySelector('#form')))

const updateUrl = () => {
  const mapLocationHash = location.hash.split('/').slice(0, 3).join('/')
  // Update URL
  location.replace(`${mapLocationHash}/${getFormParams()}`)
}

/**
 * Loads the main GeoJSON data file
 */
var loadZones = function (geojson) {
  // A county from the URL only counts if it has zoning data. Kalawao, for
  // example, has a county outline but no zones.
  const zoneTowns = new Set(
    geojson.features.map((feature) => feature.properties[zTown])
  )
  if (townActive && !zoneTowns.has(townActive)) {
    townActive = ''
    document.querySelector('#form input[name="townActive"]').value = ''
    if (towns) {
      drawCountyOutlines()
    }
    updateResetButton()
  }

  var filters = getFilters()

  zonesLayer = L.geoJSON(geojson, {
    attribution:
      'data by <a href="https://www.CodeWithAloha.org/">Kind Volunteers @ Code with Aloha</a>,\
      map development by <a href="https://CodeWithAloha.org">Code with Aloha</a>',
    style: function (feature) {
      return style(filters, feature)
    },
    onEachFeature: function (feature, layer) {
      var pp = feature.properties

      // On click, select the district and its county, and show the district
      // in the area panel. Clicking the selected district again clears both.
      layer.on('click', function () {
        const previousTown = townActive
        if (districtActive === pp) {
          townActive = ''
          districtActive = null
        } else {
          townActive = pp[zTown]
          districtActive = pp
        }

        // Select a town which contains the clicked district
        $('input[name="townActive"]').val(townActive)

        // Draw active boundary
        drawCountyOutlines()
        updateResetButton()

        // Recalculate area. The new district shows from the top of the card.
        calculateActiveArea()
        document.querySelector('#activeAreaCalculator').scrollTop = 0

        // Only a newly selected county moves the map. Switching districts
        // within it keeps the view, so you can read note after note.
        if (townActive && townActive !== previousTown) {
          towns.eachLayer(function (l) {
            if (l.feature.properties.name20 === townActive) {
              showCounty(l.getBounds())
              setTimeout(updateUrl, 500)
            }
          })
        } else {
          updateUrl()
        }
      })
    },
  }).addTo(map)

  // Hover tooltips, except on phones and touch-only screens
  syncZoneTooltips()
  noTooltipsQuery.addEventListener('change', syncZoneTooltips)

  // Show the overlays that were checked in the link. Their files download now.
  syncOverlays()

  var form = document.getElementById('form')

  form.addEventListener('change', function () {
    updateUrl()

    var filters = getFilters()
    zonesLayer.setStyle(function (feature) {
      return style(filters, feature)
    })

    // Make sure groups of checkboxes where at least one is expected to be checked
    // turns red if none are checked (and vice-versa)
    $('.at-least-one-checked:has( input:checked )').removeClass('bg-light-red')
    $('.at-least-one-checked:not(:has( input:checked ))').addClass(
      'bg-light-red'
    )

    calculateActiveArea()

    // Downloads an overlay's file the first time it's turned on
    syncOverlays()

    updateResetButton()
    updateDrawerFilterCount()
  })

  document.querySelector('#resetFilters').addEventListener('click', clearFilters)

  // When main checkbox in filters group is clicked, open up subgroup
  $('.main-in-group').change(function () {
    var subgroup = $(this).parent().siblings('.subgroup').first()
    if (this.checked) {
      subgroup.removeClass('dn')
      subgroup.find('input.checked-by-default').prop('checked', true)
    } else {
      subgroup.find('input[type="checkbox"]').prop('checked', false)
      subgroup.addClass('dn')
    }
  })

  calculateActiveArea()

  // If the link carried filters, rewrite it from what was actually restored,
  // so values that matched nothing drop out of the URL
  if (getUrlFilterParams().toString()) {
    updateUrl()
  }
}

/*
 * On page load, sets filters from the URL. Only values that match a real
 * input are used, and URL text is only ever compared, never turned into a
 * selector.
 */
const setFilters = () => {
  const form = document.querySelector('#form')
  const checkboxes = [...form.querySelectorAll('input[type="checkbox"]')]
  const opacityInput = form.querySelector('input[name="opacity"]')
  const params = getUrlFilterParams()

  // Checked against the zoning data once it loads (see loadZones)
  const townFromUrl = params.get('townActive')
  if (townFromUrl) {
    townActive = townFromUrl
    form.querySelector('input[name="townActive"]').value = townFromUrl
  }

  // Only a whole number within the slider's range replaces the default
  const opacityFromUrl = Number(params.get('opacity'))
  if (
    Number.isInteger(opacityFromUrl) &&
    opacityFromUrl >= Number(opacityInput.min) &&
    opacityFromUrl <= Number(opacityInput.max)
  ) {
    opacityInput.value = String(opacityFromUrl)
  }

  // A link with filters describes the whole form, so start from every box
  // unchecked. Otherwise a box that starts checked, like House or Senate,
  // could never be turned off by a link
  if (params.toString()) {
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false
    })
  }

  // Check each box whose name and value both match a pair in the URL
  params.forEach((value, name) => {
    const checkbox = checkboxes.find(
      (input) => input.name === name && input.value === value
    )
    if (checkbox) {
      checkbox.checked = true
    }
  })

  $('input.main-in-group:checked')
    .parents()
    .siblings('.subgroup')
    .removeClass('dn')
  $('.at-least-one-checked:has( input:checked )').removeClass('bg-light-red')
  $('.at-least-one-checked:not(:has( input:checked ))').addClass('bg-light-red')

  updateResetButton()
  updateDrawerFilterCount()
}

/*
 * Constructs and returns a `filters` object based on the form in the sidebar
 */
var getFilters = function () {
  var filters = {}

  var checkboxes = document.querySelectorAll('input[type="checkbox"]:checked')
  for (var i = 0; i < checkboxes.length; i++) {
    var name = checkboxes[i].name
    var value = checkboxes[i].value

    if (!name || !value) continue

    if (!filters[name]) {
      filters[name] = []
    }
    filters[name].push(value)
  }

  return filters
}

/*
 * Given a `filters` object, returns true if all residential property
 * checkboxes are satisfied by the `feature` (zone), `false` otherwise.
 */
var satisfiesFilters = function (filters, feature) {
  for (var name in filters) {
    if (name === 'Overlay') continue

    if (filters[name].indexOf(feature.properties[name]) < 0) {
      return false
    }
  }
  return true
}

/*
 * Adds zone type box colors to the legend
 */
var addColorPolygonsToLegend = function () {
  $('#legend .square').each(function () {
    $(this).css('background-color', zone2color[$(this).attr('title')])
  })
}

/*
 * Styles the county outlines: thick cyan around the selected county, thin
 * semi-transparent white around the others. No other layer uses cyan, so the
 * selection stands out from the pink House and yellow Senate lines.
 */
const townStyle = (feature) => {
  const isSelected = feature.properties.name20 === townActive
  return {
    weight: isSelected ? 5 : 2,
    color: isSelected ? '#00e5ff' : 'white',
    opacity: isSelected ? 1 : 0.4,
    fillOpacity: 0,
    fillColor: 'rgba(0,0,0,0)',
  }
}

/*
 * Given towns GeoJSON file in `bounds`, adds non-interactivve town boundaries
 * layer to the map
 */
var loadTowns = function (bounds) {
  towns = L.geoJSON(bounds, {
    // Its own pane, above the House and Senate lines (see initMap)
    pane: 'countyOutlines',
    interactive: false,
    style: townStyle,
  })

  towns.addTo(map)
}

/*
 * Restyles the county outlines after the selection changes. The selected
 * outline goes on top, so a neighbor's outline can't cover it: Kalawao shares
 * a border with Maui County on Molokai.
 */
const drawCountyOutlines = () => {
  towns.setStyle(townStyle)
  towns
    .getLayers()
    .find((layer) => layer.feature.properties.name20 === townActive)
    ?.bringToFront()
}

/*
 * Counts the housing filter groups that are on. Overlay checkboxes don't
 * count, because they aren't filters.
 */
const countHousingFilters = () =>
  [...document.querySelectorAll('#form .main-in-group:checked')].filter(
    (checkbox) => checkbox.name !== 'Overlay'
  ).length

/*
 * Shows the Clear filters button while a housing filter is on or a county is
 * selected
 */
const updateResetButton = () => {
  document.querySelector('#resetFilters').hidden =
    countHousingFilters() === 0 && !townActive
}

/*
 * Phones: says on the drawer's bar how many housing filters are on, so they
 * aren't forgotten while the drawer is closed
 */
const updateDrawerFilterCount = () => {
  const count = countHousingFilters()
  document.querySelector('#drawerFilterCount').textContent =
    count === 0 ? '' : `${count} ${count === 1 ? 'filter' : 'filters'} on`
}

/*
 * Phones: opens or closes the filters drawer. While it's closed, its
 * contents are inert, so the keyboard and screen readers skip them. Wider
 * screens always show the whole sidebar, so nothing is inert there.
 * `animate: false` skips the height transition, for the tour's changes.
 */
const setDrawerOpen = (open, { animate = true } = {}) => {
  const sidebar = document.querySelector('#sidebar')
  const toggle = document.querySelector('#drawerToggle')
  const isPhone = matchMedia(phoneMediaQuery).matches
  drawerOpen = open

  if (!animate) {
    sidebar.classList.add('drawerNoTransition')
  }
  sidebar.classList.toggle('drawerOpen', open)
  toggle.setAttribute('aria-expanded', String(open))
  toggle.querySelector('.material-icons').textContent = open
    ? 'expand_more'
    : 'expand_less'
  document.querySelector('#HiZoningAtlas').inert = isPhone && !open

  // Open, the drawer covers the map's bottom corners (the Map/Satellite
  // switch and the credits), so keyboard focus skips them too
  document.querySelectorAll('.leaflet-bottom').forEach((corner) => {
    corner.inert = isPhone && open
  })
  // Open, the status line inside speaks for itself. Closing doesn't copy it
  // back, so an old message isn't announced again.
  if (open) {
    document.querySelector('#overlayStatusAnnounce').textContent = ''
  }

  if (!animate) {
    // Reading the height applies it before the transition comes back
    void sidebar.offsetHeight
    sidebar.classList.remove('drawerNoTransition')
  }
}

/*
 * Clears every housing filter and the selected county. Overlays and the
 * opacity slider aren't filters, so they stay as they are.
 */
const clearFilters = () => {
  const form = document.querySelector('#form')

  form.querySelectorAll('.filter-group').forEach((group) => {
    const mainCheckbox = group.querySelector('.main-in-group')
    if (!mainCheckbox || mainCheckbox.name === 'Overlay') return

    group.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = false
    })
    group.querySelector('.subgroup')?.classList.add('dn')
  })

  // Clear the county everywhere: the map, the form, and so the URL too
  townActive = ''
  districtActive = null
  form.querySelector('input[name="townActive"]').value = ''
  drawCountyOutlines()

  // One change event runs the usual update: it restyles the zones, rewrites
  // the URL, hides the area panel, and hides this button
  form.dispatchEvent(new Event('change'))
}

/*
 * Builds the area panel's block for the clicked district: its name, its
 * flags, and its full Special Notes, all as text. On phones and touch-only
 * screens this stands in for the tooltip.
 */
const buildDistrictDetails = (properties) => {
  const details = createTextElement('div', '', 'districtDetails')
  const zoneName = properties[zName]
  const isZoned = zoneName && zoneName !== 'Not Zoned' && zoneName !== 'NULL'
  details.append(
    createTextElement('p', isZoned ? zoneName : 'Not Zoned', 'districtName')
  )

  const flags = getZoneFlags(properties)
  if (flags.length) {
    details.append(createTextElement('p', flags.join(' · '), 'districtFlags'))
  }

  details.append(
    properties['SN']
      ? createTextElement('p', properties['SN'], 'districtNote')
      : createTextElement('p', 'No notes for this district.', 'districtNote black-50')
  )
  return details
}

/*
 * Phones: the area card's header, with the county's percentage. It expands
 * the card from its first lines to everything, and back (see style.css).
 * It toggles in place, so focus stays on it.
 */
const buildAreaCardToggle = (satisfiesPerc) => {
  const toggle = createTextElement('button', '', 'areaCardToggle')
  toggle.type = 'button'
  const icon = createTextElement('span', '', 'material-icons')
  icon.setAttribute('aria-hidden', 'true')

  const showExpanded = () => {
    toggle.setAttribute('aria-expanded', String(areaCardExpanded))
    icon.textContent = areaCardExpanded ? 'expand_less' : 'expand_more'
    document
      .querySelector('#activeAreaCalculator')
      .classList.toggle('areaExpanded', areaCardExpanded)
  }

  toggle.append(
    // townActive can come from the URL, so it's set as text
    createTextElement('span', `${satisfiesPerc}% of ${townActive}`),
    // Tachyons' clip hides it on screen. Screen readers hear what the
    // percentage means, which the collapsed card doesn't show.
    createTextElement('span', ' satisfies your filters', 'clip'),
    icon
  )
  toggle.addEventListener('click', () => {
    areaCardExpanded = !areaCardExpanded
    showExpanded()
  })
  showExpanded()
  return toggle
}

/*
 * Builds the row of county stats shown under the area calculation
 */
const buildDemographicStats = (townDemographics) => {
  const stats = [
    {
      icon: 'payments',
      value: `$${townDemographics.income.toLocaleString()}`,
      label: 'HH Income',
      title: 'Median Household Income',
      className: 'black-50 dib w-third fl tl',
    },
    {
      icon: 'people_alt',
      value: `${townDemographics.nativeHawaiian}%`,
      label: 'Native Hawaiian',
      // demographicsSource comes from data/demographics.js, e.g. "2020–2024 ACS 5-year estimates"
      title: `Residents who identify as Native Hawaiian (${demographicsSource})`,
      className: 'black-50 dib w-third fl tc',
    },
    {
      icon: 'toll',
      value: `${townDemographics.burdened}%`,
      label: 'Cost-Burdened',
      title: 'Cost-Burdened Households',
      className: 'black-50 dib fl ml2 tr',
    },
  ]

  const row = createTextElement('div', '', 'areaStats')
  row.append(
    ...stats.map((stat) => {
      const item = createTextElement('span', '', stat.className)
      item.title = stat.title
      item.append(
        createTextElement('span', stat.icon, 'material-icons v-top statIcon'),
        ` ${stat.value}`,
        document.createElement('br'),
        stat.label
      )
      return item
    })
  )
  return row
}

/*
 * Calculates what % of a selected town satisfies filtering criteria,
 * and updates the message in the sidebar. Everything is set as text,
 * because `townActive` can come from the URL.
 */
const calculateActiveArea = () => {
  const calculator = document.querySelector('#activeAreaCalculator')
  const filters = getFilters()
  const sumAcres = (features) =>
    features.reduce(
      (sum, feature) => sum + (feature.properties[zAcres] || 0),
      0
    )

  const townZones = townActive
    ? zonesLayer
        .getLayers()
        .map((layer) => layer.feature)
        .filter((feature) => feature.properties[zTown] === townActive)
    : []
  const totalAcres = sumAcres(townZones)
  const satisfiesAcres = sumAcres(
    townZones.filter((feature) => satisfiesFilters(filters, feature))
  )

  // Hide the panel when no town is selected, or when the town has no zoned
  // land (for example, an unknown town name in the URL)
  if (totalAcres === 0) {
    calculator.replaceChildren()
    calculator.classList.add('dn')
    // On phones, after the card closes, the next district starts short again
    areaCardExpanded = false
    return
  }

  const satisfiesPerc = ((satisfiesAcres / totalAcres) * 100).toFixed(1)

  const municipalArea = createTextElement(
    'span',
    'zoned municipal area',
    'bb-dotted'
  )
  municipalArea.title =
    'Excludes state- and federal-owned land, and unzoned parts of town'

  const summary = createTextElement('p', '', 'ma0 mb2 areaSummary')
  summary.append(
    `${Math.trunc(satisfiesAcres).toLocaleString()} acres, or ${satisfiesPerc}% of `,
    municipalArea,
    ' in ',
    createTextElement('strong', townActive),
    ` (${Math.trunc(totalAcres).toLocaleString()} acres) satisfies your filtering criteria.`
  )
  // The header only shows on phones
  calculator.replaceChildren(buildAreaCardToggle(satisfiesPerc), summary)

  // Stats exist only for the counties listed in data/demographics.js
  if (Object.hasOwn(demographics, townActive)) {
    calculator.append(buildDemographicStats(demographics[townActive]))
  }

  // The clicked district, when it's in the selected county
  if (districtActive && districtActive[zTown] === townActive) {
    calculator.append(buildDistrictDetails(districtActive))
  }

  calculator.classList.remove('dn')
}

/*
 * Fetches a GeoJSON file and returns the parsed data. Throws if the request
 * fails, so the caller can show an error message.
 */
const fetchGeoJson = async (path) => {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`)
  }
  return response.json()
}

/*
 * Returns a layer group of the rail stations, a half-mile circle around each
 * one, and the rail line
 */
const loadTransit = async () => {
  const [stations, railLine] = await Promise.all([
    fetchGeoJson('/data/rail-transit.geojson'),
    fetchGeoJson('/data/rail-transit-line.geojson'),
  ])

  const transitMarkers = stations.features.map(function (o) {
    return L.marker(o.geometry.coordinates.reverse()).bindPopup(
      document.createTextNode(o.properties.STATION)
    )
  })

  const transitCircles = stations.features.map(function (o) {
    return L.circle(o.geometry.coordinates, {
      radius: 804.5, // half a mile, in meters
      weight: 1,
      color: 'pink',
      fillColor: 'pink',
      opacity: 0.9,
      fillOpacity: 0.8,
      interactive: false,
    })
  })

  // The following was written by Mike A.
  const transitLines = railLine.features.map(function (o) {
    return o.geometry.coordinates.map((oo) => {
      oo = oo.map((e) => e.reverse())
      return L.polyline(oo, {
        weight: 1,
        color: 'pink',
        opacity: 0.9,
        interactive: false,
      })
    })
  })

  return L.layerGroup(
    transitMarkers.concat(transitCircles).concat(transitLines.flat())
  )
}

//* returns a layer of hydrology features
const loadHydro = async () => {
  const geojson = await fetchGeoJson('/data/hydro.min.geojson')
  const stripes = new L.StripePattern({
    height: 2,
    width: 2,
    weight: 1,
    spaceWeight: 1,
    angle: -45,
    color: '#C6DDFF',
    spaceColor: '#9cb4dc',
    opacity: 0.5,
    spaceOpacity: 0.5,
  })
  stripes.addTo(map)

  return L.geoJSON(geojson, {
    interactive: false,
    stroke: true,
    color: '#C6DDFF',
    weight: 0.5,
    pane: 'overlays',
    style: {
      fillOpacity: 1,
      fillPattern: stripes,
    },
  })
}

/*
 * Area and centroid of a ring of [lng, lat] points. Flat math is accurate
 * enough at the size of a district.
 */
const getRingCentroid = (ring) => {
  let twiceArea = 0
  let x = 0
  let y = 0
  ring.forEach(([x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length]
    const cross = x1 * y2 - x2 * y1
    twiceArea += cross
    x += (x1 + x2) * cross
    y += (y1 + y2) * cross
  })
  return {
    area: Math.abs(twiceArea) / 2,
    point: [x / (3 * twiceArea), y / (3 * twiceArea)],
  }
}

// Whether [x, y] is inside the ring: a ray from the point crosses its edges
// an odd number of times
const isInsideRing = ([x, y], ring) =>
  ring.reduce((inside, [x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length]
    const crosses =
      y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1
    return crosses ? !inside : inside
  }, false)

/*
 * The middle of the widest stretch of the ring along the line at latitude y.
 * Used when a shape is so curved that its centroid falls outside it.
 */
const getWidestMidpoint = (ring, y) => {
  const crossings = ring
    .map(([x1, y1], i) => {
      const [x2, y2] = ring[(i + 1) % ring.length]
      return y1 > y !== y2 > y ? x1 + ((y - y1) * (x2 - x1)) / (y2 - y1) : null
    })
    .filter((x) => x !== null)
    .sort((a, b) => a - b)
  // Crossings pair up into stretches that are inside the shape
  const stretches = crossings
    .filter((_, i) => i % 2 === 0)
    .map((start, i) => [start, crossings[i * 2 + 1]])
  const [start, end] = stretches.reduce((widest, stretch) =>
    stretch[1] - stretch[0] > widest[1] - widest[0] ? stretch : widest
  )
  return (start + end) / 2
}

/*
 * Where a district's label goes: the centroid of its largest piece, or the
 * widest-stretch fallback when the centroid falls outside that piece. Also
 * returns that piece's bounds, used to decide whether the label has room.
 */
const getLabelPlacement = (geometry) => {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  // Outer rings only: none of the district shapes have holes
  const pieces = polygons.map((polygon) => ({
    ring: polygon[0],
    ...getRingCentroid(polygon[0]),
  }))
  const largest = pieces.reduce((best, piece) =>
    piece.area > best.area ? piece : best
  )
  const [x, y] = largest.point
  const lng = isInsideRing([x, y], largest.ring)
    ? x
    : getWidestMidpoint(largest.ring, y)
  return {
    latLng: L.latLng(y, lng),
    bounds: L.latLngBounds(largest.ring.map(([ringLng, ringLat]) => [ringLat, ringLng])),
    area: largest.area,
  }
}

// Every district label that's been created, largest district first
const districtLabels = []

// Whether two screen rectangles overlap, counting a small gap as overlap
const rectsOverlap = (a, b, gap = 2) =>
  a.left < b.right + gap &&
  b.left < a.right + gap &&
  a.top < b.bottom + gap &&
  b.top < a.bottom + gap

/*
 * Shows each label only where it has room: its district must be wider and
 * taller on screen than the label, and the label can't overlap one that's
 * already shown. Larger districts go first. Runs after every zoom, and
 * whenever a district overlay is turned on or off.
 */
const updateDistrictLabels = () => {
  const placed = []
  districtLabels
    .filter(({ tooltip }) => map.hasLayer(tooltip))
    // Measure every label before changing any. Hidden labels keep their size
    // (visibility: hidden), so they can be measured where they stand.
    .map((label) => ({
      ...label,
      rect: label.tooltip.getElement().getBoundingClientRect(),
    }))
    .forEach(({ tooltip, bounds, rect }) => {
      const northWest = map.latLngToContainerPoint(bounds.getNorthWest())
      const southEast = map.latLngToContainerPoint(bounds.getSouthEast())
      const hasRoom =
        southEast.x - northWest.x >= rect.width &&
        southEast.y - northWest.y >= rect.height
      const show =
        hasRoom && !placed.some((other) => rectsOverlap(rect, other))
      if (show) {
        placed.push(rect)
      }
      tooltip.getElement().classList.toggle('districtLabelHidden', !show)
    })
}

/*
 * Returns a layer group with the district lines and a label for each
 * district. Labels are Leaflet tooltips, which ignore the mouse, so clicks
 * still reach the zones underneath.
 */
const buildDistrictOverlay = (lines, getLabelText, className) => {
  const labels = lines.getLayers().map((district) => {
    const placement = getLabelPlacement(district.feature.geometry)
    const tooltip = L.tooltip({
      // Without permanent, Leaflet closes the label on the next map click in
      // any browser with touch or pointer events (all modern ones)
      permanent: true,
      direction: 'center',
      opacity: 1,
      className: `districtLabel ${className}`,
    })
      .setLatLng(placement.latLng)
      .setContent(
        createTextElement('span', getLabelText(district.feature.properties))
      )
    return { tooltip, bounds: placement.bounds, area: placement.area }
  })
  districtLabels.push(...labels)
  districtLabels.sort((a, b) => b.area - a.area)

  const overlay = L.layerGroup([lines, ...labels.map(({ tooltip }) => tooltip)])
  overlay.on('add remove', updateDistrictLabels)
  return overlay
}

/*
 * Returns the House district lines with a "House 23"-style label on each
 */
const loadHouse = async () => {
  const geojson = await fetchGeoJson('/data/house-districts.min.geojson')
  const lines = L.geoJSON(geojson, {
    interactive: false,
    stroke: true,
    color: '#E06AAA',
    weight: 1,
    pane: 'overlays',
    style: {
      fillOpacity: 0,
    },
  })
  return buildDistrictOverlay(
    lines,
    (properties) => `House ${properties.house_id}`,
    'houseLabel'
  )
}

/*
 * Returns the Senate district lines with a "Senate 12"-style label on each
 */
const loadSenate = async () => {
  const geojson = await fetchGeoJson('/data/senate-districts.min.geojson')
  const lines = L.geoJSON(geojson, {
    interactive: false,
    stroke: true,
    color: '#F8F807',
    weight: 1,
    pane: 'overlays',
    style: {
      fillOpacity: 0,
    },
  })
  return buildDistrictOverlay(
    lines,
    (properties) => `Senate ${properties.senate_id}`,
    'senateLabel'
  )
}

// todo: add sewerlines overlay (oahu is done - need to do neighbor islands)
var loadSewer = function () {
  $.getJSON('/data/sewer.min.geojson', function (geojson) {
    var stripes = new L.StripePattern({
      height: 2,
      width: 2,
      weight: 1,
      spaceWeight: 1,
      angle: 45,
      color: '#e8f99d',
    })
    stripes.addTo(map)

    overlays['sewer'] = L.geoJSON(geojson, {
      interactive: false,
      stroke: false,
      pane: 'overlays',
      style: {
        fillOpacity: 1,
        fillPattern: stripes,
      },
    })
  })
}

//* returns the federal land overlay
const loadFederal = async () => {
  const geojson = await fetchGeoJson('/data/federal-land.min.geojson')
  const stripes = new L.StripePattern({
    height: 2,
    width: 2,
    weight: 1,
    spaceWeight: 1,
    angle: 30,
    color: '#B47A69',
  })

  stripes.addTo(map)

  return L.geoJSON(geojson, {
    interactive: false,
    stroke: false,
    pane: 'overlays',
    style: {
      fillOpacity: 1,
      fillPattern: stripes,
    },
  })
}

//* returns the state land overlay
const loadState = async () => {
  const geojson = await fetchGeoJson('/data/state-land.min.geojson')
  const stripes = new L.StripePattern({
    height: 2,
    width: 2,
    weight: 1,
    spaceWeight: 1,
    angle: 30,
    color: '#FF9C59',
  })

  stripes.addTo(map)

  return L.geoJSON(geojson, {
    interactive: false,
    stroke: false,
    pane: 'overlays',
    style: {
      fillOpacity: 1,
      fillPattern: stripes,
    },
  })
}

//* creates a layer for the county of Kaua'i, which at this time we do not have zoning GIS data for
//* will be removed once zoning shapefiles are available


const loadDHHL = async () => {
  const geojson = await fetchGeoJson('/data/dhhl-land.geojson')
  const stripes = new L.StripePattern({
    height: 2,
    width: 2,
    weight: 1.5,
    spaceWeight: 1,
    angle: -45,
    color: '#FAAE7BC2',
    spaceColor: '#9cb4dc',
    opacity: 0.9,
    spaceOpacity: 0.5,
  })
  stripes.addTo(map)

  return L.geoJSON(geojson, {
    interactive: true,
    stroke: true,
    color: 'rgb(147, 94, 59)',
    weight: 0.5,
    pane: 'overlays',
    style: {
      fillOpacity: 0.9,
      fillPattern: stripes,
    },
  }).bindTooltip(
    ' Lands owned by the State of Hawaii Department of Hawaiian Homelands as of October, 2022'
  )
}

// Each overlay checkbox's value, mapped to the function that builds its layer.
// Nothing downloads until an overlay is turned on for the first time.
const overlayLoaders = {
  hydro: loadHydro,
  federal: loadFederal,
  state: loadState,
  DHHL: loadDHHL,
  transit: loadTransit,
  house: loadHouse,
  senate: loadSenate,
}

// Downloads in progress, by overlay name. Turning an overlay on again while its
// file is still downloading reuses the same download.
const overlayDownloads = {}
const loadingOverlays = new Set()
let overlayError = ''

const getOverlayCheckbox = (name) =>
  [...document.querySelectorAll('input[name="Overlay"]')].find(
    (input) => input.value === name
  )

// The checkbox's label text, e.g. "Waterways"
const getOverlayLabel = (name) =>
  getOverlayCheckbox(name).parentElement.textContent.trim()

/*
 * Shows what's loading, or the last error, in the status line under the
 * Overlays heading. It's a live region, so screen readers announce it.
 */
const renderOverlayStatus = () => {
  const status = document.querySelector('#overlayStatus')
  const loading = [...loadingOverlays].map(getOverlayLabel)
  status.textContent =
    overlayError || (loading.length > 0 ? `Loading ${loading.join(', ')}…` : '')
  status.classList.toggle('statusError', Boolean(overlayError))
  syncOverlayAnnouncement()
}

/*
 * Phones: a closed drawer's contents are inert, which hides the status line
 * from screen readers too. A hidden copy outside the drawer speaks for it
 * until the drawer opens.
 */
const syncOverlayAnnouncement = () => {
  const isStatusHidden = document.querySelector('#HiZoningAtlas').inert
  document.querySelector('#overlayStatusAnnounce').textContent = isStatusHidden
    ? document.querySelector('#overlayStatus').textContent
    : ''
}

/*
 * Shows an overlay, downloading its file the first time. If the box gets
 * unchecked while the file downloads, the layer stays off.
 */
const showOverlay = async (name) => {
  const checkbox = getOverlayCheckbox(name)
  if (!overlays[name]) {
    loadingOverlays.add(name)
    renderOverlayStatus()
    try {
      overlayDownloads[name] = overlayDownloads[name] || overlayLoaders[name]()
      overlays[name] = await overlayDownloads[name]
    } catch (error) {
      console.error(error)
      // Forget the failed download, so checking the box again retries it
      delete overlayDownloads[name]
      loadingOverlays.delete(name)
      checkbox.checked = false
      // Let the rest of the page react as if the box had been unchecked by hand
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      overlayError = `Couldn't load ${getOverlayLabel(name)}. Check your connection and try again.`
      renderOverlayStatus()
      return
    }
    loadingOverlays.delete(name)
    renderOverlayStatus()
  }
  if (checkbox.checked && !map.hasLayer(overlays[name])) {
    overlays[name].addTo(map)
  }
}

const hideOverlay = (name) => {
  // An unchecked overlay that's still downloading no longer counts as loading
  loadingOverlays.delete(name)
  if (overlays[name] && map.hasLayer(overlays[name])) {
    map.removeLayer(overlays[name])
  }
}

/*
 * Shows every checked overlay and hides the rest. Each overlay loads on its
 * own, so nothing here waits for a download to finish.
 */
const syncOverlays = () => {
  overlayError = ''
  document.querySelectorAll('input[name="Overlay"]').forEach((checkbox) => {
    if (checkbox.checked) {
      showOverlay(checkbox.value)
    } else {
      hideOverlay(checkbox.value)
    }
  })
  renderOverlayStatus()
}

/*
 * Downloads the county outlines and the zoning districts. The message at the
 * top of the map says the zones are loading, or that the download failed.
 */
const loadMapData = async () => {
  const status = document.querySelector('#mapStatus')
  try {
    const [counties, zones] = await Promise.all([
      fetchGeoJson('/data/counties.geojson'),
      fetchGeoJson('/data/final.geojson'),
    ])
    loadTowns(counties)
    loadZones(zones)
    status.textContent = ''
  } catch (error) {
    console.error(error)
    status.textContent =
      "Couldn't load the zoning data. Check your connection and reload the page."
    status.classList.add('statusError')
  }
}

// localStorage flag that stops the intro tour from showing again once this
// browser has closed or finished it. Clearing the site's data brings it back.
const tourSeenKey = 'hzaTourSeen'

const hasSeenTour = () => {
  try {
    return localStorage.getItem(tourSeenKey) === 'true'
  } catch {
    // Storage can be blocked (for example, in some private windows), so show the tour
    return false
  }
}

const rememberTourSeen = () => {
  try {
    localStorage.setItem(tourSeenKey, 'true')
  } catch {
    // Storage is blocked, so the tour will simply show again next time
  }
}

/**
 * This function initializes the map. It should be called as soon as
 * DOM is loaded.
 */
var initMap = function () {
  // Zoom 9 fits the whole state on a desktop screen, but on a phone it shows
  // only the ocean between the islands. A link's own view still replaces
  // this (see L.Hash below).
  const startZoom = matchMedia(phoneMediaQuery).matches ? 6 : 9

  map = L.map('map', {
    zoomControl: false,
    tap: false,
    maxZoom: 15,
  }).setView([20.4162, -157.4015], startZoom)

  L.control.zoom({ position: 'topright' }).addTo(map)

  // District labels show or hide depending on how much room they have
  map.on('zoomend', updateDistrictLabels)

  // CARTO basemap keys. They're public by design (they ride along on every
  // tile request), so they live here instead of .env. Each one is limited to
  // its own domains in the CARTO basemaps dashboard.
  const isLocalSite = ['localhost', '127.0.0.1'].includes(location.hostname)
  const cartoApiKey = isLocalSite
    ? 'cb1_476c_1_eebd1434484fdc3d41171c3b' // localhost key
    : 'cb1_476c_2_45dc132f92b3462bb9372f5e' // production key

  // CartoDB Positron baselayer, no labels
  var cartoTiles = L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`,
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  ).addTo(map)

  var esriTiles = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    }
  )

  // Add base layer switch
  L.control
    .layers(
      {
        Map: cartoTiles,
        Satellite: esriTiles,
      },
      {},
      {
        position: 'bottomright',
        collapsed: false,
      }
    )
    .addTo(map)

  // CartoDB Positron labels only, drawn above the zones
  L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`,
    {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19,
      pane: 'shadowPane',
    }
  ).addTo(map)

  // Phones: the filters drawer starts closed (its bar is wired up with the
  // tour, below)
  setDrawerOpen(false, { animate: false })

  setFilters()

  // Load the county outlines and the zones, with a message while they download
  loadMapData()

  // Add hash
  var hash = new L.Hash(map)

  // Add color polygons to legend
  addColorPolygonsToLegend()

  // Create overlays pane
  map.createPane('overlays')
  map.getPane('overlays').style.zIndex = 501

  // County outlines sit just above the overlays, so the selected county's
  // outline stays visible over the House and Senate lines
  map.createPane('countyOutlines')
  map.getPane('countyOutlines').style.zIndex = 502

  // Overlays download the first time they're turned on (see showOverlay)
  // loadKauai()
  // loadSewer()

  // Add Esri geocoder
  // var searchControl = L.esri.Geocoding.geosearch({
  // 	position: 'topright',
  // 	allowMultipleResults: false,
  // 	searchBounds: [
  // 		[40.98, -73.74],
  // 		[42.04, -71.78],
  // 	],
  // }).addTo(map)

  // var results = L.layerGroup().addTo(map)

  // searchControl.on('results', function (data) {
  // 	results.clearLayers()
  // 	for (var i = data.results.length - 1; i >= 0; i--) {
  // 		results.addLayer(L.marker(data.results[i].latlng))
  // 	}
  // })

  // On touch screens Driver.js changes steps on touchstart, so the browser's
  // click for that same tap lands on whatever the new step puts under the
  // finger, like the drawer's bar, a district, or a link. After a tap
  // changes the step, that one click is swallowed. Mouse and keyboard step
  // changes leave no click behind, and any new press disarms it.
  let lastPressWasTouch = false
  let swallowNextClick = false
  document.addEventListener(
    'pointerdown',
    (event) => {
      lastPressWasTouch = event.pointerType !== 'mouse'
      swallowNextClick = false
    },
    true
  )
  document.addEventListener(
    'keydown',
    () => {
      lastPressWasTouch = false
      swallowNextClick = false
    },
    true
  )
  document.addEventListener(
    'click',
    (event) => {
      if (swallowNextClick) {
        swallowNextClick = false
        event.preventDefault()
        event.stopPropagation()
      }
    },
    true
  )

  // Phones: the tour opens the drawer, lower than usual, for the steps
  // inside it, and closes it for the map's own steps. The step's element
  // goes as low in the drawer as it fits, away from the popover pinned at
  // the top of the screen. One taller than the drawer starts at its top.
  // Elsewhere this just keeps the drawer's state closed.
  const showTourStep = (element) => {
    const sidebar = document.querySelector('#sidebar')
    const content = document.querySelector('#HiZoningAtlas')
    const isInDrawer =
      matchMedia(phoneMediaQuery).matches && sidebar.contains(element.node)
    sidebar.classList.toggle('drawerTour', isInDrawer)
    setDrawerOpen(isInDrawer, { animate: false })
    if (isInDrawer && element.node === content) {
      content.scrollTop = 0
    } else if (isInDrawer) {
      const drawerBox = content.getBoundingClientRect()
      const stepBox = element.node.getBoundingClientRect()
      content.scrollTop +=
        stepBox.height <= drawerBox.height
          ? stepBox.bottom - drawerBox.bottom
          : stepBox.top - drawerBox.top
    }
  }

  // Phones: the drawer's bar. Opening the drawer pans the map up, so what was
  // in the middle of the map stays in view in the strip above the drawer, and
  // closing it pans back. The bar does nothing while the tour runs, because
  // the tour opens and closes the drawer itself. (driver is still undefined
  // here, and stays so if Driver.js fails to load.)
  document.querySelector('#drawerToggle').addEventListener('click', () => {
    if (driver?.isActivated) return
    const open = !drawerOpen
    // The open drawer takes this share of the screen above the tab bar (see
    // --drawerOpenShare in style.css), and the strip of map above it gets the rest
    const openShare = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        '--drawerOpenShare'
      )
    )
    const tabBarHeight = document
      .querySelector('.tabBar')
      .getBoundingClientRect().height
    const stripHeight = (innerHeight - tabBarHeight) * (1 - openShare)
    // Moves the middle of the whole map to the middle of the strip
    const shift = (map.getSize().y - stripHeight) / 2
    setDrawerOpen(open)
    map.panBy([0, open ? shift : -shift], {
      animate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    })
  })

  // Rotating into the tablet layout or back changes whether the drawer's
  // contents should be inert, and where a running tour's step should be
  matchMedia(phoneMediaQuery).addEventListener('change', () => {
    if (driver?.isActivated && driver.hasHighlightedElement()) {
      showTourStep(driver.getHighlightedElement())
      driver.refresh()
    } else {
      setDrawerOpen(drawerOpen, { animate: false })
    }
  })

  // Where the filters are: a drawer on phones, a panel on the left elsewhere
  const filtersPlace = matchMedia(phoneMediaQuery).matches
    ? 'the <strong>Filters &amp; overlays</strong> panel'
    : 'the menu on the left-hand side of this screen'

  // Start tour
  var driver = new Driver({
    animate: false,
    allowClose: false,
    // Phones: keep the element where showTourStep put it. Driver.js's own
    // check can't tell it's already in view inside the drawer, and would
    // center it, which tucks the top of a tall step under the drawer's bar.
    scrollIntoViewOptions: matchMedia(phoneMediaQuery).matches
      ? { behavior: 'instant', block: 'nearest' }
      : null,
    // Driver.js calls this before it measures the step's element
    onHighlightStarted: (element) => {
      swallowNextClick = lastPressWasTouch
      showTourStep(element)
    },
    // Driver.js calls this when the tour is closed or finished
    onReset: () => {
      rememberTourSeen()
      swallowNextClick = lastPressWasTouch
      // Phones: the map gets the screen back, and the drawer will next open
      // at its top
      document.querySelector('#sidebar').classList.remove('drawerTour')
      setDrawerOpen(false, { animate: false })
      document.querySelector('#HiZoningAtlas').scrollTop = 0
    },
  })

  // Define the steps for introduction
  driver.defineSteps([
    {
      element: '#HiZoningAtlas',
      popover: {
        title: 'Hawaii Zoning Atlas',
        // What zoning is and how to read the map is on the Home page now
        description:
          "This map shows where Hawaiʻi's zoning allows each kind of housing, district by district, across all four counties. This short tour shows you how to use it. The <strong>Home</strong> tab explains what zoning is and how to read the map.",
        position: 'right',
      },
    },
    {
      element: '#TypeOfZoningDistrict',
      popover: {
        title: 'What are the Zoning Districts?',
        description:
          'We have put the zoning districts in each county into one of three categories: \
          <ul><li><strong>Primarily Residential</strong>: Districts where housing is the main use. They may also include things you might find in residential neighborhoods, like schools and churches.  We included agricultural-residential districts in this category.</li>\
          <li> <strong>Mixed with Residential</strong>: Districts where housing and retail, office, or other commercial uses mix together. They are typically districts around our “main streets” or in areas meant to be developed flexibly.</li>\
          <li> <strong>Nonresidential</strong>: Districts where housing is not allowed to be an independent use. However, some nonresidential districts allow caretaker units, like an apartment for a night watchman in a factory setting.</li></ul>',
        position: 'right',
      },
    },
    {
      element: '#PermittedResidentialUses',
      popover: {
        title: 'Select Permitted Residential Uses',
        description: `<p>Select one or more of the <strong>Permitted Residential Uses</strong> from ${filtersPlace}. The purple and pink hues on the map will show you what kind of zoning district the chosen residential use appears in.</p>\
        <p>Explore the specific conditions under which your selected Permitted Residential Use is allowed, like <strong>minimum lot size</strong> requirements, <strong>public hearing</strong> requirements, or restrictions for <strong>elderly housing</strong>.</p>`,
        position: 'right',
      },
      onNext: function () {
        // Make sure calculator displays on top of map in the next step
        driver.preventMove()
        $('#activeAreaCalculator').css('z-index', '110000')
        driver.moveNext()
      },
    },
    {
      element: '#map',
      popover: {
        title: 'Click the Map to Learn About Your County',
        description:
          'Click the map for the popup to appear on top of the map. It will tell you what percent of land satisfies your selection criteria, as well as\
          median household income, the percent of people cost-burdened (spending 30% or more of their income on housing), and what percent of the population identifies as Native Hawaiian.',
        position: 'mid-center',
      },
      onNext: function () {
        driver.preventMove()
        $('#activeAreaCalculator').css('z-index', '999')
        driver.moveNext()
      },
    },
    {
      element: '#Overlays',
      popover: {
        title: 'Explore the Overlays',
        description:
          'Toggle the checkbox to add or remove map overlays. The overlays include Waterways, Federally owned lands, State owned lands, Dept of Hawaiian Homelands owned lands, and Transit Stations (Rail). Hover over each option for more details.',
        position: 'right',
      },
    },
    {
      element: '.leaflet-control-layers-list',
      popover: {
        title: 'Change the Basemap',
        description:
          'Would you prefer to view the Atlas from a bird\'s eye view? Click "Satellite" at the bottom right in the map.',
        position: 'top-right',
      },
    },
    {
      element: '#ZoneOpacity',
      popover: {
        title: 'Adjust Zone Opacity',
        description: 'Move the slider to adjust zoning layer transparency.',
        position: 'top',
      },
    },
  ])
  // Start the introduction, unless this browser has already closed or finished it
  if (!hasSeenTour()) {
    driver.start()
  }
}

// Initialize the map when DOM is loaded
document.addEventListener('DOMContentLoaded', initMap)
