import { useState } from 'react'

export function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard can be blocked; the code stays selectable */
    }
  }
  return (
    <figure className="code">
      <figcaption>
        <span>{title ?? 'tsx'}</span>
        <button type="button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre>
        <code>{code.trim()}</code>
      </pre>
    </figure>
  )
}
