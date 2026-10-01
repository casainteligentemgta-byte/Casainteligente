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

describe('detectWallsFromPdfBytes', () => {
  it('detecta los 4 muros grises de un PDF vectorial y ignora el negro', async () => {
    const bytes = await planoCadVectorial()
    const result = await detectWallsFromPdfBytes(bytes)
    assert.ok(result.color && result.color.includes('0.45'), `color=${result.color}`)
    assert.ok(result.walls.length >= 4, `muros=${result.walls.length}`)
    const structures = structuresFromWallDetection(result, { makeId: () => 't' })
    assert.equal(structures[0]!.materialId, 'block')
    const horiz = result.walls.filter((w) => Math.abs(w.y1 - w.y2) < 0.03)
    const vert = result.walls.filter((w) => Math.abs(w.x1 - w.x2) < 0.03)
    assert.ok(horiz.length >= 2)
    assert.ok(vert.length >= 2)
  })
})
