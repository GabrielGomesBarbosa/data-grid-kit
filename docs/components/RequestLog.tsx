import { useSyncExternalStore } from 'react'
import type { FakeServer } from '../fakeServer'

/** What the grid asked the (fake) server: this is where caching, aborting and prefetching become visible. */
export function RequestLog({ server }: { server: FakeServer }) {
  useSyncExternalStore(server.subscribe, () => server.records())
  const records = server.records()
  const counts = server.counts()
  const latency = server.getLatency()
  return (
    <aside className="reqlog" aria-label="Requests sent to the fake server">
      <div className="reqlog-head">
        <strong>Requests</strong>
        <span className="muted">
          {counts.sent} sent · {counts.aborted} aborted · {counts.failed} failed
        </span>
      </div>
      <div className="reqlog-controls">
        <label>
          Server delay{' '}
          <select value={latency} onChange={(e) => server.setLatency(Number(e.target.value))}>
            <option value={50}>50 ms</option>
            <option value={400}>400 ms</option>
            <option value={1500}>1.5 s</option>
            <option value={4000}>4 s</option>
          </select>
        </label>
        <button type="button" onClick={() => server.failNext()}>
          Fail the next request
        </button>
      </div>
      <ol className="reqlog-list" aria-live="off">
        {records.length === 0 && <li className="muted">Nothing asked yet.</li>}
        {records.slice(0, 12).map((r) => (
          <li key={r.id} data-status={r.status}>
            <span className="reqlog-status">{r.status === 'pending' ? '…' : r.status === 'done' ? '✓' : r.status === 'aborted' ? '⊘' : '✕'}</span>
            <span className="reqlog-text">{r.text}</span>
            <span className="muted">{r.ms === null ? '' : `${r.ms} ms`}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
