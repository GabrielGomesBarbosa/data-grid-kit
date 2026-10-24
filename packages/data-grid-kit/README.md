# data-grid-kit

A **headless-first, high-performance React data grid** with advanced features, built to be restyled and rearranged to fit your own design system.

- **Headless core** (`data-grid-kit/core`): a store, a memoised row pipeline and layout math with no UI, plus the `useGrid` hook. Build any table on top of it.
- **Ready-made grid** (`data-grid-kit`): a virtualized, accessible `Grid` component using that core, with an optional stylesheet.
- No dependency on any UI library. Peer dependency: `react >= 18`.

> **Status: pre-release (0.x).** Not published to npm yet; the API will change while the customization architecture (slots, unstyled mode, prop getters) lands. Follow the [roadmap](https://github.com/GabrielGomesBarbosa/data-grid-kit/issues).

## Install

Until the first npm release, build it from the repository:

```bash
git clone https://github.com/GabrielGomesBarbosa/data-grid-kit && cd data-grid-kit
npm install && npm run build
cd packages/data-grid-kit && npm pack     # then install the .tgz in your app
```

## Quick start

```tsx
import { Grid, type UIColumnDef } from 'data-grid-kit'
import 'data-grid-kit/styles.css'

interface Person { id: number; name: string; age: number }

const columns: UIColumnDef<Person>[] = [
  { field: 'name', headerName: 'Name', width: 200, editable: true },
  { field: 'age', headerName: 'Age', type: 'number' },
]

export function People({ rows }: { rows: Person[] }) {
  return <Grid rows={rows} columns={columns} getRowId={(r) => r.id} height={400} toolbar />
}
```

Headless (your own markup, driven by the core):

```tsx
import { useGrid } from 'data-grid-kit/core'

const grid = useGrid({ rows, columns, getRowId: (r) => r.id })
// grid.rows, grid.layout, grid.api.toggleSort(...), grid.state ...
```

Next.js: import the grid from a file marked `"use client"`; see [`apps/next-example`](../../apps/next-example).

## Features

| Area | What you get |
|---|---|
| Basics | Sorting (multi-column), typed filtering (filter panel, quick filter), pagination, row selection, cell editing, keyboard navigation with ARIA grid roles, column menu, columns panel, toolbar, resize, hide, CSV export |
| Scale | Row and column virtualization, incremental live updates (insert / edit / remove without rebuilding) |
| Layout | Column pinning, row pinning, column reordering by drag, detail panels, row reordering |
| Hierarchy | Tree data, row grouping, aggregation (sum, avg, min, max, count, size, custom), pivoting with nested column groups |
| Spreadsheet-like | Cell range selection, clipboard (copy, cut, paste), fill handle |
| Data | Server-side data (`dataSource.getRows`) with lazy loading, block cache, abort, retry, infinite scroll |
| Localization | `localeText` (every fixed text, strings or functions), `locale` for numbers and dates, a Brazilian Portuguese pack (`data-grid-kit/locales`) |
| Export | CSV and dependency-free **.xlsx** (typed cells, number formats, merged column groups, outline levels) |

Every feature has a documented status and its known limits on the docs feature-status page.

## Localization

```tsx
import { ptBR } from 'data-grid-kit/locales'

<Grid rows={rows} columns={columns} {...ptBR} />                         {/* a pack: texts + locale */}
<Grid rows={rows} columns={columns} locale="de-DE" localeText={de} />   {/* your own keys; the rest stays in English */}
```

`localeText` keys are strings, or functions when a text has a name or a number in it, so react-intl and next-intl fit as they are. Keep the object the same between renders. See the Localization page of the docs.

## Performance

Measured in Node (`npm run bench` at the repository root), 100,000 rows: build a sorted flat list ≈ 18 ms, group by two columns with aggregation ≈ 50 ms, pivot ≈ 35 ms, edit one value in a live grid ≈ 0.3 ms. The docs include a benchmark you can run in your own browser.

## Customization

The goal is to work like an unstyled component library: your look, your markup where you need it, the grid's behaviour and speed underneath. Today you can restyle with the optional stylesheet's CSS variables, use `renderCell` / `renderDetailPanel`, or go fully headless with `data-grid-kit/core`. Slots, `slotProps`, prop getters and a no-styles-by-default mode are in progress (epic #29).

## Independent project

data-grid-kit is an independent project. It is inspired by the feature set of MUI X Data Grid, but **does not contain or copy MUI X source code** (in particular none of the Pro / Premium code, whose license forbids that).

## License

[MIT](./LICENSE)
