import { NextResponse } from 'next/server'
import { makeEmployees } from '../../../lib/data'

const all = makeEmployees(100_000)

// A tiny "backend" for the server-side data example: sorting, a quick filter and a page of rows.
// Query: ?start=0&end=24&sort=salary&dir=desc&q=person%2012
export function GET(request: Request) {
  const url = new URL(request.url)
  const start = Math.max(0, Number(url.searchParams.get('start') ?? 0))
  const end = Math.min(start + 999, Number(url.searchParams.get('end') ?? start + 24))
  const sort = url.searchParams.get('sort')
  const dir = url.searchParams.get('dir') === 'desc' ? -1 : 1
  const q = (url.searchParams.get('q') ?? '').toLowerCase().trim()

  let list = q ? all.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : all
  if (sort && sort in all[0]!) {
    const key = sort as keyof (typeof all)[number]
    list = [...list].sort((a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : a.id - b.id))
  }
  return NextResponse.json({ rows: list.slice(start, end + 1), rowCount: list.length })
}
