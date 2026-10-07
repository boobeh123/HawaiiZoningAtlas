"""Pulls the research spreadsheet's county tabs into hawaii-zoning-data.csv.

The master Google Sheet is the research team's record, so this only reads it,
through Google's public CSV export. A few known problems in the sheet are
fixed on the way in (see correct_row) instead of in the sheet itself. Laws
passed after the research are added the same way, from law-updates.csv (see
apply_law_updates).

Run it from data-pipeline/:

    python pull_sheet.py                 # rewrites hawaii-zoning-data.csv
    python pull_sheet.py --message FILE  # also writes a commit message to FILE

It prints which districts changed compared with the CSV that was there before.
It uses only the standard library, so it runs without the notebook's packages.
"""

import argparse
import csv
import io
import sys
import urllib.request
from pathlib import Path

SPREADSHEET_ID = "1YGt_Y70oy6qc09ZZ7kip9DM2JGtRC2fAHxi6JXOIsSk"

# Each county's tab in the sheet, in the order its rows go in the CSV
TABS = {
    "Hawaii": "835193382",
    "Honolulu": "448730928",
    "Kauai": "1081331077",
    "Maui": "987737350",
}

# The CSV keeps the sheet's two header rows: section numbers, then column
# names. The column names are identical in every tab, but the section numbers
# differ slightly, so they come from Maui's tab, as the original workflow did.
HEADER_TAB = "Maui"

OUTPUT = Path(__file__).parent / "hawaii-zoning-data.csv"

# Laws passed after the research, one changed cell per row
LAW_UPDATES = Path(__file__).parent / "law-updates.csv"

# Most changed cells to list in the summary before cutting it short
SUMMARY_LIMIT = 40


def download_tab(gid):
    """Returns one tab's rows. Fails loudly if Google sends anything but CSV."""
    url = (
        f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}"
        f"/export?format=csv&gid={gid}"
    )
    with urllib.request.urlopen(url, timeout=120) as response:
        content_type = response.headers.get("Content-Type", "")
        if "text/csv" not in content_type:
            # A sheet that stops being shared publicly returns a login page
            raise SystemExit(
                f"Expected CSV from tab {gid} but got {content_type}. "
                "Is the sheet still shared as 'anyone with the link'?"
            )
        text = response.read().decode("utf-8")
    return list(csv.reader(io.StringIO(text, newline="")))


def correct_row(row, column):
    """Fixes known problems in one sheet row, in place.

    Each fix only applies while the sheet still has the problem, so the team
    fixing the sheet later is harmless.
    """
    # The sheet spells Kauai with an ʻokina, but the GIS files and the site
    # use "Kauai", and districts are matched on that name
    for name in ("Jurisdiction", "County"):
        if row[column[name]] == "Kauaʻi":
            row[column[name]] = "Kauai"

    # Maui's Public Use row has a blank State, Jurisdiction, and County
    if (
        row[column["Abbreviated District Name"]] == "P"
        and row[column["Full District Name"]] == "Public Use"
        and not row[column["State"]]
        and not row[column["Jurisdiction"]]
    ):
        row[column["State"]] = "HI"
        row[column["Jurisdiction"]] = "Maui"
        row[column["County"]] = "Maui"

    # Typo: Kauai's Open Space/Project District is "OS/PD" in the GIS files
    if (
        row[column["Jurisdiction"]] == "Kauai"
        and row[column["Abbreviated District Name"]] == "OD/PD"
    ):
        row[column["Abbreviated District Name"]] = "OS/PD"


def apply_law_updates(rows, column):
    """Applies law-updates.csv to the sheet's rows, in place.

    Each row of that file changes one cell, for a law passed after the
    research. "replace" swaps the sheet's value for a new one, and "append"
    adds a sentence to the end of the cell. Like the fixes in correct_row, an
    update only applies while the sheet still has the old value, so the team
    updating the sheet later is harmless. A district or column that doesn't
    exist stops the run, so a typo can't quietly do nothing.

    Returns how many updates applied, and a line for each one skipped because
    the sheet has changed since.
    """
    with open(LAW_UPDATES, encoding="utf-8", newline="") as file:
        updates = list(csv.DictReader(file))

    districts = {}
    for row in rows[2:]:
        key = (
            row[column["Jurisdiction"]].strip(),
            row[column["Abbreviated District Name"]].strip(),
        )
        districts.setdefault(key, []).append(row)

    applied = 0
    skipped = []
    for update in updates:
        key = (update["Jurisdiction"], update["District"])
        name = f"{key[0]} {key[1]}, {update['Column']}"
        matches = districts.get(key, [])
        if len(matches) != 1:
            raise SystemExit(
                f"{LAW_UPDATES.name}: {key[0]} {key[1]} matches "
                f"{len(matches)} districts instead of 1"
            )
        if update["Column"] not in column:
            raise SystemExit(
                f"{LAW_UPDATES.name}: there's no column named {update['Column']!r}"
            )
        row = matches[0]
        cell = column[update["Column"]]
        new_value = update["New value"]

        if update["Change"] == "replace":
            if row[cell].strip() == new_value.strip():
                continue
            if row[cell].strip() != update["Sheet value"].strip():
                skipped.append(f"{name}: the sheet now says {row[cell] or '(blank)'}")
                continue
            row[cell] = new_value
        elif update["Change"] == "append":
            if new_value in row[cell]:
                continue
            row[cell] = f"{row[cell].strip()} {new_value}".strip()
        else:
            raise SystemExit(
                f"{LAW_UPDATES.name}: unknown change {update['Change']!r} for {name}"
            )
        applied += 1
    return applied, skipped


