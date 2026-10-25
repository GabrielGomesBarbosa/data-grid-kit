export interface Person {
  id: number
  name: string
  email: string
  city: string
  team: string
  age: number
  salary: number
  joined: Date
  active: boolean
}

const CITIES = ['Lisbon', 'Porto', 'São Paulo', 'Rio', 'Madrid', 'Berlin', 'Paris', 'Rome', 'London', 'Dublin', 'Oslo', 'Vienna']
const TEAMS = ['Data', 'Design', 'Platform', 'Growth', 'Support', 'Finance', 'People']
const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Felipe', 'Gabi', 'Hugo', 'Iris', 'João', 'Keila', 'Luis', 'Maya', 'Nuno', 'Olga', 'Paulo']
const LAST = ['Silva', 'Santos', 'Costa', 'Ferreira', 'Rocha', 'Lima', 'Souza', 'Alves', 'Pereira', 'Gomes', 'Ribeiro', 'Martins']

/** a small deterministic generator, so every library gets exactly the same rows on every run */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeRows(count: number): Person[] {
  const rand = mulberry32(42)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!
  return Array.from({ length: count }, (_, i) => {
    const first = pick(FIRST)
    const last = pick(LAST)
    return {
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      city: pick(CITIES),
      team: pick(TEAMS),
      age: 20 + Math.floor(rand() * 45),
      salary: Math.round(30000 + rand() * 90000),
      joined: new Date(2015 + Math.floor(rand() * 10), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)),
      active: rand() > 0.3,
    }
  })
}

export const FIELDS = ['name', 'email', 'city', 'team', 'age', 'salary', 'joined', 'active'] as const
export type Field = (typeof FIELDS)[number]
