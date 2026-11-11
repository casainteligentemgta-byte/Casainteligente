import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { archivosPendienteCanal, parseDocumentParts } from './documentPartsPendiente'

describe('parseDocumentParts', () => {
  it('ordena las partes y ignora las que no tienen storage_path', () => {
    const parts = parseDocumentParts([
      { orden: 2, storage_path: 'b.jpg', mime_type: 'image/jpeg', file_name: 'b.jpg' },
      { orden: 0, storage_path: 'a.jpg', mime_type: 'image/jpeg', file_name: 'a.jpg' },
      { orden: 1, mime_type: 'image/jpeg' },
    ])
    assert.deepEqual(
      parts.map((p) => p.storage_path),
      ['a.jpg', 'b.jpg'],
    )
  })
})

describe('archivosPendienteCanal', () => {
  it('usa document_parts cuando hay varias fotos', () => {
    const archivos = archivosPendienteCanal({
      document_storage_path: 'viejo.jpg',
      document_parts: [
        { orden: 0, storage_path: 'p0.jpg', mime_type: 'image/jpeg', file_name: 'p0.jpg' },
        { orden: 1, storage_path: 'p1.jpg', mime_type: 'image/jpeg', file_name: 'p1.jpg' },
      ],
    })
    assert.equal(archivos.length, 2)
    assert.equal(archivos[1].storagePath, 'p1.jpg')
  })

  it('cae al documento único si no hay partes', () => {
    const archivos = archivosPendienteCanal({
      document_storage_path: 'unico.jpg',
      document_mime_type: 'image/jpeg',
      document_file_name: 'factura.jpg',
    })
    assert.equal(archivos.length, 1)
    assert.equal(archivos[0].storagePath, 'unico.jpg')
  })
})
