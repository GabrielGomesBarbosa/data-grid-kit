import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server: React warns when a layout effect is declared during
 * server rendering, even though it never runs there. The two behave the same where it matters (the browser).
 */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
