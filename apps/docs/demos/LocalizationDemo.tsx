import { useMemo, useState } from 'react'
import { Grid, type GridLocaleText, type UIColumnDef } from 'data-grid-kit'
import { ptBR } from 'data-grid-kit/locales'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(300)

const columns: UIColumnDef<Employee>[] = [
  { field: 'name', headerName: 'Name', width: 180 },
  { field: 'team', headerName: 'Team', width: 120 },
  { field: 'salary', headerName: 'Salary', type: 'number', width: 110 },
  { field: 'hired', headerName: 'Hired', type: 'date', width: 120 },
  { field: 'remote', headerName: 'Remote', type: 'boolean', width: 90 },
]

/** your own words for a few keys: everything else stays in English */
const spanish: Partial<GridLocaleText> = {
  toolbarColumns: 'Columnas',
  toolbarFilters: 'Filtros',
  toolbarExport: 'Exportar',
  toolbarSearch: 'Buscar',
  quickFilterPlaceholder: 'Buscar…',
  noRows: 'Sin filas',
  menuSortAsc: 'Ordenar ascendente',
  menuSortDesc: 'Ordenar descendente',
  menuHide: 'Ocultar columna',
  footerRows: (_count, _more, formatted) => `${formatted} filas`,
}

type Pick = 'en' | 'pt' | 'es'
const LABELS: Record<Pick, string> = { en: 'English (the default)', pt: 'Português: {...ptBR}', es: 'Español: a few keys' }

export default function LocalizationDemo() {
  const [lang, setLang] = useState<Pick>('pt')
  // the same object between renders: a new one re-renders the grid
  const props = useMemo(() => (lang === 'pt' ? ptBR : lang === 'es' ? { locale: 'es-ES', localeText: spanish } : {}), [lang])
  return (
    <>
      <p>
        {(['en', 'pt', 'es'] as Pick[]).map((l) => (
          <label key={l} style={{ marginRight: 16 }}>
            <input type="radio" name="grid-language" checked={lang === l} onChange={() => setLang(l)} /> {LABELS[l]}
          </label>
        ))}
      </p>
      <p className="muted">Open the column menu, the filters, the columns panel or the export menu, and look at the footer and the dates.</p>
      <Grid rows={rows} columns={columns} height={360} pagination={false} toolbar aggregationFooter {...props} initialState={{ aggregationModel: { salary: 'sum' } }} />
    </>
  )
}
