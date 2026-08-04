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

function bufferFromAoa(aoa: unknown[][], sheetName = 'Lista'): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

describe('parseContratoTrabajoObreroTabla', () => {
  it('lee la tabla de nómina (C.I., Nombre Completo, Cargo)', () => {
    const buf = bufferFromRows([
      {
        'N° Excel': 26,
        'Nombre (Manuscrito)': 'Brigido Gonzalez',
        'Nombre Completo (Excel)': 'BRIGIDO ANTONIO GONZALEZ CALVO',
        'C.I.': '10.199.713',
        Categoría: 'OBRERO',
        Tipo: 'AYUDANTE',
        Cargo: 'AYUDANTE',
        'Cánon Semanal ($)': '$70',
        'Cuenta Bancaria': '0102 0667 7900 0045 3819',
      },
    ]);
    const r = parseContratoTrabajoObreroTabla(buf, 'nomina.xlsx');
    assert.equal(r.filas.length, 1);
    assert.equal(r.filas[0]!.cedula, 'V10199713');
    assert.equal(r.filas[0]!.nombreCompleto, 'BRIGIDO ANTONIO GONZALEZ CALVO');
    assert.equal(r.filas[0]!.cargo, 'AYUDANTE');
    assert.equal(r.filas[0]!.canonSemanalUsd, 70);
    assert.equal(r.filas[0]!.errores.length, 0);
  });

  it('omite filas «No registrado»', () => {
    const buf = bufferFromRows([
      {
        'Nombre Completo (Excel)': 'No registrado',
        'C.I.': '9.307.052',
      },
      {
        'Nombre Completo (Excel)': 'JULIO SUAREZ',
        'C.I.': '9.427.286',
        Cargo: 'AYUDANTE',
      },
    ]);
    const r = parseContratoTrabajoObreroTabla(buf);
    assert.equal(r.filas.length, 1);
    assert.equal(r.filas[0]!.nombreCompleto, 'JULIO SUAREZ');
  });

  it('plantilla descargable tiene Nombres, Apellidos, Cédula y demás columnas', () => {
    const buf = generarPlantillaContratoTrabajoXlsx();
    const r = parseContratoTrabajoObreroTabla(buf, 'plantilla.xlsx');
    assert.ok(r.filas.length >= 1);
    assert.equal(r.filas[0]!.errores.length, 0);
    assert.ok(r.encabezados.some((h) => /^nombres$/i.test(h)));
    assert.ok(r.encabezados.some((h) => /^apellidos$/i.test(h)));
    assert.ok(r.encabezados.some((h) => /c[eé]dula/i.test(h)));
    assert.ok(r.encabezados.some((h) => /fecha/i.test(h)));
    assert.ok(r.encabezados.some((h) => /jornada/i.test(h)));
    assert.ok(r.encabezados.some((h) => /^bono$/i.test(h)));
    assert.ok(r.encabezados.some((h) => /estado\s*civil/i.test(h)));
    assert.equal(r.filas[0]!.nombres, 'BRIGIDO ANTONIO');
    assert.equal(r.filas[0]!.apellidos, 'GONZALEZ CALVO');
    assert.equal(r.filas[0]!.jornada, 'DIURNA');
    assert.equal(r.filas[0]!.estadoCivil, 'Soltero');
  });

  it('lee plantilla nueva (Nombres / Apellidos / Cédula / …)', () => {
    const buf = bufferFromRows([
      {
        Nombres: 'JULIO',
        Apellidos: 'SUAREZ',
        Cédula: '9.427.286',
        Cargo: 'AYUDANTE',
        'Fecha de ingreso': '2026-08-01',
        Jornada: 'DIURNA',
        Bono: 5,
        'Estado civil': 'Soltero',
      },
    ]);
    const r = parseContratoTrabajoObreroTabla(buf, 'nueva.xlsx');
    assert.equal(r.filas.length, 1);
    assert.equal(r.filas[0]!.cedula, 'V9427286');
    assert.equal(r.filas[0]!.nombres, 'JULIO');
    assert.equal(r.filas[0]!.apellidos, 'SUAREZ');
    assert.equal(r.filas[0]!.fechaIngreso, '2026-08-01');
    assert.equal(r.filas[0]!.bonoUsd, 5);
    assert.equal(r.filas[0]!.estadoCivil, 'Soltero');
    assert.equal(r.filas[0]!.errores.length, 0);
  });

  it('salta filas de título y detecta encabezado (lista consolidada)', () => {
    const buf = bufferFromAoa(
      [
        ['Lista de Obreros Consolidado'],
        ['Obra: Asfaltado', '', 'Fecha: 2026-08-03'],
        [],
        ['N°', 'Nombres y Apellidos', 'Cédula', 'Cargo'],
        [1, 'BRIGIDO ANTONIO GONZALEZ CALVO', '10.199.713', 'AYUDANTE'],
        [2, 'ANTONY JOSE DIAZ DIAZ', '25.479.932', 'ELECTRICISTA'],
      ],
      'Consolidado',
    );
    const r = parseContratoTrabajoObreroTabla(buf, 'Lista_Obreros_Consolidado.xlsx');
    assert.equal(r.filas.length, 2);
    assert.equal(r.filas[0]!.cedula, 'V10199713');
    assert.equal(r.filas[0]!.nombreCompleto, 'BRIGIDO ANTONIO GONZALEZ CALVO');
    assert.equal(r.filas[1]!.cargo, 'ELECTRICISTA');
    assert.equal(r.filas[0]!.errores.length, 0);
    assert.ok(r.avisos.some((a) => /fila/i.test(a)));
  });

  it('infiere columnas por contenido si los encabezados son opacos', () => {
    const buf = bufferFromAoa([
      ['ColA', 'ColB', 'ColC'],
      ['AYUDANTE', '10.199.713', 'BRIGIDO ANTONIO GONZALEZ'],
      ['AYUDANTE', '25479932', 'ANTONY JOSE DIAZ DIAZ'],
    ]);
    const r = parseContratoTrabajoObreroTabla(buf, 'opaco.xlsx');
    assert.equal(r.filas.length, 2);
    assert.ok(r.filas[0]!.cedula === 'V10199713' || r.filas[0]!.cedula === 'V25479932');
    assert.ok(r.filas.every((f) => f.nombreCompleto && f.nombreCompleto.length > 5));
  });
});
