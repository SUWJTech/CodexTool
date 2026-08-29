#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

ensure_state_root
seed_bundled_presets
printf 'CodexTool Dream Skin presets are ready.\n'