def normalize_newlines(rows):
    """Turns CRLF into LF inside cells. Git stores this file with LF, but on
    Windows it checks the file out with CRLF, even inside multi-line cells."""
    return [[cell.replace("\r\n", "\n") for cell in row] for row in rows]


def read_csv(path):
    """Returns the rows of an existing CSV, or None if it doesn't exist."""
    if not path.exists():
        return None
    with open(path, encoding="utf-8", newline="") as file:
        return normalize_newlines(csv.reader(file))


def describe_changes(old_rows, new_rows, column):
    """Returns a list of lines describing which districts changed."""
    names = new_rows[1]

    def district_key(row):
        return (
            row[column["Jurisdiction"]].strip(),
            row[column["Abbreviated District Name"]].strip(),
        )

    old = {district_key(row): row for row in old_rows[2:]}
    new = {district_key(row): row for row in new_rows[2:]}
    lines = []

    for key in new.keys() - old.keys():
        lines.append(f"Added: {key[0]} {key[1]}")
    for key in old.keys() - new.keys():
        lines.append(f"Removed: {key[0]} {key[1]}")
    for key in sorted(new.keys() & old.keys()):
        for i, (before, after) in enumerate(zip(old[key], new[key])):
            if before != after:
                lines.append(
                    f"{key[0]} {key[1]}, {names[i].strip()}: "
                    f"{before or '(blank)'} → {after or '(blank)'}"
                )

    if old_rows[:2] != new_rows[:2]:
        lines.insert(0, "The header rows changed")
    return lines


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--message", help="also write a commit message to this file")
    args = parser.parse_args()

    tabs = {county: download_tab(gid) for county, gid in TABS.items()}

    # The notebook depends on the column names, so a renamed or added column
    # in any tab stops the sync instead of quietly breaking the map
    names = tabs[HEADER_TAB][1]
    for county, rows in tabs.items():
        if len(rows) < 3:
            raise SystemExit(f"The {county} tab has no districts")
        if rows[1] != names:
            raise SystemExit(
                f"The {county} tab's column names differ from {HEADER_TAB}'s"
            )
        if any(len(row) != len(names) for row in rows):
            raise SystemExit(f"A row in the {county} tab has the wrong number of cells")

    column = {name.strip(): i for i, name in enumerate(names)}
    rows = tabs[HEADER_TAB][:2] + [row for tab in tabs.values() for row in tab[2:]]
    for row in rows[2:]:
        correct_row(row, column)
    applied, skipped = apply_law_updates(rows, column)

    rows = normalize_newlines(rows)

    old_rows = read_csv(OUTPUT)

    # Keep the line endings the existing file already has: Git commits LF
    # either way, but a Windows checkout has CRLF, and rewriting it with LF
    # makes git status list the file as changed even when nothing is
    buffer = io.StringIO(newline="")
    csv.writer(buffer, lineterminator="\n").writerows(rows)
    text = buffer.getvalue()
    if OUTPUT.exists() and b"\r\n" in OUTPUT.read_bytes():
        text = text.replace("\n", "\r\n")
    OUTPUT.write_bytes(text.encode("utf-8"))

    changes = describe_changes(old_rows, rows, column) if old_rows else ["New file"]
    print(f"Wrote {OUTPUT.name}: {len(rows) - 2} districts from {len(tabs)} tabs")
    print(f"Applied {applied} law update(s) from {LAW_UPDATES.name}")
    for line in skipped:
        print(f"  Skipped, because the sheet has changed: {line}")
    if changes:
        print(f"{len(changes)} change(s):")
        for line in changes[:SUMMARY_LIMIT]:
            print(f"  {line}")
    else:
        print("No changes")

    if args.message:
        shown = changes[:SUMMARY_LIMIT]
        more = len(changes) - len(shown)
        body = "\n".join(f"- {line}" for line in shown)
        if more:
            body += f"\n- …and {more} more"
        with open(args.message, "w", encoding="utf-8") as file:
            file.write(f"Update the map data from the research spreadsheet\n\n{body}\n")


if __name__ == "__main__":
    sys.exit(main())
