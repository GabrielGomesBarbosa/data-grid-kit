# Public API and stability policy

## What is public

- Everything exported from `data-grid-kit` (the grid, its slot and prop types, `useGridView`, `mergeProps`, `rowPropsEqual`, `defaultSlots`) and from `data-grid-kit/core` (the headless hooks, pipeline helpers, export writers, types).
- The CSS entry points `data-grid-kit/styles.css`, `structure.css`, `theme.css`; the `gk-` class names and the `data-*` state attributes documented on the Customization page.

Everything else (deep imports, `src/**` paths, undocumented class names) is internal and can change in any release.

## Versioning

We follow semver. While the version is `0.x`, a **minor** may contain breaking changes (always listed in the changeset); a patch never does. From `1.0`:

- **Major**: removing or renaming an export, changing a prop, option, slot-prop or callback signature in a way existing code stops compiling or behaving, removing a documented class name or attribute.
- **Minor**: new exports, options, slots, features; new optional fields on passed objects.
- **Patch**: fixes, performance, internal refactors, docs.

Adding a field to the props a slot *receives* is a minor change, so custom slots should spread unknown props (`{...props}`) when they wrap a built-in.

## How it is enforced

`src/publicApi.test.ts` snapshots the exported runtime names of both entry points; a change shows up in review and needs a changeset. Types are checked by `npm run typecheck` over the docs and example apps, which use only the public entry points.
