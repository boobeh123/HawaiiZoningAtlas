/*
 * Refreshes the county stats in data/demographics.js from the Census Bureau's
 * American Community Survey (ACS) 5-year estimates. Needs CENSUS_API_KEY in
 * .env (see .env.example). The key is only sent to the Census API. It's never
 * printed or written to a file.
 *
 *   node --env-file=.env tools/fetchDemographics.js --check
 *     Finds which ACS release and definitions reproduce the numbers that are in
 *     data/demographics.js now. Writes nothing.
 *
 *   node --env-file=.env tools/fetchDemographics.js 2024
 *     Fetches the 2020–2024 release and rewrites data/demographics.js.
 */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const apiBase = 'https://api.census.gov/data'
const outputFile = path.join(__dirname, '..', 'data', 'demographics.js')
const checkYears = [2017, 2018, 2019, 2020, 2021]

// Census county codes in Hawaii (state 15), mapped to the county names used in
// data/final.geojson. Kalawao has no zoning data, so it's left out.
const counties = { '001': 'Hawaii', '003': 'Honolulu', '007': 'Kauai', '009': 'Maui' }

// The cost-burden definition behind the original numbers. On 2026-10-01,
// --check showed allHouseholds reproducing them exactly for all four counties
// (2015–2019 release). computableOccupiedHomes gives identical numbers from
// table B25106.
const costBurdenDefinition = 'allHouseholds'

// Stats are found by their labels, not their variable IDs, because the Census
// renumbers variables between releases. Native Hawaiian was DP05_0053PE in
// 2020 and is DP05_0071PE in 2024.
const smocapi =
  'Estimate!!SELECTED MONTHLY OWNER COSTS AS A PERCENTAGE OF HOUSEHOLD INCOME (SMOCAPI)'
const grapi = 'Estimate!!GROSS RENT AS A PERCENTAGE OF HOUSEHOLD INCOME (GRAPI)'
const housingCostGroups = {
  ownersWithMortgage: `${smocapi}!!Housing units with a mortgage (excluding units where SMOCAPI cannot be computed)`,
  ownersWithoutMortgage: `${smocapi}!!Housing unit without a mortgage (excluding units where SMOCAPI cannot be computed)`,
  renters: `${grapi}!!Occupied units paying rent (excluding units where GRAPI cannot be computed)`,
}

const costBurdenDefinitions = {
  allHouseholds: {
    description:
      'households whose housing costs are 30% or more of income, out of all households where that share can be computed (table DP04)',
    compute: ({ groups }) =>
      percent(
        Object.values(groups).reduce((sum, group) => sum + group.burdened, 0),
        Object.values(groups).reduce((sum, group) => sum + group.total, 0)
      ),
  },
  renters: {
    description: 'renter households whose rent is 30% or more of income (table DP04)',
    compute: ({ groups }) => percent(groups.renters.burdened, groups.renters.total),
  },
  ownersWithMortgage: {
    description:
      'mortgaged owner households whose housing costs are 30% or more of income (table DP04)',
    compute: ({ groups }) =>
      percent(groups.ownersWithMortgage.burdened, groups.ownersWithMortgage.total),
  },
  allOccupiedHomes: {
    description:
      'occupied homes whose housing costs are 30% or more of income, out of all occupied homes (table B25106)',
    compute: ({ detail }) => percent(detail.burdened, detail.total),
  },
  computableOccupiedHomes: {
    description:
      'occupied homes whose housing costs are 30% or more of income, leaving out homes with zero or negative income or no cash rent (table B25106)',
    compute: ({ detail }) =>
      percent(detail.burdened, detail.total - detail.excluded),
  },
}

/*
 * Returns the profile-table labels to look up, keyed by the name this script
 * uses for each one
 */
