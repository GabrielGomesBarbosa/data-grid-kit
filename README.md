# data-grid-kit

A headless-first, high-performance React data grid with advanced features (virtualization, grouping, tree data, pivoting,
aggregation, clipboard, server-side data, Excel export) that is meant to be restyled and rearranged to fit your own design system.

> Work in progress: the library is not published to npm yet. See the [issues](https://github.com/GabrielGomesBarbosa/data-grid-kit/issues) and the project board for the roadmap.

## Repository layout (Turborepo)

| Path | What it is |
|---|---|
| [`packages/data-grid-kit`](packages/data-grid-kit) | The library. This is what gets built and published to npm. |
| [`apps/docs`](apps/docs) | Documentation site with live demos, feature status, API tables and benchmarks. |
| `apps/react-example` | A React (Vite) app using the library like a consumer would. |
| `apps/next-example` | A Next.js app using the library (SSR). |

## Working in the repository

```bash
npm install
npm run dev        # docs site with hot reload of the library source
npm run build      # build everything in dependency order (cached by Turborepo)
npm run typecheck
npm test
npm run check      # typecheck + test + build, what CI runs
npm run bench      # Node benchmarks of the library
```

Every change to the library is expected to keep the tests green; add or update tests together with the code.
