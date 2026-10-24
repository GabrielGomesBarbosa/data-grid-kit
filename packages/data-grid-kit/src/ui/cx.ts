/** join class names, skipping the empty ones */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ')
