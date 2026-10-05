/*
 * Links to the map used to point at the site's root, like
 * /#13/21.33752/-157.86051/1F=&1F=A. The map lives at /map/ now, so a link
 * whose hash holds a map view goes there, hash and all, and keeps working.
 *
 * index.html loads this without defer on purpose: it runs before the page
 * draws, so an old link doesn't flash the Home page first. It doesn't touch
 * the page, so it doesn't need to wait for it.
 */

// A map view in the hash: #zoom/lat/lng, alone or followed by /filters
const mapViewHash = /^#\d+\/-?\d+(\.\d+)?\/-?\d+(\.\d+)?(\/|$)/

if (mapViewHash.test(location.hash)) {
  location.replace(`/map/${location.hash}`)
}
