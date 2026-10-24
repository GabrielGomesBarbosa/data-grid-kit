import type { PageDef } from './shared'
import { page as overviewPage } from './overview'
import { page as quickstartPage } from './quickstart'
import { page as featuresPage } from './features'
import { page as demoRealTimePage } from './demoRealTime'
import { page as demoTimeOffPage } from './demoTimeOff'
import { page as demoInventoryPage } from './demoInventory'
import { page as columnsPage } from './columns'
import { page as localizationPage } from './localization'
import { page as sortingPage } from './sorting'
import { page as filteringPage } from './filtering'
import { page as paginationPage } from './pagination'
import { page as selectionPage } from './selection'
import { page as editingPage } from './editing'
import { page as keyboardPage } from './keyboard'
import { page as exportPage } from './export'
import { page as virtualizationPage } from './virtualization'
import { page as rowHeightPage } from './rowHeight'
import { page as pinningPage } from './pinning'
import { page as columnReorderPage } from './columnReorder'
import { page as rowPinningPage } from './rowPinning'
import { page as liveUpdatesPage } from './liveUpdates'
import { page as aggregationPage } from './aggregation'
import { page as cellSelectionPage } from './cellSelection'
import { page as clipboardPage } from './clipboard'
import { page as detailPanelPage } from './detailPanel'
import { page as excelExportPage } from './excelExport'
import { page as pivotingPage } from './pivoting'
import { page as serverSideDataPage } from './serverSideData'
import { page as rowReorderingPage } from './rowReordering'
import { page as treeDataPage } from './treeData'
import { page as rowGroupingPage } from './rowGrouping'
import { page as headlessPage } from './headless'
import { page as customizationPage } from './customization'
import { page as performancePage } from './performance'
import { page as apiPage } from './api'

export type { PageDef } from './shared'

/** In reading order: this is the order of the navigation. */
export const pages: PageDef[] = [
  overviewPage,
  quickstartPage,
  featuresPage,
  demoRealTimePage,
  demoTimeOffPage,
  demoInventoryPage,
  columnsPage,
  localizationPage,
  sortingPage,
  filteringPage,
  paginationPage,
  selectionPage,
  editingPage,
  keyboardPage,
  exportPage,
  virtualizationPage,
  rowHeightPage,
  pinningPage,
  columnReorderPage,
  rowPinningPage,
  liveUpdatesPage,
  aggregationPage,
  cellSelectionPage,
  clipboardPage,
  detailPanelPage,
  excelExportPage,
  pivotingPage,
  serverSideDataPage,
  rowReorderingPage,
  treeDataPage,
  rowGroupingPage,
  customizationPage,
  headlessPage,
  performancePage,
  apiPage,
]
