# Data pipeline

Turns the research spreadsheet and the county GIS files into the map's data, `data/final.geojson`. The `spreadsheet.yml` GitHub Action runs these steps every Monday and pushes any changes to `main`. You only need the commands below to run them yourself.

## Setup

The packages are listed in `requirements.txt` and were tested on Python 3.13. Install them once into a virtual environment outside the repo:

```sh
python -m venv ~/hza
~/hza/Scripts/python -m pip install -r requirements.txt -r csv-validation/requirements.txt
```

On Windows, the environment's programs are in `~/hza/Scripts/`. On macOS and Linux, use `~/hza/bin/` instead.

## Steps

Run these from this folder, `data-pipeline/`.

1. **Pull the spreadsheet** into `hawaii-zoning-data.csv`. The script reads the Google Sheet without changing it and fixes a few known problems on the way in. It prints which districts changed.

   ```sh
   ~/hza/Scripts/python pull_sheet.py
   ```

2. **Validate the CSV:**

   ```sh
   cd csv-validation && ~/hza/Scripts/python validation.py ../hawaii-zoning-data.csv && cd ..
   ```

3. **Rebuild the map data** with the notebook, which takes about a minute. It snaps the shapes to a 1 m grid, and `shrink_geojson.py`, which must stay in this folder, writes `final.geojson` at half the size it used to be. Then copy the result to the site:

   ```sh
   ~/hza/Scripts/jupyter execute CombineJurisdictions.ipynb
   cp final.geojson ../data/final.geojson
   ```

4. **Check the map data** before committing. This confirms all four counties are there and every sidebar checkbox still matches a district:

   ```sh
   ~/hza/Scripts/python check_data.py
   ```

To shrink another GeoJSON file the same way, run `~/hza/Scripts/python shrink_geojson.py ../data/<name>.geojson`. For polygon files, read the note at the top of `shrink_geojson.py` first.

The `Dockerfile` in this folder is from an earlier setup and doesn't work. Its command runs `hzadata.py`, which doesn't exist.
