/*
 * Builds the "four counties at a glance" table on the Home page from
 * data/demographics.js, the same Census figures the map's area panel shows.
 * Rerunning tools/fetchDemographics.js updates both. Everything is set as
 * text.
 */

const countyStats = document.querySelector('#countyStats')

// The data's keys leave out the ʻokina, so the table spells the names out
const countyNames = {
  Hawaii: 'Hawaiʻi',
  Honolulu: 'Honolulu',
  Kauai: 'Kauaʻi',
  Maui: 'Maui',
}

const columns = [
  'County',
  'Median household income',
  'Households spending 30%+ of income on housing',
  'Native Hawaiian residents',
]

const formatIncome = (value) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

const formatPercent = (value) => `${value.toFixed(1)}%`

const createTextCell = (tag, text, scope) => {
  const cell = document.createElement(tag)
  cell.textContent = text
  if (scope) {
    cell.scope = scope
  }
  return cell
}

const buildCountyTable = () => {
  const table = document.createElement('table')
  table.className = 'countyTable'

  const caption = document.createElement('caption')
  caption.textContent = `U.S. Census Bureau, ${demographicsSource}`

  const headRow = document.createElement('tr')
  headRow.append(...columns.map((name) => createTextCell('th', name, 'col')))
  const head = document.createElement('thead')
  head.append(headRow)

  const body = document.createElement('tbody')
  body.append(
    ...Object.entries(demographics).map(([county, figures]) => {
      const row = document.createElement('tr')
      row.append(
        createTextCell('th', countyNames[county] || county, 'row'),
        createTextCell('td', formatIncome(figures.income)),
        createTextCell('td', formatPercent(figures.burdened)),
        createTextCell('td', formatPercent(figures.nativeHawaiian))
      )
      return row
    })
  )

  table.append(caption, head, body)
  return table
}

// demographics.js defines demographics and demographicsSource. If it didn't
// load, the note says so instead of the table.
if (typeof demographics === 'undefined') {
  countyStats.querySelector('.countyStatsNote').textContent =
    "The county figures couldn't load. Try reloading the page."
} else {
  countyStats.replaceChildren(buildCountyTable())
}
