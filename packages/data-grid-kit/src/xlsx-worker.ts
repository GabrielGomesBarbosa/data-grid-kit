// The ready-made worker: `new Worker(new URL('data-grid-kit/xlsx-worker', import.meta.url), { type: 'module' })`
import { setupXlsxWorker } from './core/xlsxWorker'

setupXlsxWorker()
