// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildXlsx, type XlsxSheet } from './xlsx'
import { setupXlsxWorker, type XlsxWorkerRequest, type XlsxWorkerResponse, type XlsxWorkerScope } from './xlsxWorker'
import { buildXlsxInWorker, type XlsxWorkerLike } from './xlsxWorkerClient'

/** A worker whose other end is the real `setupXlsxWorker`, with messages cloned like a real worker does. */
function fakeWorker() {
  const log = { terminated: false, posted: [] as XlsxWorkerRequest[] }
  const worker: XlsxWorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage(message) {
      log.posted.push(message)
      queueMicrotask(() => scope.onmessage?.({ data: structuredClone(message) }))
    },
    terminate() {
      log.terminated = true
    },
  }
  const scope: XlsxWorkerScope = {
    onmessage: null,
    postMessage(message: XlsxWorkerResponse) {
      if (!log.terminated) queueMicrotask(() => worker.onmessage?.({ data: message }))
    },
  }
  setupXlsxWorker(scope)
  return { worker, log }
}

const sheet = (n: number): XlsxSheet => ({
  columns: [{ header: 'Name' }, { header: 'When' }, { header: 'N' }],
  rows: Array.from({ length: n }, (_, i) => ({ cells: [`row ${i}`, new Date(2024, 0, 1 + (i % 28)), i] })),
})

describe('xlsx worker', () => {
  it('builds the same workbook as the main thread, and ends the worker', async () => {
    const { worker, log } = fakeWorker()
    const viaWorker = await buildXlsxInWorker(sheet(50), { compress: false }, () => worker)
    const direct = await buildXlsx(sheet(50), { compress: false })
    expect(viaWorker.length).toBe(direct.length)
    expect(String.fromCharCode(viaWorker[0]!, viaWorker[1]!)).toBe('PK')
    expect(log.terminated).toBe(true)
  })

  it('sends the rows in batches as plain data (dates stay dates) and reports progress', async () => {
    const { worker, log } = fakeWorker()
    const seen: number[] = []
    await buildXlsxInWorker(sheet(10_000), { compress: false, onProgress: (n) => seen.push(n) }, () => worker)
    const batches = log.posted.filter((m) => m.type === 'rows')
    expect(log.posted[0]!.type).toBe('start')
    expect(log.posted[log.posted.length - 1]!.type).toBe('end')
    expect(batches.length).toBe(10) // 1,000 rows each
    const first = batches[0]!
    if (first.type === 'rows') expect(first.rows[0]!.cells[1]).toBeInstanceOf(Date)
    expect(seen[seen.length - 1]).toBe(10_000)
  })

  it('an abort terminates the worker and rejects with AbortError', async () => {
    const { worker, log } = fakeWorker()
    const ctl = new AbortController()
    const p = buildXlsxInWorker(sheet(100), { signal: ctl.signal }, () => worker)
    ctl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    expect(log.terminated).toBe(true)
  })

  it('an already aborted signal never creates the worker', async () => {
    const ctl = new AbortController()
    ctl.abort()
    let created = false
    await expect(
      buildXlsxInWorker(sheet(1), { signal: ctl.signal }, () => {
        created = true
        return fakeWorker().worker
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(created).toBe(false)
  })

  it('a failure inside the worker rejects with its message', async () => {
    const { worker, log } = fakeWorker()
    const tooWide: XlsxSheet = { columns: Array.from({ length: 16_385 }, (_, i) => ({ header: String(i) })), rows: [] }
    await expect(buildXlsxInWorker(tooWide, {}, () => worker)).rejects.toThrow(/at most 16384 columns/)
    expect(log.terminated).toBe(true)
  })

  it('a row source that throws rejects and ends the worker', async () => {
    const { worker, log } = fakeWorker()
    const bad: XlsxSheet = {
      columns: [{ header: 'A' }],
      rows: (function* () {
        yield { cells: ['ok'] }
        throw new Error('cannot read row')
      })(),
    }
    await expect(buildXlsxInWorker(bad, {}, () => worker)).rejects.toThrow('cannot read row')
    expect(log.terminated).toBe(true)
  })

  it('a worker that cannot start rejects instead of hanging', async () => {
    const dead: XlsxWorkerLike = { onmessage: null, onerror: null, postMessage() {}, terminate() {} }
    const p = buildXlsxInWorker(sheet(1), {}, () => {
      queueMicrotask(() => dead.onerror?.({ message: 'blocked by CSP' }))
      return dead
    })
    await expect(p).rejects.toThrow('blocked by CSP')
  })
})
