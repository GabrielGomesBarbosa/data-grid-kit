import { useMemo, useState } from 'react'
import { Grid, type GridLocaleText, type UIColumnDef } from 'data-grid-kit'
import { ptBR } from 'data-grid-kit/locales'
import { makeEmployees, type Employee } from '../data'

const rows = makeEmployees(300)

/** the column names are yours: you write them in the language you want (here from a small table, in your app from react-intl or next-intl) */
const HEADERS = {
  en: { name: 'Name', team: 'Team', salary: 'Salary', hired: 'Hired', remote: 'Remote' },
  pt: { name: 'Nome', team: 'Equipe', salary: 'Salário', hired: 'Contratação', remote: 'Remoto' },
  es: { name: 'Nombre', team: 'Equipo', salary: 'Salario', hired: 'Contratación', remote: 'Remoto' },
}
const columnsFor = (h: (typeof HEADERS)['en']): UIColumnDef<Employee>[] => [
  { field: 'name', headerName: h.name, width: 180 },
  { field: 'team', headerName: h.team, width: 120 },
  { field: 'salary', headerName: h.salary, type: 'number', width: 110 },
  { field: 'hired', headerName: h.hired, type: 'date', width: 120 },
  { field: 'remote', headerName: h.remote, type: 'boolean', width: 90 },
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
  const columns = useMemo(() => columnsFor(HEADERS[lang]), [lang])
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
      <p className="muted">The column names are the ones the app passes (<code>headerName</code>); the grid translates everything else. Open the column menu, the filters, the columns panel or the export menu, and look at the footer and the dates.</p>
      <Grid rows={rows} columns={columns} height={360} pagination={false} toolbar aggregationFooter {...props} initialState={{ aggregationModel: { salary: 'sum' } }} />
    </>
  )
}
