import type { GridInstance } from '../core'

/** The thin bar shown while server-side rows load. */
export function LoadingBar() {
  return <div className="gk-loading" role="progressbar" aria-label="Loading rows" />
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="gk-error" role="alert">
      <span>Could not load rows: {message}</span>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

/** What the body shows when there is nothing to show: a hint in pivot mode, otherwise "No rows". */
export function EmptyState<R>({ grid }: { grid: GridInstance<R> }) {
  const { pivot, state, rows, server } = grid
  if (pivot && (state.pivotModel.rows.length === 0 || pivot.columns.length === 0)) {
    return (
      <div className="gk-empty">
        {state.pivotModel.rows.length === 0 ? 'Add a field as a row' : 'Add a field as a value'} in the Pivot panel to fill the table.
      </div>
    )
  }
  return rows.length === 0 && !server?.loading && !server?.error ? <div className="gk-empty">No rows</div> : null
}
