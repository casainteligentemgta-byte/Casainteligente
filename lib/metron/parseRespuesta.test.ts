/**
 * Ejecutar: npx tsx --test lib/metron/parseRespuesta.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonObject, parseRespuestaMetron } from './parseRespuesta';

describe('parseRespuestaMetron', () => {
  it('parsea JSON estricto con cómputos', () => {
    const raw = JSON.stringify({
      disciplina: 'arq',
      especialidades: ['arq'],
      titulo_plano: 'Planta baja',
      escala_detectada: '1:50',
      resumen: 'Vivienda unifamiliar.',
      supuestos: ['Muros 15 cm'],
      alertas: [],
      computos: [
        {
          codigo_sugerido: 'ARQ-001',
          descripcion: 'Mampostería de bloque',
          unidad: 'M2',
          cantidad: 120,
          precio_unitario_estimado: 25,
          monto_estimado: 0,
          capitulo_sugerido: 'Albañilería',
          supuesto: 'Área de muros estimada',
          confianza: 70,
          disciplina: 'arq',
        },
      ],
    });

    const r = parseRespuestaMetron(raw);
    assert.equal(r.disciplina, 'arq');
    assert.equal(r.computos.length, 1);
    assert.equal(r.computos[0].monto_estimado, 3000);
    assert.equal(r.computos[0].unidad, 'M2');
  });

  it('extrae JSON de fence markdown', () => {
    const obj = extractJsonObject(
      '```json\n{"disciplina":"ele","resumen":"x","computos":[]}\n```',
    ) as { disciplina: string };
    assert.equal(obj.disciplina, 'ele');
  });
});
