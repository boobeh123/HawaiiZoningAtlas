/*
 * Google Analytics (gtag.js) setup. It lives here instead of an inline script
 * in index.html. Set measurementId to '' to turn Analytics off.
 */
const measurementId = 'G-ZTZX623WY7'

// Local test visits shouldn't show up in the Analytics reports
const isLocalVisit = ['localhost', '127.0.0.1'].includes(location.hostname)

window.dataLayer = window.dataLayer || []

// gtag.js expects the arguments object itself, so this can't be an arrow
// function (arrow functions don't have `arguments`)
function gtag() {
  window.dataLayer.push(arguments)
}

if (measurementId && !isLocalVisit) {
  const gtagScript = document.createElement('script')
  gtagScript.async = true
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.append(gtagScript)

  gtag('js', new Date())
  gtag('config', measurementId)
}
