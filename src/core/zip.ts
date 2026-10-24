/**
 * A minimal ZIP writer: what an .xlsx needs and nothing else. Entries are deflated with the platform's
 * `CompressionStream` when there is one (browsers and Node 18+), otherwise stored. No ZIP64: the archive and each entry
 * must stay under 4 GB.
 */

export interface ZipEntry {
  name: string
  /** the file's bytes, in pieces (a large sheet is never one string) */
  chunks: Uint8Array[]
}

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(chunks: Uint8Array[]): number {
  let c = 0xffffffff
  for (const chunk of chunks) for (let i = 0; i < chunk.length; i++) c = TABLE[(c ^ chunk[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const size = (chunks: Uint8Array[]) => chunks.reduce((n, c) => n + c.length, 0)

async function deflateRaw(chunks: Uint8Array[]): Promise<Uint8Array[] | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob(chunks as BlobPart[]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    const reader = stream.getReader()
    const out: Uint8Array[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      out.push(value)
    }
    return out
  } catch {
    return null // a runtime without 'deflate-raw': store instead
  }
}

const dosTime = (d: Date) => (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
const dosDate = (d: Date) => (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()

export async function zip(entries: ZipEntry[], options: { compress?: boolean; date?: Date } = {}): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const when = options.date ?? new Date()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = enc.encode(entry.name)
    const crc = crc32(entry.chunks)
    const rawSize = size(entry.chunks)
    let method = 0
    let data = entry.chunks
    if (options.compress !== false && rawSize > 64) {
      const packed = await deflateRaw(entry.chunks)
      if (packed && size(packed) < rawSize) {
        method = 8
        data = packed
      }
    }
    const packedSize = size(data)
    if (rawSize >= 0xffffffff || offset >= 0xffffffff) throw new Error('xlsx too large for a ZIP without ZIP64')
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true) // version needed
    head.setUint16(6, 0x0800, true) // UTF-8 names
    head.setUint16(8, method, true)
    head.setUint16(10, dosTime(when), true)
    head.setUint16(12, dosDate(when), true)
    head.setUint32(14, crc, true)
    head.setUint32(18, packedSize, true)
    head.setUint32(22, rawSize, true)
    head.setUint16(26, name.length, true)
    head.setUint16(28, 0, true)
    parts.push(new Uint8Array(head.buffer), name, ...data)

    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, method, true)
    cd.setUint16(12, dosTime(when), true)
    cd.setUint16(14, dosDate(when), true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, packedSize, true)
    cd.setUint32(24, rawSize, true)
    cd.setUint16(28, name.length, true)
    cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), name)
    offset += 30 + name.length + packedSize
  }
  const cdSize = size(central)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(size(all))
  let at = 0
  for (const p of all) {
    out.set(p, at)
    at += p.length
  }
  return out
}
