import { Grid, type UIColumnDef } from '../../src'
import { makeFiles, type FileNode } from '../data'

const rows = makeFiles()

const columns: UIColumnDef<FileNode>[] = [
  // the first column carries the expand/collapse control and the indentation
  { field: 'name', headerName: 'Name', width: 240, valueGetter: (r) => r.path[r.path.length - 1] },
  { field: 'type', headerName: 'Type', width: 100 },
  { field: 'size', headerName: 'Size (bytes)', type: 'number', width: 130 },
  { field: 'modified', headerName: 'Modified', type: 'date', width: 130 },
]

export default function TreeDemo() {
  return (
    <Grid
      rows={rows}
      columns={columns}
      height={340}
      pagination={false}
      toolbar
      // each row says where it lives; missing ancestors are created automatically
      getTreeDataPath={(row) => row.path}
      initialState={{ expandAllByDefault: true }}
    />
  )
}
