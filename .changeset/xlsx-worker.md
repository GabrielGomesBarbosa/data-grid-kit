---
'data-grid-kit': minor
---

Excel export in a web worker: `getXlsx` / `exportXlsx` accept `worker: () => new Worker(...)`. The package ships a ready worker, `data-grid-kit/xlsx-worker` (self-contained, about 10 KB, no React), and `setupXlsxWorker()` in `data-grid-kit/core` for your own worker file. Rows are sent in batches so the page stays responsive; abort, progress and errors work as without a worker.
