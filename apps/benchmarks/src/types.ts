import type { Person } from './data'

/** What every adapter gives the runner: the same few controls over a different library. */
export interface Controls {
  /** sort by a column; direction 'asc' or 'desc' */
  sort(field: string, direction: 'asc' | 'desc'): void
  /** the quick search / global filter */
  quickFilter(text: string): void
  /** the element that scrolls the rows */
  scroller(): HTMLElement | null
  /** a short text that changes when the rows shown change (the first rows' text) */
  signature(): string
  /** how many row elements are in the DOM */
  rowElements(): number
}

export interface AdapterProps {
  rows: Person[]
  onReady(controls: Controls): void
}
