from exceptions import InvalidJurisdictionException

# TODO: Verify jurisdiction based on the file passed in
# Kauai is spelled without the ʻokina, to match the GIS files and the site.
# pull_sheet.py converts the sheet's "Kauaʻi".
def validate_jurisdiction(val):
    jurisdictions = ["Hawaii", "Kauai", "Maui", "Honolulu"]
    if val not in jurisdictions:
        raise InvalidJurisdictionException("Invalid valid jurisdiction. Jurisdiction should be: Hawaii, Kauai, Maui, or Honolulu")
