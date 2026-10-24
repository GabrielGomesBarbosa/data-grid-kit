export interface Employee {
  id: number
  name: string
  team: string
  role: string
  country: string
  salary: number
  hired: Date
  remote: boolean
}

export const TEAMS = ['Platform', 'Growth', 'Payments', 'Design', 'Data']
export const ROLES = ['Engineer', 'Manager', 'Analyst', 'Designer']
export const COUNTRIES = ['Brazil', 'Portugal', 'Spain', 'Germany', 'Japan', 'Canada']

/** deterministic fake people, so the example looks the same on every run */
export function makeEmployees(n: number): Employee[] {
  let seed = 7
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    team: pick(TEAMS),
    role: pick(ROLES),
    country: pick(COUNTRIES),
    salary: Math.round(3000 + rand() * 12000),
    hired: new Date(2016 + Math.floor(rand() * 9), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)),
    remote: rand() > 0.5,
  }))
}
