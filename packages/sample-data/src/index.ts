/** Deterministic fake people: every visit, example and benchmark sees the same rows. */
export interface Employee {
  id: number
  name: string
  team: string
  role: string
  country: string
  salary: number
  age: number
  hired: Date
  email: string
  remote: boolean
}

export const TEAMS = ['Platform', 'Growth', 'Payments', 'Design', 'Data']
export const ROLES = ['Engineer', 'Manager', 'Analyst', 'Designer']
export const COUNTRIES = ['Brazil', 'Portugal', 'Spain', 'Germany', 'Japan', 'Canada']

/** deterministic pseudo-random rows so every visit (and every benchmark) sees the same data */
export function makeEmployees(n: number, seed = 42): Employee[] {
  let s = seed
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    team: pick(TEAMS),
    role: pick(ROLES),
    country: pick(COUNTRIES),
    salary: Math.round(3000 + rand() * 12000),
    age: 20 + Math.floor(rand() * 40),
    hired: new Date(2015 + Math.floor(rand() * 10), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)),
    email: `person${i + 1}@example.com`,
    remote: rand() > 0.5,
  }))
}
