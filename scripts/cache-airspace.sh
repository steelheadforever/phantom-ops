#!/usr/bin/env bash
# Cache FAA Class B/C/D airspace data as local GeoJSON files.
# Airspace data follows the 28-day AIRAC cycle — run this after each update.
#
# Usage:
#   ./cache-airspace.sh            # fetch to local data/airspace/
#   ./cache-airspace.sh --upload   # also upload to Cloudflare R2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../data/airspace"
WORKER_DIR="$SCRIPT_DIR/../workers/airspace-cache"
BASE_URL="https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0/query"
BUCKET="phantom-airspace-data"

UPLOAD=false
if [[ "${1:-}" == "--upload" ]]; then
  UPLOAD=true
fi

mkdir -p "$OUT_DIR"

for CLASS in B C D; do
  FILENAME="class-$(echo "$CLASS" | tr '[:upper:]' '[:lower:]').geojson"
  FILE="$OUT_DIR/$FILENAME"
  echo "Fetching Class $CLASS airspace..."
  curl -sf "$BASE_URL?where=CLASS%3D%27${CLASS}%27&outFields=*&f=geojson" -o "$FILE"
  COUNT=$(python3 -c "import json; print(len(json.load(open('$FILE'))['features']))")
  echo "  -> $FILE ($COUNT features)"

  if $UPLOAD; then
    echo "  Uploading $FILENAME to R2..."
    npx wrangler --config "$WORKER_DIR/wrangler.toml" \
      r2 object put "$BUCKET/$FILENAME" --file "$FILE" \
      --content-type "application/geo+json" --remote
  fi
done

echo "Done. Cache updated at $(date)."
