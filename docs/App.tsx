import { useEffect, useMemo, useState } from 'react'
import { pages, type PageDef } from './pages'

type Theme = 'system' | 'light' | 'dark'

function useTheme(): [Theme, (t: Theme) => void] {
  const read = (): Theme => {
    try {
      const t = localStorage.getItem('gridkit-theme')
      return t === 'light' || t === 'dark' ? t : 'system'
    } catch {
      return 'system' // storage can be blocked: the system theme still works
    }
  }
  const [theme, setTheme] = useState<Theme>(read)
  const apply = (t: Theme) => {
    setTheme(t)
    const root = document.documentElement
    if (t === 'system') delete root.dataset.theme
    else root.dataset.theme = t
    try {
      if (t === 'system') localStorage.removeItem('gridkit-theme')
      else localStorage.setItem('gridkit-theme', t)
    } catch {
      /* not persisted, still applied */
    }
  }
  return [theme, apply]
}

const GROUPS: PageDef['group'][] = ['Getting started', 'Main features', 'Advanced features', 'Guides', 'Reference']

function useHashRoute(): [string, (id: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'overview'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [route, (id) => (window.location.hash = `/${id}`)]
}

export default function App() {
  const [route, go] = useHashRoute()
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const page = pages.find((p) => p.id === route) ?? pages[0]!
  const index = pages.indexOf(page)
  const prev = pages[index - 1]
  const next = pages[index + 1]
  const nav = useMemo(() => GROUPS.map((g) => ({ group: g, items: pages.filter((p) => p.group === g) })), [])

  useEffect(() => {
    document.title = `${page.title} — gridkit`
    window.scrollTo(0, 0)
    setMenuOpen(false)
  }, [page])

  return (
    <div className="shell">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="topbar">
        <button type="button" className="menu-toggle" aria-expanded={menuOpen} aria-controls="sidebar" onClick={() => setMenuOpen((o) => !o)}>
          ☰ Menu
        </button>
        <a className="brand" href="#/overview">
          gridkit
        </a>
        <span className="muted tag">headless-first React data grid</span>
        <div className="theme-toggle" role="group" aria-label="Color theme">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </header>
      <nav id="sidebar" className="sidebar" data-open={menuOpen} aria-label="Documentation">
        {nav.map(({ group, items }) => (
          <div key={group}>
            <h2>{group}</h2>
            <ul>
              {items.map((p) => (
                <li key={p.id}>
                  <a href={`#/${p.id}`} aria-current={p.id === page.id ? 'page' : undefined} onClick={() => go(p.id)}>
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <main id="content" className="content">
        <p className="crumb">{page.group}</p>
        <h1>{page.title}</h1>
        <p className="lead">{page.intro}</p>
        {page.body()}
        <footer className="pager">
          {prev ? <a href={`#/${prev.id}`}>← {prev.title}</a> : <span />}
          {next ? <a href={`#/${next.id}`}>{next.title} →</a> : <span />}
        </footer>
      </main>
    </div>
  )
}
