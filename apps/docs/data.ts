export { COUNTRIES, ROLES, TEAMS, makeEmployees, type Employee } from '@data-grid-kit/sample-data'

export interface FileNode {
  id: number
  path: string[]
  size: number
  type: 'folder' | 'file'
  modified: Date
}

export function makeFiles(): FileNode[] {
  const files: [string[], number][] = [
    [['src'], 0],
    [['src', 'core'], 0],
    [['src', 'core', 'pipeline.ts'], 14200],
    [['src', 'core', 'layout.ts'], 5100],
    [['src', 'core', 'useGrid.ts'], 11800],
    [['src', 'ui'], 0],
    [['src', 'ui', 'Grid.tsx'], 19800],
    [['src', 'ui', 'styles.css'], 8800],
    [['docs'], 0],
    [['docs', 'App.tsx'], 4200],
    [['README.md'], 2100],
    [['package.json'], 1300],
  ]
  return files.map(([path, size], i) => ({
    id: i + 1,
    path,
    size,
    type: size === 0 ? 'folder' : 'file',
    modified: new Date(2025, i % 12, 1 + i),
  }))
}
