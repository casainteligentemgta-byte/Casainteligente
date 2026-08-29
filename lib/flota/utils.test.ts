import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  consumoKmPorLitro,
  diasHasta,
  normalizarPlaca,
  parseFechaIso,
  parseNumero,
  partirTextoEnChunks,
  puntuacionBusqueda,
} from './utils';

describe('flota/utils', () => {
  it('normaliza placa venezolana', () => {
    assert.equal(normalizarPlaca('ab-123-cd'), 'AB123CD');
    assert.equal(normalizarPlaca('  A12 BC3D '), 'A12BC3D');
  });

  it('parsea números con coma', () => {
    assert.equal(parseNumero('12,5'), 12.5);
    assert.equal(parseNumero(''), null);
  });

  it('valida fecha ISO', () => {
    assert.equal(parseFechaIso('2026-08-29'), '2026-08-29');
    assert.equal(parseFechaIso('29/08/2026'), null);
  });

  it('calcula días hasta vencimiento', () => {
    const now = new Date('2026-08-29T15:00:00Z');
    assert.equal(diasHasta('2026-08-29', now), 0);
    assert.equal(diasHasta('2026-09-03', now), 5);
    assert.equal(diasHasta('2026-08-20', now), -9);
  });

  it('calcula km/l entre cargas', () => {
    assert.equal(
      consumoKmPorLitro({ odometroAnterior: 1000, odometroActual: 1120, litros: 40 }),
      3,
    );
    assert.equal(
      consumoKmPorLitro({ odometroAnterior: 1120, odometroActual: 1000, litros: 40 }),
      null,
    );
  });

  it('parte texto en chunks con solape', () => {
    const chunks = partirTextoEnChunks('A'.repeat(2000), 500, 50);
    assert.ok(chunks.length >= 4);
    assert.ok(chunks.every((c) => c.length > 0));
  });

  it('puntúa búsqueda por tokens', () => {
    assert.ok(puntuacionBusqueda('cambio de aceite motor diesel', 'aceite diesel') > 0.9);
    assert.equal(puntuacionBusqueda('frenos', 'inyeccion'), 0);
  });
});
