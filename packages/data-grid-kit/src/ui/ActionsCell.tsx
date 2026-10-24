import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { useBase } from './base'
import { useIcons } from './icons'
import { useLocaleText } from './localeContext'
import { useSlots } from './slotsContext'

/** One action of an `actions` column: a button in the cell, or an item of the cell's menu (`showInMenu`). */
export interface GridAction {
  /** the accessible name, the tooltip and (in the menu, or without an icon) the text */
  label: string
  /** shown in the button (default: the label) */
  icon?: ReactNode
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void
  /** put it in the ⋮ menu of the cell instead of a button of its own */
  showInMenu?: boolean
  disabled?: boolean
  /** makes it a link (`target` and `rel` go with it) */
  href?: string
  target?: string
  rel?: string
  /** keep the menu open after it is chosen (default: closes) */
  keepMenuOpen?: boolean
}

/** The content of a cell of an `actions` column: its buttons, then a ⋮ button for the ones that go in the menu. */
export function ActionsCell({ actions }: { actions: GridAction[] }) {
  const { Button } = useBase()
  const icons = useIcons()
  const { text } = useLocaleText()
  const { slots, slotProps } = useSlots()
  const Popover = slots.popover
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const inline = actions.filter((a) => !a.showInMenu)
  const inMenu = actions.filter((a) => a.showInMenu)
  return (
    <span className="gk-actions">
      {inline.map((a, i) =>
        a.href ? (
          <a key={i} className="gk-action" href={a.href} target={a.target} rel={a.rel} aria-label={a.label} title={a.label} tabIndex={-1}>
            {a.icon ?? a.label}
          </a>
        ) : (
          <Button key={i} type="button" className="gk-action" aria-label={a.label} title={a.label} disabled={a.disabled} tabIndex={-1} onClick={a.onClick}>
            {a.icon ?? a.label}
          </Button>
        ),
      )}
      {inMenu.length > 0 && (
        <Button
          type="button"
          className="gk-action"
          data-gk-anchor
          aria-haspopup="menu"
          aria-expanded={menu !== null}
          aria-label={text.actionsMore}
          title={text.actionsMore}
          tabIndex={-1}
          onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())}
        >
          <icons.columnMenu />
        </Button>
      )}
      {menu && (
        <Popover anchor={menu} onClose={() => setMenu(null)} label={text.actionsMore} role="menu" align="end" {...slotProps.popover} className={['gk-menu', slotProps.popover?.className].filter(Boolean).join(' ')}>
          {inMenu.map((a, i) =>
            a.href ? (
              <a key={i} role="menuitem" className="gk-menu-item" href={a.href} target={a.target} rel={a.rel} onClick={() => !a.keepMenuOpen && setMenu(null)}>
                {a.label}
              </a>
            ) : (
              <Button
                key={i}
                type="button"
                role="menuitem"
                className="gk-menu-item"
                disabled={a.disabled}
                onClick={(e) => {
                  a.onClick?.(e)
                  if (!a.keepMenuOpen) setMenu(null)
                }}
              >
                {a.label}
              </Button>
            ),
          )}
        </Popover>
      )}
    </span>
  )
}
