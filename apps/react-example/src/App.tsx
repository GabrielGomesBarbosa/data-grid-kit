import { useEffect, useState } from 'react'
import { StressPage } from './StressPage'
import { TeamPage } from './TeamPage'

const pages = { team: 'People directory', stress: 'Stress test' } as const
type PageId = keyof typeof pages
type Theme = 'system' | 'light' | 'dark'

/** the theme the visitor picked, kept for the next visit (storage can be blocked: the system theme still works) */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('example-theme')
      return t === 'light' || t === 'dark' ? t : 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      if (theme === 'system') localStorage.removeItem('example-theme')
      else localStorage.setItem('example-theme', theme)
    } catch {
      /* applied, not remembered */
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'system' ? 'dark' : t === 'dark' ? 'light' : 'system'))]
}

const Mark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M3 9h18M3 15h18M10 3v18" />
  </svg>
)

export function App() {
  const [page, setPage] = useState<PageId>('team')
  const [theme, cycleTheme] = useTheme()
  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark">
              <Mark />
            </span>
            <span>
              data-grid-kit
              <small>React example</small>
            </span>
          </div>
          <div className="tabs" role="tablist">
            {(Object.keys(pages) as PageId[]).map((id) => (
              <button key={id} role="tab" aria-selected={page === id} onClick={() => setPage(id)}>
                {pages[id]}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <a className="repo" href="https://github.com/GabrielGomesBarbosa/data-grid-kit">
            GitHub
          </a>
          <button className="icon-btn" onClick={cycleTheme} aria-label={`Theme: ${theme}. Click to change`} title={`Theme: ${theme}`}>
            {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
          </button>
        </div>
      </header>
      <main>{page === 'team' ? <TeamPage /> : <StressPage />}</main>
    </>
  )
}