const getProfileLabels = () => ({
  // Median household income. The label names the dollar year, e.g. "IN 2024".
  income:
    /^Estimate!!INCOME AND BENEFITS \(IN \d{4} INFLATION-ADJUSTED DOLLARS\)!!Total households!!Median household income \(dollars\)$/,
  // Native Hawaiian, one race. 2017 labels start "Percent Estimate", later ones "Percent".
  nativeHawaiian:
    /^Percent( Estimate)?!!RACE!!Total population!!One race!!Native Hawaiian and Other Pacific Islander!!Native Hawaiian$/,
  ...Object.fromEntries(
    Object.entries(housingCostGroups).flatMap(([group, label]) => [
      [`${group}Total`, label],
      [`${group}30To35`, `${label}!!30.0 to 34.9 percent`],
      [`${group}35Plus`, `${label}!!35.0 percent or more`],
    ])
  ),
})

const percent = (part, whole) => Math.round((part / whole) * 1000) / 10

const releaseName = (year) => `${year - 4}–${year} ACS 5-year estimates`

const labelMatches = (label, expected) =>
  expected instanceof RegExp ? expected.test(label) : label === expected

/*
 * Fetches a Census API URL and parses the JSON. Error messages never include
 * the URL, because data URLs contain the key.
 */
const fetchJson = async (url, what) => {
  let response
  try {
    response = await fetch(url)
  } catch {
    throw new Error(`Couldn't reach the Census API for ${what}.`)
  }
  if (!response.ok) {
    throw new Error(`The Census API returned HTTP ${response.status} for ${what}.`)
  }
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    // A missing or invalid key gets an HTML page instead of JSON
    throw new Error(
      `The Census API didn't return data for ${what}. Check CENSUS_API_KEY in .env.`
    )
  }
}

/*
 * Maps each wanted label to its variable ID in one release. Throws if a label
 * matches no variable or more than one.
 */
const resolveProfileVariables = async (year) => {
  const { variables } = await fetchJson(
    `${apiBase}/${year}/acs/acs5/profile/variables.json`,
    `the ${year} profile variable list`
  )
  // Estimates only: DP03/DP04/DP05 IDs ending in E (count) or PE (percent)
  const estimates = Object.entries(variables).filter(([id]) =>
    /^DP0[345]_\d{4}P?E$/.test(id)
  )
  return Object.fromEntries(
    Object.entries(getProfileLabels()).map(([name, expected]) => {
      const ids = estimates
        .filter(([, meta]) => labelMatches(meta.label, expected))
        .map(([id]) => id)
      if (ids.length !== 1) {
        throw new Error(`Expected one ${year} variable for "${name}" but found ${ids.length}.`)
      }
      return [name, ids[0]]
    })
  )
}

/*
 * Finds the table B25106 variables (housing costs as a share of income, by
 * tenure and income bracket) for one release
 */
const resolveDetailVariables = async (year) => {
  const { variables } = await fetchJson(
    `${apiBase}/${year}/acs/acs5/groups/B25106.json`,
    `the ${year} B25106 variable list`
  )
  // Estimates only: B25106_001E through B25106_046E
  const estimates = Object.entries(variables).filter(([id]) => /^B25106_\d{3}E$/.test(id))
  const idsWhere = (test) => estimates.filter(([, meta]) => test(meta.label)).map(([id]) => id)
  const detail = {
    // 2017 labels have no trailing colons ("Estimate!!Total"), later ones do
    total: idsWhere((label) => label === 'Estimate!!Total' || label === 'Estimate!!Total:'),
    burdened: idsWhere((label) => label.endsWith('!!30 percent or more')),
    excluded: idsWhere(
      (label) => label.endsWith('!!Zero or negative income') || label.endsWith('!!No cash rent')
    ),
  }
  if (detail.total.length !== 1 || detail.burdened.length !== 10 || detail.excluded.length !== 3) {
    throw new Error(`Table B25106 for ${year} doesn't have the expected rows.`)
  }
  return { total: detail.total[0], burdened: detail.burdened, excluded: detail.excluded }
}

