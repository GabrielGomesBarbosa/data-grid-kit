import { buildXlsx, type XlsxOptions, type XlsxRow, type XlsxSheet } from './xlsx'

/** What the page sends to the worker (everything is structured-cloneable: rows are arrays, dates stay dates). */
export type XlsxWorkerRequest =
  | { type: 'start'; sheet: Omit<XlsxSheet, 'rows'>; options: { compress?: boolean } }
  /** the rows come in batches, so the page never has to clone a whole data set in one go */
  | { type: 'rows'; rows: XlsxRow[] }
  | { type: 'end' }
  | { type: 'abort' }

export type XlsxWorkerResponse =
  | { type: 'progress'; rows: number }
  | { type: 'done'; bytes: Uint8Array }
  | { type: 'error'; name: string; message: string }

/** The part of a worker's global scope this needs (so it can be tested without a real worker). */
export interface XlsxWorkerScope {
  postMessage(message: XlsxWorkerResponse, transfer?: Transferable[]): void
  onmessage: ((event: { data: XlsxWorkerRequest }) => void) | null
}

/**
 * Makes a worker build workbooks for `getXlsx({ worker })` / `exportXlsx({ worker })`. Call it once, in the worker file
 * (or use the ready-made `data-grid-kit/xlsx-worker`, which does).
 */
export function setupXlsxWorker(scope: XlsxWorkerScope = self as unknown as XlsxWorkerScope): void {
  let abort: AbortController | null = null
  let start: Extract<XlsxWorkerRequest, { type: 'start' }> | null = null
  let rows: XlsxRow[] = []
  scope.onmessage = ({ data }) => {
    if (data.type === 'abort') return abort?.abort()
    if (data.type === 'start') {
      abort = new AbortController()
      start = data
      rows = []
      return
    }
    if (data.type === 'rows') {
      for (const row of data.rows) rows.push(row)
      return
    }
    if (!start || !abort) return
    const options: XlsxOptions = {
      compress: start.options.compress,
      signal: abort.signal,
      onProgress: (written) => scope.postMessage({ type: 'progress', rows: written }),
    }
    buildXlsx({ ...start.sheet, rows }, options).then(
      (bytes) => scope.postMessage({ type: 'done', bytes }, [bytes.buffer as ArrayBuffer]),
      (err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err))
        scope.postMessage({ type: 'error', name: e.name, message: e.message })
      },
    )
  }
}
