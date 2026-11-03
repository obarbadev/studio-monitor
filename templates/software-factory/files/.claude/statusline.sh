#!/usr/bin/env bash
# Fábrica de Software: display only. Metrics are mirrored by the installer's bridge.
exec python3 "$(dirname "$0")/statusline.py"