/*
 * Fetches the given variables for the four counties. Returns one row of raw
 * values per county name.
 */
const fetchCountyRows = async (datasetUrl, ids, key, what) => {
  const params = new URLSearchParams({
    get: ids.join(','),
    for: `county:${Object.keys(counties).join(',')}`,
    in: 'state:15',
    key,
  })
  const [header, ...rows] = await fetchJson(`${datasetUrl}?${params}`, what)
  return Object.fromEntries(
    rows.map((row) => {
      const record = Object.fromEntries(header.map((column, i) => [column, row[i]]))
      return [counties[record.county], record]
    })
  )
}

/*
 * Turns one county's raw Census values into income, Native Hawaiian share, and
 * every candidate cost-burden figure
 */
const computeCountyStats = (county, profileRow, detailRow, ids) => {
  const value = (row, id) => {
    const number = Number(row[id])
    // The Census uses large negative numbers (like -666666666) for "no estimate"
    if (!Number.isFinite(number) || number < 0) {
      throw new Error(`The Census has no estimate for ${id} in ${county}.`)
    }
    return number
  }
  const groups = Object.fromEntries(
    Object.keys(housingCostGroups).map((group) => [
      group,
      {
        total: value(profileRow, ids.profile[`${group}Total`]),
        burdened:
          value(profileRow, ids.profile[`${group}30To35`]) +
          value(profileRow, ids.profile[`${group}35Plus`]),
      },
    ])
  )
  const sumOf = (variableIds) => variableIds.reduce((sum, id) => sum + value(detailRow, id), 0)
  const detail = {
    total: value(detailRow, ids.detail.total),
    burdened: sumOf(ids.detail.burdened),
    excluded: sumOf(ids.detail.excluded),
  }
  return {
    income: value(profileRow, ids.profile.income),
    nativeHawaiian: value(profileRow, ids.profile.nativeHawaiian),
    burdened: Object.fromEntries(
      Object.entries(costBurdenDefinitions).map(([name, definition]) => [
        name,
        definition.compute({ groups, detail }),
      ])
    ),
  }
}

/*
 * Fetches and computes every county's stats for one release
 */
const fetchStats = async (year, key) => {
  const ids = {
    profile: await resolveProfileVariables(year),
    detail: await resolveDetailVariables(year),
  }
  const profileRows = await fetchCountyRows(
    `${apiBase}/${year}/acs/acs5/profile`,
    Object.values(ids.profile),
    key,
    `the ${year} profile data`
  )
  const detailRows = await fetchCountyRows(
    `${apiBase}/${year}/acs/acs5`,
    [ids.detail.total, ...ids.detail.burdened, ...ids.detail.excluded],
    key,
    `the ${year} B25106 data`
  )
  return Object.fromEntries(
    Object.values(counties).map((county) => [
      county,
      computeCountyStats(county, profileRows[county], detailRows[county], ids),
    ])
  )
}

const readCurrentDemographics = () =>
  vm.runInNewContext(`${fs.readFileSync(outputFile, 'utf8')}\ndemographics`)

/*
 * Returns the source text of data/demographics.js for one release
 */
const renderDemographicsFile = (year, stats, definitionName, generatedOn) => {
  const rows = Object.values(counties).map((county) => {
    const { income, nativeHawaiian, burdened } = stats[county]
    return `  ${county}: { income: ${income}, nativeHawaiian: ${nativeHawaiian}, burdened: ${burdened[definitionName]} },`
  })
  return [
    `// Generated by tools/fetchDemographics.js on ${generatedOn}. Don't edit it by`,
    '// hand. Rerun the script instead (see CLAUDE.md).',
    '//',
    `// Source: U.S. Census Bureau, American Community Survey ${year - 4}–${year} 5-year`,
    '// estimates (https://api.census.gov).',
    '// - income: median household income (table DP03)',
    '// - nativeHawaiian: % of residents who are Native Hawaiian, one race (table DP05)',
    `// - burdened: % of ${costBurdenDefinitions[definitionName].description}`,
    `const demographicsSource = '${releaseName(year)}'`,
    '',
    'const demographics = {',
    ...rows,
    '}',
    '',
  ].join('\n')
}

