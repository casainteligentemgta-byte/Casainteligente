/**
 * Ejecutar: npx tsx --test lib/netvision/detectWallsFromPdf.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PDFDocument, rgb } from 'pdf-lib'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import { detectWallsFromPdfBytes, structuresFromWallDetection } from './detectWallsFromPdf'

GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve('node_modules/pdfjs-dist/build/pdf.worker.mjs'),
).href

async function planoCadVectorial(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const wall = rgb(0.45, 0.45, 0.45)
  const black = rgb(0, 0, 0)
  page.drawRectangle({ x: 72, y: 72, width: 400, height: 8, color: wall })
  page.drawRectangle({ x: 72, y: 400, width: 400, height: 8, color: wall })
  page.drawRectangle({ x: 72, y: 72, width: 8, height: 336, color: wall })
  page.drawRectangle({ x: 464, y: 72, width: 8, height: 336, color: wall })
  page.drawRectangle({ x: 20, y: 700, width: 8, height: 8, color: black })
  return doc.save()
}

async function planoConAberturas(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const wall = rgb(0.45, 0.45, 0.45)
  const glass = rgb(0.4, 0.75, 0.9)
  // Muro inferior partido: hueco de puerta 200–280
  page.drawRectangle({ x: 72, y: 72, width: 128, height: 8, color: wall })
  page.drawRectangle({ x: 280, y: 72, width: 192, height: 8, color: wall })
  // Muro superior partido + vidrio: ventana 150–270
  page.drawRectangle({ x: 72, y: 400, width: 78, height: 8, color: wall })
  page.drawRectangle({ x: 270, y: 400, width: 202, height: 8, color: wall })
  page.drawRectangle({ x: 150, y: 400, width: 120, height: 8, color: glass })
  page.drawRectangle({ x: 72, y: 72, width: 8, height: 336, color: wall })
  page.drawRectangle({ x: 464, y: 72, width: 8, height: 336, color: wall })
  return doc.save()
}

describe('detectWallsFromPdfBytes', () => {
  it('detecta los 4 muros grises de un PDF vectorial y ignora el negro', async () => {
    const bytes = await planoCadVectorial()
    const result = await detectWallsFromPdfBytes(bytes)
    assert.ok(result.color && result.color.includes('0.45'), `color=${result.color}`)
    assert.ok(result.walls.length >= 4, `muros=${result.walls.length}`)
    const structures = structuresFromWallDetection(result, { makeId: () => 't' })
    assert.equal(structures[0]!.materialId, 'block')
    assert.equal((result.doors ?? []).length, 0)
    assert.equal((result.windows ?? []).length, 0)
    const horiz = result.walls.filter((w) => Math.abs(w.y1 - w.y2) < 0.03)
    const vert = result.walls.filter((w) => Math.abs(w.x1 - w.x2) < 0.03)
    assert.ok(horiz.length >= 2)
    assert.ok(vert.length >= 2)
  })

  it('detecta una puerta (hueco) y una ventana (vidrio) además de los muros', async () => {
    const bytes = await planoConAberturas()
    const result = await detectWallsFromPdfBytes(bytes)
    assert.ok(result.walls.length >= 4, `muros=${result.walls.length}`)
    assert.ok(result.doors.length >= 1, `puertas=${result.doors.length}`)
    assert.ok(result.windows.length >= 1, `ventanas=${result.windows.length}`)
    const structures = structuresFromWallDetection(result, { makeId: () => 't' })
    assert.ok(structures.some((s) => s.materialId === 'door'))
    assert.ok(structures.some((s) => s.materialId === 'window'))
  })
})
