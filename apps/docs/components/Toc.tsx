import { useEffect, useState } from 'react'

export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

/** "On this page": the headings of the current page, with the one being read highlighted. */
export function Toc({ items, pageId }: { items: TocItem[]; pageId: string }) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (!items.length) return
    let raf = 0
    const update = () => {
      raf = 0
      let current = items[0]!.id
      for (const it of items) {
        const el = document.getElementById(it.id)
        if (el && el.getBoundingClientRect().top <= 110) current = it.id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [items])

  if (items.length < 2) return null
  return (
    <nav className="toc" aria-label="On this page">
      <p>On this page</p>
      <ul>
        {items.map((it) => (
          <li key={it.id} data-level={it.level}>
            <a href={`#/${pageId}/${it.id}`} aria-current={active === it.id ? 'location' : undefined}>
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
