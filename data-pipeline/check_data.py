"""Checks the regenerated map data before the spreadsheet sync pushes it.

Run it from anywhere in the repo, after the notebook has run and its output
has been copied to data/final.geojson:

    python data-pipeline/check_data.py
    python data-pipeline/check_data.py path/to/final.geojson   # another file

It compares the map data with the version in the last commit, and exits with
an error, so the sync pushes nothing, if anything looks broken:
- all four counties are there, and none lost more than a fifth of its districts
- every sidebar checkbox still matches at least one district
- the flags are still the text the site's checkboxes and tooltip compare against

It uses only the standard library, so it runs without the notebook's packages.
"""

import json
import subprocess
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data" / "final.geojson"
INDEX = REPO / "map" / "index.html"

COUNTIES = {"Hawaii", "Honolulu", "Kauai", "Maui"}

# A county losing more of its districts than this means something broke
LARGEST_DROP = 0.2

# Checkboxes that match no district on purpose: no county's ADU answer is
# "Public Hearing"
NO_MATCH_EXPECTED = {("AD", "AH")}

# The site compares these properties as text (see the notebook's save cell)
FLAG_VALUES = {
    "1MUS": {"0", "1"},
    "2MUS": {"0", "1"},
    "3MUS": {"0", "1"},
    "4MUS": {"0", "1"},
    "MUS": {"0", "1"},
    "ASize": {"Yes", "No"},
}


class CheckboxParser(HTMLParser):
    """Collects the name and value of every checkbox on the map page."""

    def __init__(self):
        super().__init__()
        self.checkboxes = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "input" and attributes.get("type") == "checkbox":
            self.checkboxes.add((attributes.get("name"), attributes.get("value")))


def load_features(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))["features"]


def load_previous_features():
    """Returns the features in the last commit, or None if there are none."""
    result = subprocess.run(
        ["git", "show", "HEAD:data/final.geojson"],
        cwd=REPO,
        capture_output=True,
    )
    if result.returncode != 0:
        return None
    return json.loads(result.stdout.decode("utf-8"))["features"]


def main():
    data_path = sys.argv[1] if len(sys.argv) > 1 else DATA
    features = load_features(data_path)
    previous = load_previous_features()
    problems = []

    # Counties, and how many districts each has
    counts = Counter(feature["properties"]["T"] for feature in features)
    previous_counts = (
        Counter(feature["properties"]["T"] for feature in previous)
        if previous
        else Counter()
    )
    for county in sorted(COUNTIES - set(counts)):
        problems.append(f"{county} has no districts")
    for county in sorted(set(counts) - COUNTIES):
        problems.append(f"Unknown county name: {county!r}")
    for county in sorted(COUNTIES & set(previous_counts)):
        if counts[county] < previous_counts[county] * (1 - LARGEST_DROP):
            problems.append(
                f"{county} dropped from {previous_counts[county]} "
                f"to {counts[county]} districts"
            )

    # Every checkbox should still match some district
    parser = CheckboxParser()
    parser.feed(INDEX.read_text(encoding="utf-8"))
    for name, value in sorted(parser.checkboxes, key=str):
        if name == "Overlay" or not value or (name, value) in NO_MATCH_EXPECTED:
            continue
        if not any(feature["properties"].get(name) == value for feature in features):
            problems.append(f"No district matches the {name}={value} checkbox")

    # Flags must stay the text the site compares against
    for key, allowed in FLAG_VALUES.items():
        found = {feature["properties"].get(key) for feature in features}
        unexpected = found - allowed - {None}
        if unexpected:
            problems.append(
                f"{key} has values the site can't use: {sorted(map(str, unexpected))}"
            )

    summary = ", ".join(
        f"{county} {previous_counts.get(county, '?')} → {counts.get(county, 0)}"
        for county in sorted(COUNTIES)
    )
    print(f"Districts per county (last commit → now): {summary}")

    if problems:
        print("The map data failed its checks:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("All checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
