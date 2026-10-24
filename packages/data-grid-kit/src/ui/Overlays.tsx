import { useBase } from './base'
import type { CSSProperties } from 'react'
import type { GridInstance } from '../core'
import { cx } from './cx'

export interface OverlayProps {
  className?: string
  style?: CSSProperties
}
export interface ErrorOverlayProps extends OverlayProps {
  message: string
  onRetry: () => void
}
export interface NoRowsOverlayProps<R> extends OverlayProps {
  grid: GridInstance<R>
}

/** The thin bar shown while server-side rows load. */
export function LoadingBar({ className, style }: OverlayProps) {
  return <div className={cx('gk-loading', className)} style={style} role="progressbar" aria-label="Loading rows" />
}

export function ErrorBanner({ message, onRetry, className, style }: ErrorOverlayProps) {
  const { Button } = useBase()
  return (
    <div className={cx('gk-error', className)} style={style} role="alert">
      <span>Could not load rows: {message}</span>
      <Button type="button" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

/** What the body shows when there is nothing to show: a hint in pivot mode, otherwise "No rows". */
export function EmptyState<R>({ grid, className, style }: NoRowsOverlayProps<R>) {
  const { pivot, state, rows, server } = grid
  if (pivot && (state.pivotModel.rows.length === 0 || pivot.columns.length === 0)) {
    return (
      <div className={cx('gk-empty', className)} style={style}>
        {state.pivotModel.rows.length === 0 ? 'Add a field as a row' : 'Add a field as a value'} in the Pivot panel to fill the table.
      </div>
    )
  }
  return rows.length === 0 && !server?.loading && !server?.error ? <div className={cx('gk-empty', className)} style={style}>No rows</div> : null
}
