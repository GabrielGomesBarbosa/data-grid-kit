import postcss from 'postcss'

/** properties a grid needs to lay itself out and behave: everything else is look */
export const STRUCTURE = new Set([
  'position', 'top', 'right', 'bottom', 'left', 'inset', 'z-index',
  'display', 'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content',
  'overflow', 'overflow-x', 'overflow-y', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'box-sizing', 'contain', 'transform', 'pointer-events', 'touch-action', 'user-select', 'white-space', 'text-overflow',
  'clip-path', 'clip', 'content', 'grid-template-columns',
])

/** a copy of the tree that keeps only the declarations `keep` accepts (and the rules and at-rules that still have some) */
export const pick = (css, keep, keepAtRule) => {
  const out = postcss.parse(css)
  const inKeyframes = (node) => {
    for (let p = node.parent; p; p = p.parent) if (p.type === 'atrule' && /keyframes$/.test(p.name)) return true
    return false
  }
  out.walkDecls((decl) => {
    // an animation's frames belong to the theme as a whole, whatever properties they animate
    if (!inKeyframes(decl) && !keep(decl.prop)) decl.remove()
  })
  out.walkAtRules((at) => {
    if (at.name === 'keyframes' && !keepAtRule) at.remove()
  })
  let changed = true
  while (changed) {
    changed = false
    out.walk((node) => {
      if ((node.type === 'rule' || node.type === 'atrule') && node.nodes && node.nodes.length === 0 && node.name !== 'keyframes') {
        node.remove()
        changed = true
      }
    })
  }
  out.walkComments((c) => c.remove())
  return out.toString().replace(/\n{3,}/g, '\n\n').trim() + '\n'
}


/** the whole stylesheet split by property: `structure` (layout and behaviour) and `theme` (the look) */
export function splitCss(css) {
  return {
    structure: pick(css, (prop) => STRUCTURE.has(prop), false),
    theme: pick(css, (prop) => !STRUCTURE.has(prop), true),
  }
}
