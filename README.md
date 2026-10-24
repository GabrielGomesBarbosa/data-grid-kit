# data-grid-kit

[![CI](https://github.com/GabrielGomesBarbosa/data-grid-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/GabrielGomesBarbosa/data-grid-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A headless-first, high-performance React data grid with advanced features (virtualization, grouping, tree data, pivoting, aggregation, clipboard,
server-side data, Excel export) that you can restyle and rearrange to fit your own design system.

**Goal:** be to data tables what MUI Base is to MUI: behaviour, accessibility and performance already solved, with *no imposed look*, so that teams building a
design system do not have to write a grid from scratch.

**Docs and live demos: https://gabrielgomesbarbosa.github.io/data-grid-kit/**

> Work in progress (0.x). Not published to npm yet. The roadmap is in the [issues](https://github.com/GabrielGomesBarbosa/data-grid-kit/issues) and the project board.

## What is in this repository

| Path | What it is |
|---|---|
| [`packages/data-grid-kit`](packages/data-grid-kit) | The library: what gets built and published to npm. Its README is the npm page. |
| [`apps/docs`](apps/docs) | Documentation site: introduction, live demos with source, feature status, API tables, benchmarks. |
| [`apps/react-example`](apps/react-example) | A Vite + React app using the library like a consumer would. |
| [`apps/next-example`](apps/next-example) | A Next.js (App Router) app: server-side rendering, server-side data through a Route Handler. |

It is a [Turborepo](https://turbo.build) with npm workspaces.

## Getting started

Requires Node 20 or newer.

```bash
npm install
npm run dev                        # docs site (hot reload of the library source) → http://localhost:5300
npm run dev -w react-example       # React example → http://localhost:5400
npm run build && npm run dev -w next-example   # Next.js example → http://localhost:5500 (needs the library built)
```

| Command | What it does |
|---|---|
| `npm run build` | Build the library, the docs and both examples, in dependency order (cached) |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm test` | Unit and randomised tests (incremental updates are fuzzed against a full rebuild) |
| `npm run check` | Typecheck + test + build: what CI runs |
| `npm run bench` | Node benchmarks of the library |

## Contributing

Issues and ideas are welcome. Every change to the library is expected to keep the tests green and to add or update tests together with the code. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). data-grid-kit is independent and does not contain MUI X source code.
