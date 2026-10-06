import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { extraerDeZip, listarZip, nombreBase, tipoDeImagen } from './leerZip'

type Archivo = { nombre: string; datos: Buffer; comprimir: boolean }

/** Arma un ZIP a mano (cabeceras locales + directorio central + fin). */
function armarZip(archivos: Archivo[]): Blob {
  const partes: Buffer[] = []
  const central: Buffer[] = []
  let pos = 0
  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, 'utf8')
    const cuerpo = a.comprimir ? deflateRawSync(a.datos) : a.datos
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(a.comprimir ? 8 : 0, 8)
    local.writeUInt32LE(cuerpo.length, 18)
    local.writeUInt32LE(a.datos.length, 22)
    local.writeUInt16LE(nombre.length, 26)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(a.comprimir ? 8 : 0, 10)
    c.writeUInt32LE(cuerpo.length, 20)
    c.writeUInt32LE(a.datos.length, 24)
    c.writeUInt16LE(nombre.length, 28)
    c.writeUInt32LE(pos, 42)
    partes.push(local, nombre, cuerpo)
    central.push(c, nombre)
    pos += 30 + nombre.length + cuerpo.length
  }
  const dir = Buffer.concat(central)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(archivos.length, 8)
  fin.writeUInt16LE(archivos.length, 10)
  fin.writeUInt32LE(dir.length, 12)
  fin.writeUInt32LE(pos, 16)
  return new Blob([Buffer.concat(partes.concat([dir, fin]))])
}

test('lista y extrae entradas guardadas y comprimidas', async () => {
  const largo = Buffer.from('foto '.repeat(500))
  const zip = armarZip([
    { nombre: 'fotos/', datos: Buffer.alloc(0), comprimir: false },
    { nombre: 'fotos/p01-01-ñandú.jpg', datos: Buffer.from([1, 2, 3, 4, 5]), comprimir: false },
    { nombre: 'p01-02.jpg', datos: largo, comprimir: true },
  ])
  const entradas = await listarZip(zip)
  assert.deepEqual(entradas.map((e) => e.nombre), ['fotos/p01-01-ñandú.jpg', 'p01-02.jpg'])
  assert.deepEqual(entradas.map((e) => e.metodo), [0, 8])
  const a = await extraerDeZip(zip, entradas[0]!, 'image/jpeg')
  assert.equal(a.type, 'image/jpeg')
  assert.deepEqual(Array.from(new Uint8Array(await a.arrayBuffer())), [1, 2, 3, 4, 5])
  const b = await extraerDeZip(zip, entradas[1]!)
  assert.equal(Buffer.from(await b.arrayBuffer()).toString(), largo.toString())
})

test('rechaza lo que no es un ZIP', async () => {
  await assert.rejects(() => listarZip(new Blob(['esto no es un zip, es texto plano de sobra'])), /ZIP válido/)
})

test('nombreBase y tipoDeImagen', () => {
  assert.equal(nombreBase('fotos/sub/a.jpg'), 'a.jpg')
  assert.equal(nombreBase('a.jpg'), 'a.jpg')
  assert.equal(tipoDeImagen('a.PNG'), 'image/png')
  assert.equal(tipoDeImagen('a.jpg'), 'image/jpeg')
})
