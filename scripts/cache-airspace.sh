#!/usr/bin/env bash
# Cache FAA Class B/C/D airspace data as local GeoJSON files.
# Airspace data follows the 28-day AIRAC cycle — run this after each update.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../data/airspace"
BASE_URL="https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0/query"

mkdir -p "$OUT_DIR"

for CLASS in B C D; do
  FILE="$OUT_DIR/class-$(echo "$CLASS" | tr '[:upper:]' '[:lower:]').geojson"
  echo "Fetching Class $CLASS airspace..."
  curl -sf "$BASE_URL?where=CLASS%3D%27${CLASS}%27&outFields=*&f=geojson" -o "$FILE"
  COUNT=$(python3 -c "import json; print(len(json.load(open('$FILE'))['features']))")
  echo "  -> $FILE ($COUNT features)"
done

echo "Done. Cache updated at $(date)."
