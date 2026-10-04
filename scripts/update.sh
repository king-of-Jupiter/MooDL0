#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BUILD_CONFIG_REPOSITORY_URL="$(sed -n 's/.*"repositoryUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT_DIR/js/build_config.js" 2>/dev/null | head -n 1)"
REPOSITORY_URL="${REPOSITORY_URL:-${EXTENSION_REPOSITORY_URL:-${BUILD_CONFIG_REPOSITORY_URL:-https://github.com/king-of-Jupiter/MooDL0}}}"
ARTIFACT_NAME="${ARTIFACT_NAME:-moodl0-extension.zip}"

cd "$ROOT_DIR"

if command -v curl >/dev/null 2>&1; then
  DOWNLOADER="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  DOWNLOADER="wget -qO-"
else
  echo "curl or wget is required."
  exit 1
fi

normalize_repo_slug() {
  printf '%s' "$1" \
    | sed 's#^https://github.com/##' \
    | sed 's#^https://api.github.com/repos/##' \
    | sed 's#\.git$##' \
    | sed 's#/*$##'
}

REPOSITORY_SLUG="$(normalize_repo_slug "$REPOSITORY_URL")"
case "$REPOSITORY_SLUG" in
  */*) ;;
  *)
  echo "Invalid REPOSITORY_URL: $REPOSITORY_URL"
  echo "Expected https://github.com/owner/repo or owner/repo."
  exit 1
  ;;
esac

API_URL="https://api.github.com/repos/$REPOSITORY_SLUG/releases/latest"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "MooDL0: locating latest GitHub Release for $REPOSITORY_SLUG..."
if ! RELEASE_JSON="$($DOWNLOADER "$API_URL")"; then
  echo "Could not load latest release from $API_URL"
  echo "Check REPOSITORY_URL/EXTENSION_REPOSITORY_URL and that the repository has a published GitHub Release."
  exit 1
fi
DOWNLOAD_URL="$(printf '%s' "$RELEASE_JSON" | sed -n 's/.*"browser_download_url": "\(.*'"$ARTIFACT_NAME"'\)".*/\1/p' | head -n 1)"

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Could not find $ARTIFACT_NAME in latest release."
  exit 1
fi

echo "MooDL0: downloading $ARTIFACT_NAME..."
$DOWNLOADER "$DOWNLOAD_URL" > "$TMP_DIR/$ARTIFACT_NAME"

echo "MooDL0: replacing extension files..."
unzip -oq "$TMP_DIR/$ARTIFACT_NAME" -d "$ROOT_DIR"

echo "Done. Open chrome://extensions/ and reload MooDL0."
