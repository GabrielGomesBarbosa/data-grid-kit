import PaginationDemo from '../demos/PaginationDemo'
import paginationSrc from '../demos/PaginationDemo.tsx?raw'
import { features } from '../api'
import { type PageDef, demo } from './shared'

export const page: PageDef = {
  id: 'pagination',
  group: 'Main features',
  title: 'Pagination',
  intro: 'Pages count top-level rows, so a group or a tree branch is never split across pages.',
  body: () => <>{demo('PaginationDemo', PaginationDemo, paginationSrc)}</>,
}
