// @vitest-environment node
import { expect } from 'vitest'
import { crc32 } from './zip'

/** a small ZIP reader, independent of the writer: walks the central directory */
async function inflate(body: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([body as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function readZip(bytes: Uint8Array): Promise<Record<string, string>> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = bytes.length - 22
  while (v.getUint32(eocd, true) !== 0x06054b50) eocd--
  const count = v.getUint16(eocd + 10, true)
  let at = v.getUint32(eocd + 16, true)
  const out: Record<string, string> = {}
  const dec = new TextDecoder()
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50)
    const method = v.getUint16(at + 10, true)
    const crc = v.getUint32(at + 16, true)
    const packed = v.getUint32(at + 20, true)
    const raw = v.getUint32(at + 24, true)
    const nameLen = v.getUint16(at + 28, true)
    const local = v.getUint32(at + 42, true)
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen))
    const dataAt = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const body = bytes.subarray(dataAt, dataAt + packed)
    const data = method === 8 ? await inflate(body) : body
    expect(data.length).toBe(raw)
    expect(crc32([data])).toBe(crc)
    out[name] = dec.decode(data)
    at += 46 + nameLen
  }
  return out
}
