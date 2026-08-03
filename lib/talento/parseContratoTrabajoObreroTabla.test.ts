import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import {
  generarPlantillaContratoTrabajoXlsx,
  parseContratoTrabajoObreroTabla,
} from '@/lib/talento/parseContratoTrabajoObreroTabla';

function bufferFromRows(rows: Record<string, unknown>[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Obreros');
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

describe('parseContratoTrabajoObreroTabla', () => {
  it('extrae filas con cédula y nombres', () => {
    const buf = bufferFromRows([
      {
        cedula: 'V-13848186',
        nombres: 'Ana',
        apellidos: 'Ruiz',
        cargo: 'Ayudante',
        jornada: 'diurna',
      },
    ]);
    const r = parseContratoTrabajoObreroTabla(buf, 't.xlsx');
    assert.equal(r.filas.length, 1);
    assert.equal(r.filas[0]!.cedula, 'V13848186');
    assert.equal(r.filas[0]!.nombres, 'Ana');
    assert.equal(r.filas[0]!.apellidos, 'Ruiz');
    assert.equal(r.filas[0]!.jornada, 'DIURNA');
    assert.equal(r.filas[0]!.errores.length, 0);
  });

  it('marca error si falta cédula', () => {
    const buf = bufferFromRows([{ nombres: 'Luis', apellidos: 'Pérez' }]);
    const r = parseContratoTrabajoObreroTabla(buf);
    assert.ok(r.filas[0]!.errores.some((e) => /cédula/i.test(e)));
  });

  it('acepta nombre_completo', () => {
    const buf = bufferFromRows([{ cédula: 'E12345678', nombre_completo: 'Carlos Díaz' }]);
    const r = parseContratoTrabajoObreroTabla(buf);
    assert.equal(r.filas[0]!.errores.length, 0);
    assert.equal(r.filas[0]!.nombreCompleto, 'Carlos Díaz');
  });

  it('plantilla descargable tiene filas', () => {
    const buf = generarPlantillaContratoTrabajoXlsx();
    const r = parseContratoTrabajoObreroTabla(buf, 'plantilla.xlsx');
    assert.ok(r.filas.length >= 1);
    assert.equal(r.filas[0]!.errores.length, 0);
  });
});
