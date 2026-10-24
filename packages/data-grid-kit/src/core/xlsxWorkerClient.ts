import type { XlsxOptions, XlsxRow, XlsxSheet } from './xlsx'
import type { XlsxWorkerRequest, XlsxWorkerResponse } from './xlsxWorker'

// method-style so that a real `Worker` (whose handlers take a MessageEvent) is assignable, as React does for its event handlers
type Handler<E> = { bivarianceHack(event: E): void }['bivarianceHack']

/** The worker as far as this needs it (a real `Worker` fits). */
export interface XlsxWorkerLike {
  postMessage(message: XlsxWorkerRequest): void
  terminate(): void
  onmessage: Handler<{ data: XlsxWorkerResponse }> | null
  onerror: Handler<{ message?: string }> | null
}

const BATCH = 1000
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * Build the workbook in a worker made by `create`. The rows are read here (they come from the grid) and sent in batches,
 * with a break between them so the page stays responsive; the bytes come back transferred, not copied. The worker lives
 * for one export. Aborting terminates it.
 */
export function buildXlsxInWorker(sheet: XlsxSheet, options: XlsxOptions, create: () => XlsxWorkerLike): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const abortError = () => new DOMException('Export aborted', 'AbortError')
    if (options.signal?.aborted) return reject(abortError())
    const worker = create()
    let over = false
    const finish = () => {
      over = true
      options.signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }
    const fail = (error: unknown) => {
      if (over) return
      finish()
      reject(error)
    }
    const onAbort = () => fail(abortError())
    options.signal?.addEventListener('abort', onAbort)
    worker.onmessage = ({ data }) => {
      if (over || data.type === 'progress') return data.type === 'progress' ? options.onProgress?.(data.rows) : undefined
      finish()
      if (data.type === 'done') resolve(data.bytes)
      else reject(data.name === 'AbortError' ? abortError() : Object.assign(new Error(data.message), { name: data.name }))
    }
    worker.onerror = (e) => fail(new Error(e.message || 'The export worker failed'))

    void (async () => {
      try {
        const { rows, ...rest } = sheet
        worker.postMessage({ type: 'start', sheet: rest, options: { compress: options.compress } })
        let batch: XlsxRow[] = []
        for (const row of rows) {
          batch.push(row)
          if (batch.length >= BATCH) {
            if (over) return
            worker.postMessage({ type: 'rows', rows: batch })
            batch = []
            await tick()
          }
        }
        if (over) return
        if (batch.length) worker.postMessage({ type: 'rows', rows: batch })
        worker.postMessage({ type: 'end' })
      } catch (err) {
        fail(err) // the rows come from the grid: reading them can throw
      }
    })()
  })
}
