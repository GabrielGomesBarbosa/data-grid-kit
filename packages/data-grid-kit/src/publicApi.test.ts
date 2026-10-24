import { describe, expect, it } from 'vitest'
import * as root from './index'
import * as core from './core'

// The runtime public API. Adding a name is a minor change; removing or renaming one is a breaking change (see
// docs/API_POLICY.md). If this snapshot changes, the change must be intentional and noted in the changeset.
describe('public API surface', () => {
  it('data-grid-kit exports', () => {
    expect(Object.keys(root).sort()).toMatchSnapshot()
  })
  it('data-grid-kit/core exports (no UI)', () => {
    expect(Object.keys(core).sort()).toMatchSnapshot()
  })
  it('the core entry has no React UI components', () => {
    expect(Object.keys(core)).not.toContain('Grid')
    expect(Object.keys(core)).not.toContain('useGridView')
  })
})
