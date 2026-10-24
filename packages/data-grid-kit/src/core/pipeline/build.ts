import { groupKey, mk, type TreeNode, type Model } from './nodes'
import { type Engine } from './engine'

/* -------- building the hierarchy from scratch -------- */

  export function getValueOf<R>(S: Engine<R>, field: string, row: R): unknown {
return (S.getters.get(field) ?? ((r: R) => (r as Record<string, unknown>)[field]))(row)
}

export function buildModel<R>(S: Engine<R>): Model<R> {
  const rows = S.input.rows
  const hasTree = !!S.input.getTreeDataPath
  const fields = S.input.rowGroupingModel
  const m: Model<R> = {
    mode: hasTree ? 'tree' : fields.length ? 'group' : 'flat',
    groupFields: fields,
    roots: [],
    kidsRoot: [],
    byId: new Map(),
    pathMap: null,
    seq: 0,
    pos: 0,
    stamp: 0,
    dataCount: 0,
    total: 0,
    rootAcc: null,
    rootDirty: false,
    rowsProp: rows,
    patched: false,
  }
  const leafOf = (row: R, parent: TreeNode<R> | null): TreeNode<R> => {
    const id = S.input.getRowId(row)
    const node = mk<R>(id, 'leaf', parent, m.seq++, m.pos++)
    node.row = row
    m.byId.set(id, node)
    m.dataCount++
    return node
  }

  if (m.mode === 'flat') {
    for (let i = 0; i < rows.length; i++) m.roots.push(leafOf(rows[i]!, null))
  } else if (m.mode === 'group') {
    // leaves get seq in row order first, then groups in first-appearance order
    const leaves = rows.map((row) => leafOf(row, null))
    const group = (items: TreeNode<R>[], depth: number, parent: TreeNode<R> | null, parentId: string): TreeNode<R>[] => {
      const field = fields[depth]
      if (field === undefined) {
        for (const leaf of items) leaf.parent = parent
        return items
      }
      const buckets = new Map<unknown, { raw: unknown; items: TreeNode<R>[] }>()
      const get = S.getters.get(field) ?? ((r: R) => (r as Record<string, unknown>)[field])
      for (const leaf of items) {
        const raw = get(leaf.row!)
        const key = groupKey(raw)
        const bucket = buckets.get(key)
        if (bucket) bucket.items.push(leaf)
        else buckets.set(key, { raw, items: [leaf] })
      }
      const out: TreeNode<R>[] = []
      for (const [key, { raw, items: members }] of buckets) {
        const id = `${parentId}/${field}:${String(key)}`
        const g = mk<R>(id, 'group', parent, m.seq++)
        g.groupField = field
        g.groupValue = raw
        g.children = group(members, depth + 1, g, id)
        m.byId.set(id, g)
        out.push(g)
      }
      return out
    }
    m.roots = group(leaves, 0, null, 'group')
  } else {
    type Level = Map<string, { node: TreeNode<R>; next: Level }>
    const top: Level = new Map()
    for (const row of rows) {
      const id = S.input.getRowId(row)
      const path = S.input.getTreeDataPath!(row)
      if (!path.length) continue
      let level = top
      let parent: TreeNode<R> | null = null
      for (let depth = 0; depth < path.length; depth++) {
        const key = path[depth]!
        let slot: { node: TreeNode<R>; next: Level } | undefined = level.get(key)
        if (!slot) {
          const sid = depth === path.length - 1 ? id : `tree:${JSON.stringify(path.slice(0, depth + 1))}`
          const node: TreeNode<R> = mk<R>(sid, 'group', parent, m.seq++)
          node.seg = key
          slot = { node, next: new Map() }
          level.set(key, slot)
          if (parent) parent.children.push(node)
          else m.roots.push(node)
          m.byId.set(sid, node)
        }
        if (depth === path.length - 1) {
          if (slot.node.row !== undefined) {
            throw new Error(
              `data-grid-kit: rows "${String(slot.node.id)}" and "${String(id)}" share the tree path ${JSON.stringify(path)}`,
            )
          }
          if (slot.node.id !== id) {
            m.byId.delete(slot.node.id)
            slot.node.id = id
            m.byId.set(id, slot.node)
          }
          slot.node.row = row
          slot.node.pos = m.pos++
          m.dataCount++
        }
        parent = slot.node
        level = slot.next
      }
    }
  }
  return m
}
