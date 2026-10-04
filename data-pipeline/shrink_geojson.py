"""Shrinks GeoJSON files: rounds coordinates to 5 decimal places and drops
the spaces between JSON tokens.

Five decimal places is about 1 m, and the map's shapes are already simplified
to about 2 m, so nothing visible changes. Properties stay exactly as they are.
Running it twice gives the same file.

Rounding can break a polygon where two of its edges are less than 1 m apart:
they cross, or a sliver collapses. Leaflet still draws it, but GIS tools
reject it. So the notebook snaps final.geojson with shapely's set_precision
first, which keeps the shapes valid, and this script only trims what's left.
After rounding another polygon file this way, check that its shapes are
still valid. data/counties.geojson's were.

The notebook uses it for final.geojson. For other files, run it from the repo
root, for example:

    python data-pipeline/shrink_geojson.py data/counties.geojson

It uses only the standard library.
"""

import json
import sys
from pathlib import Path

PLACES = 5


def round_coordinates(coordinates):
    """Rounds nested coordinate lists down to their [lng, lat] pairs."""
    if coordinates and isinstance(coordinates[0], (int, float)):
        return [round(value, PLACES) for value in coordinates]
    return [round_coordinates(part) for part in coordinates]


def round_geometry(geometry):
    if not geometry:
        return geometry
    if geometry["type"] == "GeometryCollection":
        geometry["geometries"] = [round_geometry(g) for g in geometry["geometries"]]
    else:
        geometry["coordinates"] = round_coordinates(geometry["coordinates"])
    return geometry


def shrink_geojson(path):
    """Rewrites one GeoJSON file in place. Returns its size before and after."""
    path = Path(path)
    before = path.stat().st_size
    data = json.loads(path.read_text(encoding="utf-8"))

    if data.get("type") == "FeatureCollection":
        for feature in data["features"]:
            feature["geometry"] = round_geometry(feature.get("geometry"))
    elif data.get("type") == "Feature":
        data["geometry"] = round_geometry(data.get("geometry"))
    else:
        data = round_geometry(data)

    text = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    path.write_bytes(text.encode("utf-8"))
    return before, path.stat().st_size


if __name__ == "__main__":
    for name in sys.argv[1:]:
        before, after = shrink_geojson(name)
        print(f"{name}: {before / 1e6:.2f} MB → {after / 1e6:.2f} MB")
