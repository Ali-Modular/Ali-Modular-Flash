#!/usr/bin/env bash
# Add a new firmware release to the repo and update manifest.json
#
# Usage:
#   ./add-firmware.sh <path/to/firmware.bin> <version> "Note one" "Note two" ...
#
# Example:
#   ./add-firmware.sh ~/Downloads/EsusTrifecta_1.19.bin "1.19.0" \
#     "NEW: some feature" "Fix: some bug"

set -e

BIN_PATH="$1"
VERSION="$2"
shift 2
NOTES=("$@")

REPO="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$REPO/manifest.json"

# ── validate ──────────────────────────────────────────────────────────────────
if [[ -z "$BIN_PATH" || -z "$VERSION" || ${#NOTES[@]} -eq 0 ]]; then
  echo "Usage: ./add-firmware.sh <path/to/firmware.bin> <version> \"Note one\" \"Note two\" ..."
  exit 1
fi

if [[ ! -f "$BIN_PATH" ]]; then
  echo "ERROR: file not found: $BIN_PATH"
  exit 1
fi

# ── copy bin into repo ────────────────────────────────────────────────────────
FILENAME="$(basename "$BIN_PATH")"
DEST="$REPO/$FILENAME"
[[ "$BIN_PATH" != "$DEST" ]] && cp "$BIN_PATH" "$DEST" && echo "Copied  $FILENAME"

# ── compute hash + size ───────────────────────────────────────────────────────
SHA256=$(shasum -a 256 "$DEST" | awk '{print $1}')
SIZE=$(wc -c < "$DEST" | tr -d ' ')
DATE=$(date +%Y-%m-%d)
echo "SHA-256 $SHA256"
echo "Size    $SIZE bytes"

# ── update manifest.json via python ──────────────────────────────────────────
python3 - "$MANIFEST" "$VERSION" "$DATE" "$FILENAME" "$SIZE" "$SHA256" "${NOTES[@]}" <<'EOF'
import sys, json

manifest_path, version, date, filename, size, sha256 = sys.argv[1:7]
notes = sys.argv[7:]

with open(manifest_path) as f:
    manifest = json.load(f)

entry = {
    "version": version,
    "date": date,
    "file": filename,
    "size_bytes": int(size),
    "sha256": sha256,
    "notes": list(notes)
}

manifest["channels"]["stable"].insert(0, entry)

with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")

print(f"manifest.json updated — {version} is now the default stable release.")
EOF

# ── next steps ────────────────────────────────────────────────────────────────
echo ""
echo "Ready to ship. Run:"
echo "  git add ."
echo "  git commit -m \"Add firmware $VERSION\""
echo "  git push"
