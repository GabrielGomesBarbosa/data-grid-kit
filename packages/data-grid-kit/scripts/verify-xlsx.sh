#!/bin/sh
# Writes sample workbooks and re-reads them with openpyxl. Needs python3 with openpyxl; run from packages/data-grid-kit.
set -e
dir=$(mktemp -d)
npx tsx scripts/xlsx-fixture.ts "$dir"
python3 scripts/verify_xlsx.py "$dir"
