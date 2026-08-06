import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATALOGO_FASES_TECNICAS_OBRA,
  componerTextoFases,
  faseEstaSeleccionada,
  parseFasesDesdeTexto,
  todasFasesCatalogo,
  toggleFaseEnTexto,
} from '@/lib/talento/catalogoFasesTecnicasObra';
import { claveNormFaseTecnica, trimFaseTecnica } from '@/lib/talento/fasesTecnicasContrato';

describe('fasesTecnicasContrato', () => {
  it('claveNorm colapsa acentos y mayúsculas', () => {
    assert.equal(
      claveNormFaseTecnica('  Instalaciones Eléctricas, Sanitarias y de Gas  '),
      'instalaciones electricas, sanitarias y de gas',
    );
  });

  it('trimFaseTecnica rechaza vacío / corto', () => {
    assert.equal(trimFaseTecnica(null), null);
    assert.equal(trimFaseTecnica('  '), null);
    assert.equal(trimFaseTecnica('a'), null);
    assert.equal(trimFaseTecnica('  Acabados  '), 'Acabados');
  });
});

describe('catalogoFasesTecnicasObra', () => {
  it('tiene 7 rubros y 50 fases', () => {
    assert.equal(CATALOGO_FASES_TECNICAS_OBRA.length, 7);
    assert.equal(todasFasesCatalogo().length, 50);
  });

  it('compone y parsea selección múltiple', () => {
    const t = componerTextoFases([
      'Replanteo, topografía y nivelación',
      'Excavación de zanjas y zapatas',
    ]);
    assert.equal(
      t,
      'Replanteo, topografía y nivelación; Excavación de zanjas y zapatas',
    );
    assert.deepEqual(parseFasesDesdeTexto(t), [
      'Replanteo, topografía y nivelación',
      'Excavación de zanjas y zapatas',
    ]);
  });

  it('toggle agrega y quita fases', () => {
    let t = toggleFaseEnTexto('', 'Pintura general en paredes, techos y fachadas');
    assert.ok(faseEstaSeleccionada(t, 'Pintura general en paredes, techos y fachadas'));
    t = toggleFaseEnTexto(t, 'Pintura general en paredes, techos y fachadas');
    assert.equal(t, '');
  });
});
