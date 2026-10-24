export interface Employee {
  id: number
  name: string
  team: string
  role: string
  country: string
  salary: number
  hired: string
}

export const TEAMS = ['Platform', 'Growth', 'Payments', 'Design', 'Data']
export const ROLES = ['Engineer', 'Manager', 'Analyst', 'Designer']
export const COUNTRIES = ['Brazil', 'Portugal', 'Spain', 'Germany', 'Japan', 'Canada']

/** deterministic fake people: the same on the server and in the browser */
export function makeEmployees(n: number): Employee[] {
  let seed = 11
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    team: pick(TEAMS),
    role: pick(ROLES),
    country: pick(COUNTRIES),
    salary: Math.round(3000 + rand() * 12000),
    // an ISO string keeps the rows plain JSON, which is what travels from a Server Component to a Client Component
    hired: new Date(Date.UTC(2016 + Math.floor(rand() * 9), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27))).toISOString().slice(0, 10),
  }))
}
