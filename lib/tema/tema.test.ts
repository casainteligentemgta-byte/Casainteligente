import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import vm from 'node:vm';
import {
  CLAVE_TEMA,
  SCRIPT_TEMA_INICIAL,
  etiquetaPreferenciaTema,
  leerPreferenciaTema,
  resolverTema,
  rutaConTema,
  siguientePreferenciaTema,
  type PreferenciaTema,
} from './tema';
import { tinta, tintaTexto, tonoTexto } from './tinta';

describe('preferencia de tema', () => {
  it('lo que no sea «claro» u «oscuro» es automático', () => {
    assert.equal(leerPreferenciaTema('claro'), 'claro');
    assert.equal(leerPreferenciaTema('oscuro'), 'oscuro');
    for (const v of [null, undefined, '', 'auto', 'light', 42]) assert.equal(leerPreferenciaTema(v), 'auto');
  });

  it('automático sigue al teléfono; claro y oscuro mandan sobre él', () => {
    assert.equal(resolverTema('auto', true), 'dark');
    assert.equal(resolverTema('auto', false), 'light');
    assert.equal(resolverTema('claro', true), 'light');
    assert.equal(resolverTema('oscuro', false), 'dark');
  });

  it('el botón recorre automático → claro → oscuro → automático', () => {
    assert.equal(siguientePreferenciaTema('auto'), 'claro');
    assert.equal(siguientePreferenciaTema('claro'), 'oscuro');
    assert.equal(siguientePreferenciaTema('oscuro'), 'auto');
  });

  it('cada opción tiene su nombre', () => {
    assert.deepEqual(
      (['auto', 'claro', 'oscuro'] as PreferenciaTema[]).map(etiquetaPreferenciaTema),
      ['Auto', 'Claro', 'Oscuro'],
    );
  });
});

describe('módulos con tema claro', () => {
  it('Clientes, Productos y Presupuestos, con sus pantallas internas', () => {
    for (const r of ['/clientes', '/clientes/nuevo', '/clientes/abc/editar', '/productos', '/productos/3/editar', '/productos/importar-lista', '/presupuestos', '/ventas']) {
      assert.equal(rutaConTema(r), true, r);
    }
  });

  it('los demás módulos siguen en oscuro hasta revisarlos', () => {
    for (const r of ['/', '/clientes-viejos', '/productos-viejos', '/presupuestosx', '/ventasx', '', null, undefined]) {
      assert.equal(rutaConTema(r), false, String(r));
    }
  });

  it('la vista previa del presupuesto es el documento: siempre en papel blanco', () => {
    assert.equal(rutaConTema('/ventas/preview'), false);
  });
});

describe('script que fija el tema antes de pintar', () => {
  function ejecutar(guardado: string | null, telefonoEnOscuro: boolean, almacenRoto = false): string | undefined {
    const atributos: Record<string, string> = {};
    const contexto = {
      document: { documentElement: { setAttribute: (k: string, v: string) => (atributos[k] = v) } },
      localStorage: {
        getItem: (k: string) => {
          if (almacenRoto) throw new Error('sin almacenamiento');
          assert.equal(k, CLAVE_TEMA);
          return guardado;
        },
      },
      window: { matchMedia: () => ({ matches: telefonoEnOscuro }) },
    };
    vm.runInNewContext(SCRIPT_TEMA_INICIAL, contexto);
    return atributos['data-theme'];
  }

  it('decide igual que resolverTema en todos los casos', () => {
    for (const guardado of [null, 'auto', 'claro', 'oscuro', 'basura']) {
      for (const oscuro of [true, false]) {
        assert.equal(
          ejecutar(guardado, oscuro),
          resolverTema(leerPreferenciaTema(guardado), oscuro),
          `${guardado} / teléfono oscuro=${oscuro}`,
        );
      }
    }
  });

  it('si el navegador no deja leer la preferencia, queda en oscuro', () => {
    assert.equal(ejecutar('claro', false, true), 'dark');
  });
});

describe('tinta translúcida', () => {
  it('rellenos: misma opacidad sobre la tinta del tema', () => {
    assert.equal(tinta(0.1), 'rgb(var(--tinta) / 0.1)');
  });

  it('color vivo como texto: se oscurece en claro con la mezcla del tema', () => {
    assert.equal(tonoTexto('#FFD60A'), 'color-mix(in srgb, #FFD60A var(--tono-mezcla, 100%), black)');
  });

  it('texto: la opacidad se realza según el tema', () => {
    assert.equal(tintaTexto(0.45), 'rgb(var(--tinta) / calc(0.45 * var(--tinta-realce, 1)))');
  });
});
