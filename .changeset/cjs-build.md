---
'data-grid-kit': patch
---

The package now ships ESM and CommonJS builds (`require('data-grid-kit')` works) with matching type declarations (`.d.ts` / `.d.cts`) and a `typesVersions` fallback for `data-grid-kit/core` under classic `node10` resolution. Both formats share one copy of the code between the two entries, so `instanceof` checks (for example `DataSourceError`) agree. `publint` and `arethetypeswrong` run as part of `npm run check`.
