/**
 * Ejecutar: npx tsx --test lib/legal/iurisVigia.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractIurisJsonObject,
  parseIurisVigiaReport,
} from './iurisVigiaParse';

describe('extractIurisJsonObject', () => {
  it('parsea JSON puro', () => {
    const obj = extractIurisJsonObject(
      '{"descripcion":"ok","nota_legal":"Art. 62","estado_cumplimiento":"Conforme","riesgo_identificado":"bajo"}',
    );
    assert.equal(obj.descripcion, 'ok');
  });

  it('extrae JSON dentro de fence markdown con prosa', () => {
    const obj = extractIurisJsonObject(`Aquí el análisis:
\`\`\`json
{"descripcion":"cama y closet","nota_legal":"N/A","estado_cumplimiento":"Observación","riesgo_identificado":"ninguno"}
\`\`\`
`);
    assert.equal(obj.descripcion, 'cama y closet');
    assert.equal(obj.estado_cumplimiento, 'Observación');
  });

  it('extrae el primer objeto entre llaves', () => {
    const obj = extractIurisJsonObject(
      'Resultado:\n{"descripcion":"x","nota_legal":"y","estado_cumplimiento":"Conforme","riesgo_identificado":"z"}\nfin',
    );
    assert.equal(obj.descripcion, 'x');
  });

  it('acepta array con un objeto', () => {
    const obj = extractIurisJsonObject(
      '[{"descripcion":"arr","nota_legal":"n","estado_cumplimiento":"Conforme","riesgo_identificado":"r"}]',
    );
    assert.equal(obj.descripcion, 'arr');
  });

  it('acepta JSON doble-codificado', () => {
    const inner =
      '{"descripcion":"d","nota_legal":"n","estado_cumplimiento":"Conforme","riesgo_identificado":"r"}';
    const obj = extractIurisJsonObject(JSON.stringify(inner));
    assert.equal(obj.descripcion, 'd');
  });
});

describe('parseIurisVigiaReport', () => {
  it('mapea claves alternativas y rellena faltantes', () => {
    const report = parseIurisVigiaReport(
      JSON.stringify({
        description: 'Vista interior',
        notaLegal: 'Art. 56 LOPCYMAT',
        estado: 'No Conforme',
        risk: 'Caída de objetos',
      }),
    );
    assert.equal(report.descripcion, 'Vista interior');
    assert.equal(report.nota_legal, 'Art. 56 LOPCYMAT');
    assert.equal(report.estado_cumplimiento, 'No Conforme');
    assert.equal(report.riesgo_identificado, 'Caída de objetos');
  });

  it('usa "No analizable" si faltan campos', () => {
    const report = parseIurisVigiaReport('{}');
    assert.equal(report.descripcion, 'No analizable');
    assert.equal(report.estado_cumplimiento, 'No analizable');
  });
});
