import { Grid, defaultSlots, type CellProps, type FooterProps, type GridSlots, type UIColumnDef } from 'data-grid-kit'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(40)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 160 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 120 },
]

/** Wrap the built-in cell: same behaviour, your markup around it. */
function HighlightCell(props: CellProps<Employee>) {
  const rich = props.col.field === 'salary' && Number(props.row.row?.salary) > 10000
  return <defaultSlots.cell {...props} className={rich ? 'demo-rich' : props.className} />
}

/** Replace a part outright: it receives the grid and reads whatever it needs. */
function SummaryFooter({ grid }: FooterProps<Employee>) {
  return <div className="demo-footer">{grid.result.filteredCount} people · page {grid.state.paginationModel.page + 1}</div>
}

const slots: Partial<GridSlots<Employee>> = {
  cell: HighlightCell,
  footer: SummaryFooter,
  icons: { ...defaultSlots.icons, sortAsc: () => <>▲</>, sortDesc: () => <>▼</> },
}

export default function SlotsDemo() {
  return (
    <Grid
      rows={rows}
      columns={columns}
      height={320}
      slots={slots}
      slotProps={{ row: { className: 'demo-row' } }}
    />
  )
}
