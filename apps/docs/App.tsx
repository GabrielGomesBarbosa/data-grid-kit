import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import pkg from '../../packages/data-grid-kit/package.json'
import { pages, type PageDef } from './pages'
import { Hero } from './components/Hero'
import { SearchDialog } from './components/Search'
import { Toc, type TocItem } from './components/Toc'

type Theme = 'system' | 'light' | 'dark'

function useTheme(): [Theme, (t: Theme) => void] {
  const read = (): Theme => {
    try {
      const t = localStorage.getItem('data-grid-kit-theme')
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
      if (t === 'system') localStorage.removeItem('data-grid-kit-theme')
      else localStorage.setItem('data-grid-kit-theme', t)
    } catch {
      /* not persisted, still applied */
    }
  }
  return [theme, apply]
}

const GROUPS: PageDef['group'][] = ['Getting started', 'Demos', 'Main features', 'Advanced features', 'Guides', 'Reference']
/** pages for features added recently */
const NEW = new Set(['localization', 'pivoting', 'excel-export', 'server-side-data', 'demo-real-time', 'demo-time-off', 'demo-inventory'])
const REPO = 'https://github.com/GabrielGomesBarbosa/data-grid-kit'

/** `#/page` or `#/page/section` */
function useHashRoute(): { page: string; section: string | null } {
  const read = () => {
    const [page, section] = window.location.hash.replace(/^#\/?/, '').split('/')
    return { page: page || 'overview', section: section || null }
  }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export default function App() {
  const { page: pageId, section } = useHashRoute()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [toc, setToc] = useState<TocItem[]>([])
  const [theme, setTheme] = useTheme()
  const page = pages.find((p) => p.id === pageId) ?? pages[0]!
  const index = pages.indexOf(page)
  const prev = pages[index - 1]
  const next = pages[index + 1]
  const nav = useMemo(() => GROUPS.map((g) => ({ group: g, items: pages.filter((p) => p.group === g) })), [])

  // arriving at a page (a link, search, previous / next) shows its group; collapsing a group by hand always works
  useEffect(() => {
    setClosed((c) => (c.has(page.group) ? new Set([...c].filter((g) => g !== page.group)) : c))
  }, [page.id, page.group])

  // a new page starts at the top; a new section of the same page scrolls to it
  useEffect(() => {
    document.title = `${page.title} | data-grid-kit`
    setMenuOpen(false)
  }, [page])

  // headings get ids and a link, and feed "On this page"
  useLayoutEffect(() => {
    const seen = new Map<string, number>()
    const items: TocItem[] = []
    document.querySelectorAll<HTMLHeadingElement>('#content h2, #content h3').forEach((h) => {
      if (h.closest('.demo, .hero, .cards')) return
      const text = (h.textContent ?? '').replace(/#$/, '').trim()
      let id = slug(text) || 'section'
      const n = seen.get(id) ?? 0
      seen.set(id, n + 1)
      if (n) id = `${id}-${n + 1}`
      h.id = id
      if (!h.querySelector('.anchor')) {
        const a = document.createElement('a')
        a.className = 'anchor'
        a.href = `#/${page.id}/${id}`
        a.setAttribute('aria-label', `Link to “${text}”`)
        a.textContent = '#'
        h.appendChild(a)
      } else {
        h.querySelector<HTMLAnchorElement>('.anchor')!.href = `#/${page.id}/${id}`
      }
      items.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 })
    })
    setToc(items)
  }, [page])

  useEffect(() => {
    if (!section) {
      window.scrollTo(0, 0)
      return
    }
    // demos above the target finish rendering after the first scroll and push it down: scroll again until the reader takes over
    const go = () => document.getElementById(section)?.scrollIntoView({ block: 'start' })
    go()
    const timers = [300, 900, 1800].map((ms) => window.setTimeout(go, ms))
    const stop = () => timers.forEach(clearTimeout)
    window.addEventListener('wheel', stop, { once: true, passive: true })
    window.addEventListener('touchstart', stop, { once: true, passive: true })
    window.addEventListener('keydown', stop, { once: true })
    return () => {
      stop()
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', stop)
    }
  }, [page, section, toc])

  // Ctrl/⌘ + K opens the search from anywhere
  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setSearching((s) => !s)
    }
  }, [])
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  const toggleGroup = (g: string) =>
    setClosed((c) => {
      const n = new Set(c)
      if (n.has(g)) n.delete(g)
      else n.add(g)
      return n
    })

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
          data-grid-kit
        </a>
        <span className="version" title="Version of the library in this repository">
          v{pkg.version}
        </span>
        <button type="button" className="search-open" onClick={() => setSearching(true)} aria-label="Search the documentation">
          <span>Search…</span>
          <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <a className="gh" href={REPO} aria-label="data-grid-kit on GitHub">
          GitHub
        </a>
        <div className="theme-toggle" role="group" aria-label="Color theme">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t === 'system' ? 'System' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </header>
      <nav id="sidebar" className="sidebar" data-open={menuOpen} aria-label="Documentation">
        {nav.map(({ group, items }) => {
          const open = !closed.has(group)
          return (
            <div key={group}>
              <h2>
                <button type="button" aria-expanded={open} onClick={() => toggleGroup(group)}>
                  <span>{group}</span>
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
              </h2>
              {open && (
                <ul>
                  {items.map((p) => (
                    <li key={p.id}>
                      <a href={`#/${p.id}`} aria-current={p.id === page.id ? 'page' : undefined}>
                        {p.title}
                        {NEW.has(p.id) && <span className="badge-new">New</span>}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </nav>
      <main id="content" className="content">
        {page.id === 'overview' ? (
          <Hero />
        ) : (
          <>
            <p className="crumb">{page.group}</p>
            <h1>{page.title}</h1>
            <p className="lead">{page.intro}</p>
          </>
        )}
        {page.body()}
        <p className="edit">
          <a href={`${REPO}/edit/main/apps/docs/pages.tsx`}>Edit this page on GitHub</a>
        </p>
        <footer className="pager">
          {prev ? (
            <a href={`#/${prev.id}`}>
              <small>Previous</small>← {prev.title}
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a href={`#/${next.id}`} className="next">
              <small>Next</small>
              {next.title} →
            </a>
          ) : (
            <span />
          )}
        </footer>
      </main>
      <Toc items={toc} pageId={page.id} />
      {searching && <SearchDialog onClose={() => setSearching(false)} />}
    </div>
  )
}