const formatStats = ({ income, nativeHawaiian, burdened }) =>
  `income $${income.toLocaleString('en-US')}, Native Hawaiian ${nativeHawaiian}%, cost-burdened ${burdened}%`

/*
 * --check: reports which release and cost-burden definition reproduce the
 * numbers in data/demographics.js. Writes nothing.
 */
const runCheck = async (key) => {
  const current = readCurrentDemographics()
  const names = Object.values(counties)
  console.log('Numbers in data/demographics.js now:')
  names.forEach((county) => console.log(`  ${county.padEnd(9)} ${formatStats(current[county])}`))

  const definitionNames = Object.keys(costBurdenDefinitions)
  const results = []
  for (const year of checkYears) {
    results.push({ year, stats: await fetchStats(year, key) })
  }

  console.log('\nCounties that match exactly (out of 4):')
  console.log(`  ${'release'.padEnd(11)} ${'income'.padEnd(7)} ${'NH'.padEnd(4)} ${definitionNames.join('  ')}`)
  results.forEach(({ year, stats }) => {
    const matches = (test) => names.filter((county) => test(stats[county], current[county])).length
    const burdenMatches = definitionNames.map((name) =>
      String(matches((found, now) => found.burdened[name] === now.burdened)).padEnd(name.length)
    )
    console.log(
      `  ${`${year - 4}–${year}`.padEnd(11)} ${String(matches((found, now) => found.income === now.income)).padEnd(7)} ` +
        `${String(matches((found, now) => found.nativeHawaiian === now.nativeHawaiian)).padEnd(4)} ${burdenMatches.join('  ')}`
    )
  })

  console.log('\nCost-burden values per release, to compare with the numbers above:')
  results.forEach(({ year, stats }) => {
    console.log(`  ${year - 4}–${year}`)
    definitionNames.forEach((name) => {
      const values = names.map((county) => `${county} ${stats[county].burdened[name]}`)
      console.log(`    ${name.padEnd(24)} ${values.join(', ')}`)
    })
  })
}

/*
 * <year>: rewrites data/demographics.js from that release
 */
const runUpdate = async (year, key) => {
  if (!costBurdenDefinition) {
    throw new Error('Run --check first, then set costBurdenDefinition at the top of this script.')
  }
  const current = readCurrentDemographics()
  const stats = await fetchStats(year, key)
  console.log(`${releaseName(year)} (cost burden: ${costBurdenDefinition}):`)
  Object.values(counties).forEach((county) => {
    const next = { ...stats[county], burdened: stats[county].burdened[costBurdenDefinition] }
    console.log(`  ${county.padEnd(9)} was ${formatStats(current[county])}`)
    console.log(`  ${''.padEnd(9)} now ${formatStats(next)}`)
  })
  const generatedOn = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(outputFile, renderDemographicsFile(year, stats, costBurdenDefinition, generatedOn))
  console.log(`\nWrote ${path.relative(process.cwd(), outputFile)}`)
}

const main = async () => {
  const [arg] = process.argv.slice(2)
  const key = process.env.CENSUS_API_KEY
  if (!key) {
    throw new Error(
      "CENSUS_API_KEY isn't set. Add it to .env (see .env.example) and run with node --env-file=.env."
    )
  }
  if (arg === '--check') {
    return runCheck(key)
  }
  const year = Number(arg)
  if (!Number.isInteger(year) || year < 2010) {
    throw new Error('Usage: node --env-file=.env tools/fetchDemographics.js --check | <year>')
  }
  return runUpdate(year, key)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = {
  computeCountyStats,
  renderDemographicsFile,
  resolveDetailVariables,
  resolveProfileVariables,
}
