import { type ClipboardEvent as ReactClipboardEvent } from 'react'
import type { GridCtx } from './ctx'

export function useClipboard<R>(c: GridCtx<R>) {
  const { clipboard, api } = c

  /* ---- clipboard ---- */

  const onCopy = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!clipboard || e.target !== e.currentTarget) return // copying inside an editor is the editor's business
    const text = api.copySelection()
    if (!text) return
    e.clipboardData.setData('text/plain', text)
    e.preventDefault()
  }
  const onCut = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!clipboard || e.target !== e.currentTarget) return
    const text = api.copySelection()
    if (!text) return
    e.clipboardData.setData('text/plain', text)
    e.preventDefault()
    void api.clearSelectedCells()
  }
  const onPaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!clipboard || e.target !== e.currentTarget) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    void api.pasteText(text)
  }

  return { onCopy, onCut, onPaste }
}
