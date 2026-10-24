import { useBase } from './base'
import type { CSSProperties } from 'react'
import { visiblePivot, type GridInstance } from '../core'
import { cx } from './cx'
import { useLocaleText } from './localeContext'

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
  const { text } = useLocaleText()
  return <div className={cx('gk-loading', className)} style={style} role="progressbar" aria-label={text.loadingRows} />
}

export function ErrorBanner({ message, onRetry, className, style }: ErrorOverlayProps) {
  const { Button } = useBase()
  const { text } = useLocaleText()
  return (
    <div className={cx('gk-error', className)} style={style} role="alert">
      <span>{text.errorLoadingRows(message)}</span>
      <Button type="button" onClick={onRetry}>
        {text.errorRetry}
      </Button>
    </div>
  )
}

/** What the body shows when there is nothing to show: no columns, a hint in pivot mode, otherwise "No rows". */
export function EmptyState<R>({ grid, className, style }: NoRowsOverlayProps<R>) {
  const { pivot, state, rows, server, text } = grid
  if (!pivot && grid.layout.all.length === 0) {
    return (
      <div className={cx('gk-empty gk-no-columns', className)} style={style}>
        <p>{text.noColumns}</p>
        <p className="gk-muted">{text.noColumnsHint}</p>
      </div>
    )
  }
  const shownRows = visiblePivot(state.pivotModel).rows.length
  if (pivot && (shownRows === 0 || pivot.columns.length === 0)) {
    return (
      <div className={cx('gk-empty', className)} style={style}>
        {shownRows === 0 ? text.pivotNeedsRows : text.pivotNeedsValues}
      </div>
    )
  }
  return rows.length === 0 && !server?.loading && !server?.error ? <div className={cx('gk-empty', className)} style={style}>{text.noRows}</div> : null
}
