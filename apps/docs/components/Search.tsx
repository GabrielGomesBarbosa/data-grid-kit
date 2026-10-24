import { useEffect, useMemo, useRef, useState } from 'react'
import { pages } from '../pages'
import { apiMethods, columnProps, gridProps } from '../api'

interface Entry {
  title: string
  sub: string
  href: string
  haystack: string
}

/** Everything searchable: each page, plus every prop, column option and API method by name. */
function buildIndex(): Entry[] {
  const out: Entry[] = pages.map((p) => ({
    title: p.title,
    sub: p.group,
    href: `#/${p.id}`,
    haystack: `${p.title} ${p.intro} ${p.group}`.toLowerCase(),
  }))
  const add = (rows: { name: string; description: string }[], sub: string) =>
    rows.forEach((r) => out.push({ title: r.name, sub, href: '#/api', haystack: `${r.name} ${r.description}`.toLowerCase() }))
  add(gridProps, 'Grid prop')
  add(columnProps, 'Column option')
  add(apiMethods, 'API method')
  return out
}

function score(e: Entry, words: string[]): number {
  let s = 0
  const title = e.title.toLowerCase()
  for (const w of words) {
    if (!e.haystack.includes(w)) return 0
    s += title === w ? 100 : title.startsWith(w) ? 40 : title.includes(w) ? 20 : 1
  }
  return s
}

export function SearchDialog({ onClose }: { onClose: () => void }) {
  const index = useMemo(buildIndex, [])
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return index.filter((e) => e.sub !== 'Grid prop' && e.sub !== 'Column option' && e.sub !== 'API method').slice(0, 8)
    return index
      .map((e) => [e, score(e, words)] as const)
      .filter(([, s]) => s > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([e]) => e)
  }, [index, q])

  useEffect(() => input.current?.focus(), [])
  useEffect(() => setAt(0), [q])

  const open = (e: Entry) => {
    window.location.hash = e.href.slice(1)
    onClose()
  }
  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') onClose()
    else if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      setAt((a) => Math.min(results.length - 1, a + 1))
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      setAt((a) => Math.max(0, a - 1))
    } else if (ev.key === 'Enter' && results[at]) open(results[at]!)
  }

  return (
    <div className="search-backdrop" onMouseDown={onClose}>
      <div className="search" role="dialog" aria-modal="true" aria-label="Search the documentation" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <input
          ref={input}
          type="search"
          placeholder="Search pages, props, API methods…"
          aria-label="Search"
          aria-controls="search-results"
          aria-activedescendant={results[at] ? `sr-${at}` : undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul id="search-results" role="listbox">
          {results.length === 0 && <li className="none">Nothing found for “{q}”</li>}
          {results.map((r, i) => (
            <li key={`${r.href}-${r.title}-${r.sub}`} id={`sr-${i}`} role="option" aria-selected={i === at} onMouseEnter={() => setAt(i)} onClick={() => open(r)}>
              <span>{r.title}</span>
              <small>{r.sub}</small>
            </li>
          ))}
        </ul>
        <p className="hint">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  )
}
