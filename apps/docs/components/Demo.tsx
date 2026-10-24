import { useState, type ComponentType } from 'react'
import { CodeBlock } from './CodeBlock'

/** Runs the real demo component and shows its own source file, so the code can't drift from the demo. */
export function Demo({ Component, source, name }: { Component: ComponentType; source: string; name: string }) {
  const [showCode, setShowCode] = useState(false)
  return (
    <section className="demo" aria-label={`${name} demo`}>
      <div className="demo-stage">
        <Component />
      </div>
      <div className="demo-bar">
        <button type="button" aria-expanded={showCode} onClick={() => setShowCode((v) => !v)}>
          {showCode ? 'Hide source' : 'Show source'}
        </button>
        <span className="muted">{name}.tsx</span>
      </div>
      {showCode && <CodeBlock code={source} title={`${name}.tsx`} />}
    </section>
  )
}
