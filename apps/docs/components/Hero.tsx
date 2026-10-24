import { CodeBlock } from './CodeBlock'

const cards = [
  { href: '#/virtualization', title: 'Fast by design', text: 'Rows and columns are virtualized, edits are applied incrementally, and every number on the performance page can be measured in your browser.' },
  { href: '#/headless', title: 'Headless core', text: 'A store, a row pipeline and layout math with no UI. Build your own markup on top, or use the ready-made grid.' },
  { href: '#/grouping', title: 'Grouping, trees, pivot', text: 'Row grouping, tree data, aggregation and pivot tables with nested column groups, all updated incrementally.' },
  { href: '#/server-side-data', title: 'Server-side data', text: 'Let the server sort, filter and page. Lazy loading with a block cache, request aborting and infinite scroll.' },
  { href: '#/excel-export', title: 'Excel and CSV export', text: 'A dependency-free .xlsx writer with typed cells, number formats, merged headers and collapsible group rows.' },
  { href: '#/features', title: 'Honest status', text: 'Every feature lists what works and what does not yet. No surprises after you pick it.' },
]

/** The first screen of the documentation. */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="eyebrow">React data grid</p>
      <h1 id="hero-title">The data grid your design system doesn’t have to build</h1>
      <p className="hero-lead">
        Advanced features and speed, with behaviour and accessibility already solved, and a look that is yours. Headless core, optional UI, no UI-library dependency.
      </p>
      <p className="hero-actions">
        <a className="btn primary" href="#/quickstart">
          Get started
        </a>
        <a className="btn" href="#/features">
          Feature status
        </a>
        <a className="btn" href="https://github.com/GabrielGomesBarbosa/data-grid-kit">
          GitHub
        </a>
      </p>
      <CodeBlock title="tsx" code={`import { Grid } from 'data-grid-kit'\nimport 'data-grid-kit/styles.css'\n\n<Grid rows={rows} columns={columns} getRowId={(r) => r.id} height={400} toolbar />`} />
      <div className="cards">
        {cards.map((c) => (
          <a key={c.href} className="card" href={c.href}>
            <strong>{c.title}</strong>
            <span>{c.text}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
