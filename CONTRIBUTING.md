# Contributing to data-grid-kit

Thanks for helping. This file explains how the repository works and what a good change looks like.

## Setup

Node 20 or newer, then:

```bash
npm install
npm run dev        # docs site with hot reload of the library
npm run check      # typecheck + test + build, the same as CI
```

Layout: `packages/data-grid-kit` (library), `apps/docs`, `apps/react-example`, `apps/next-example`. See the root README.

## Checks run locally (no CI minutes needed)

`npm install` sets `core.hooksPath` to `.githooks`, so **every `git push` first runs `npm run check`** (typecheck, lint, tests, builds of the library, docs and both examples; Turborepo skips what is cached). The GitHub Actions workflows are manual-only for now (`workflow_dispatch`); switch their triggers back when minutes are available. Publish the docs with `npm run docs:deploy` (builds and pushes the `gh-pages` branch).

## Definition of done

A change is done when:

1. **Tests are updated.** New behaviour gets tests; a fixed bug gets a test that fails without the fix. Pipeline, aggregation, pivot and similar logic is covered by randomised tests that compare incremental updates with a full rebuild: keep them honest (break the code on purpose once to see the test fail).
2. `npm run check` passes (typecheck, tests, build of the library, docs and both examples, and `npm run lint`: ESLint with a 500-line limit per source file and no duplicate imports, plus jscpd duplicate detection under 3%). Aim for files under ~400 lines: when one grows, split it by responsibility, and share one function instead of copying it.
3. **Docs follow the code**: the docs page, the API tables and the feature-status page are updated when behaviour or limits change.
4. **Performance-sensitive changes are measured**: run `npm run bench` before and after and put the numbers in the PR. Do not trade a measured speed-up for convenience without saying so.
5. Server rendering is not broken (`packages/data-grid-kit/src/core/ssr.test.tsx` renders in plain Node).

## Proposing API changes

Open an issue first for anything that adds or changes public API (props, slots, hooks). Describe the use case before the shape of the API. Public API is what `data-grid-kit` and `data-grid-kit/core` export; internals may change at any time.

## Using other libraries as a reference

It is fine to study how other grids solve a problem and to arrive at similar designs. Do **not** copy source code from projects whose license does not allow it. In particular, MUI X Pro and Premium are commercial: read their documentation and observable behaviour, never paste their code.

## Commits and pull requests

- Small, focused commits with a message that says *why*.
- Reference the issue (`Fixes #123`).
- Fill in the pull request template.

## Reporting bugs

Use the bug report template: a minimal reproduction (a few columns and rows) is the fastest way to a fix.

## Releases and changelog

Versioning uses [changesets](https://github.com/changesets/changesets). A change that users can notice (feature, fix, breaking change) adds a changeset:

```bash
npm run changeset      # pick data-grid-kit, the bump (patch / minor / major while 0.x: minor for new features and breaking changes) and a summary
```

Maintainers run `npm run version-packages` (updates `packages/data-grid-kit/CHANGELOG.md` and the version), tag the commit and create a GitHub release. The apps are private and never versioned or published.
