from exceptions import InvalidCountyException

# TODO: Verify jurisdiction based on the file passed in
# Kauai is spelled without the ʻokina, to match the GIS files and the site.
# pull_sheet.py converts the sheet's "Kauaʻi". The sheet calls Honolulu's
# county "Honolulu County"; nothing reads this column, so both are fine.
def validate_county(val):
    counties = ["Hawaii", "Kauai", "Maui", "Honolulu", "Honolulu County"]
    if val not in counties:
        raise InvalidCountyException("Invalid County, county should be: Hawaii, Kauai, Maui, or Honolulu (County)")
