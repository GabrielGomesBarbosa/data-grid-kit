import type { GridApi } from '../gridTypes'
import { createApiContext, type ApiRefs } from './context'
import { cellsApi } from './cellsApi'
import { editApi } from './editApi'
import { exportApi } from './exportApi'
import { rowsApi } from './rowsApi'
import { viewApi } from './viewApi'

/** The public API object, assembled from one module per area. */
export function createApi<R>(refs: ApiRefs<R>): GridApi<R> {
  const c = createApiContext(refs)
  return { store: c.store, ...viewApi(c), ...rowsApi(c), ...cellsApi(c), ...editApi(c), ...exportApi(c) }
}
