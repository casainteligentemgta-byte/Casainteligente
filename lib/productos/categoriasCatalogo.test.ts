import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CATEGORIAS_CATALOGO_DEFAULT,
  SUBCATEGORIAS_DEFAULT,
  arbolDeFilas,
  categoriaExistenteEquivalente,
  categoriasAMostrar,
  claveNombreCategoria,
  crearSubcategoriaCatalogo,
  etiquetaCategoria,
  mergeNombresCategoria,
  opcionesCategoriaConSub,
  separarEtiquetaCategoria,
  subcategoriasAMostrar,
  subcategoriasDe,
  type FilaCategoria,
} from './categoriasCatalogo';

describe('categorías del catálogo', () => {
  it('«Domotica» y «Domótica» son la misma', () => {
    assert.equal(claveNombreCategoria('Domótica'), claveNombreCategoria(' domotica '));
    assert.equal(claveNombreCategoria('Cercos  Eléctricos'), claveNombreCategoria('CERCOS ELECTRICOS'));
    assert.notEqual(claveNombreCategoria('Cámaras IP'), claveNombreCategoria('Cámaras Análogas'));
  });

  it('al unir listas queda una sola, la que venía primero (la de base, con acento)', () => {
    const lista = mergeNombresCategoria(CATEGORIAS_CATALOGO_DEFAULT, ['Domotica', 'Cercos Electricos', 'Opción 3']);
    assert.equal(lista.filter((n) => claveNombreCategoria(n) === 'domotica').length, 1);
    assert.ok(lista.includes('Domótica'));
    assert.ok(!lista.includes('Domotica'));
    assert.ok(!lista.includes('Cercos Electricos'));
    assert.ok(lista.includes('Opción 3'));
  });

  it('reconoce una categoría que ya existe con otro acento o mayúsculas', () => {
    assert.equal(categoriaExistenteEquivalente('cercos electricos', CATEGORIAS_CATALOGO_DEFAULT), 'Cercos Eléctricos');
    assert.equal(categoriaExistenteEquivalente('Iluminación', CATEGORIAS_CATALOGO_DEFAULT), null);
    assert.equal(categoriaExistenteEquivalente('  ', CATEGORIAS_CATALOGO_DEFAULT), null);
  });

  it('con la tabla disponible, lo guardado en un navegador no revive categorías borradas', () => {
    const lista = categoriasAMostrar(['Network', 'Iluminación'], [], ['Opción 3']);
    assert.ok(lista.includes('Iluminación'));
    assert.ok(!lista.includes('Opción 3'));
  });

  it('si la tabla no responde, se usa lo que haya: productos y memoria local', () => {
    const lista = categoriasAMostrar(null, ['Audio'], ['Opción 3']);
    assert.ok(lista.includes('Audio'));
    assert.ok(lista.includes('Opción 3'));
    assert.ok(lista.includes('Domótica'));
  });
});

describe('subcategorías', () => {
  const FILAS: FilaCategoria[] = [
    { id: 'c1', name: 'C.C.T.V', parent_id: null },
    { id: 'c2', name: 'Domótica', parent_id: null },
    { id: 's1', name: 'Cámaras IP', parent_id: 'c1' },
    { id: 's2', name: 'Cámaras Análogas', parent_id: 'c1' },
    { id: 's3', name: 'Accesorios', parent_id: 'c1' },
    { id: 's4', name: 'Accesorios', parent_id: 'c2' },
    { id: 's5', name: 'Huérfana', parent_id: 'no-existe' },
  ];

  it('las cámaras ya no son categorías sueltas: viven dentro de C.C.T.V', () => {
    assert.ok(!(CATEGORIAS_CATALOGO_DEFAULT as readonly string[]).includes('Cámaras IP'));
    assert.ok(!(CATEGORIAS_CATALOGO_DEFAULT as readonly string[]).includes('Cámaras Análogas'));
    assert.deepEqual(SUBCATEGORIAS_DEFAULT['C.C.T.V'], ['Cámaras IP', 'Cámaras Análogas', 'Otros dispositivos', 'Accesorios']);
  });

  it('arma el árbol: las filas con madre son subcategorías y no aparecen como categorías', () => {
    const arbol = arbolDeFilas(FILAS);
    assert.deepEqual(arbol.categorias, ['C.C.T.V', 'Domótica']);
    assert.deepEqual(arbol.subcategorias, {
      'C.C.T.V': ['Cámaras IP', 'Cámaras Análogas', 'Accesorios'],
      Domótica: ['Accesorios'],
    });
  });

  it('el mismo nombre puede existir en dos categorías', () => {
    const arbol = arbolDeFilas(FILAS);
    assert.deepEqual(subcategoriasDe(arbol, 'domotica'), ['Accesorios']);
    assert.deepEqual(subcategoriasDe(arbol, 'Network'), []);
    assert.deepEqual(subcategoriasDe(arbol, null), []);
  });

  it('a las guardadas se suman las de fábrica, sin repetir', () => {
    const arbol = arbolDeFilas(FILAS);
    const mostradas = subcategoriasAMostrar(['C.C.T.V', 'Domótica', 'Network'], arbol.subcategorias);
    assert.deepEqual(mostradas['C.C.T.V'], ['Cámaras IP', 'Cámaras Análogas', 'Otros dispositivos', 'Accesorios']);
    assert.deepEqual(mostradas['Domótica'], ['Accesorios']);
    assert.equal(mostradas['Network'], undefined);
    // Sin tabla (sin conexión) quedan las de fábrica.
    assert.deepEqual(subcategoriasAMostrar(['C.C.T.V'], null)['C.C.T.V']?.length, 4);
  });

  it('etiqueta «categoría › subcategoría» de ida y vuelta', () => {
    assert.equal(etiquetaCategoria('C.C.T.V', 'Cámaras IP'), 'C.C.T.V › Cámaras IP');
    assert.equal(etiquetaCategoria('Network', null), 'Network');
    assert.equal(etiquetaCategoria(null, 'Cámaras IP'), '');
    assert.deepEqual(separarEtiquetaCategoria('C.C.T.V › Cámaras IP'), { categoria: 'C.C.T.V', subcategoria: 'Cámaras IP' });
    assert.deepEqual(separarEtiquetaCategoria('Network'), { categoria: 'Network', subcategoria: '' });
    assert.deepEqual(separarEtiquetaCategoria(''), { categoria: '', subcategoria: '' });
  });

  it('las opciones del desplegable traen cada categoría y debajo sus subcategorías', () => {
    assert.deepEqual(
      opcionesCategoriaConSub({ categorias: ['C.C.T.V', 'Network'], subcategorias: { 'C.C.T.V': ['Cámaras IP', 'Accesorios'] } }),
      ['C.C.T.V', 'C.C.T.V › Cámaras IP', 'C.C.T.V › Accesorios', 'Network'],
    );
  });
});

describe('crear una subcategoría', () => {
  /** Base de datos de mentira: solo lo que usa `crearSubcategoriaCatalogo`. */
  function baseFalsa(filas: FilaCategoria[]) {
    const insertadas: Array<Record<string, unknown>> = [];
    const consulta = (lista: FilaCategoria[]) => {
      let actual = lista;
      const q: Record<string, unknown> = {
        select: () => q,
        order: () => q,
        is: (_col: string, _v: null) => { actual = actual.filter((f) => f.parent_id == null); return q; },
        eq: (_col: string, v: string) => { actual = actual.filter((f) => f.parent_id === v); return q; },
        ilike: (_col: string, v: string) => { actual = actual.filter((f) => f.name.toLowerCase() === v.toLowerCase()); return q; },
        maybeSingle: async () => ({ data: actual[0] ?? null, error: null }),
        single: async () => ({ data: actual[0] ?? null, error: null }),
        then: (ok: (r: { data: FilaCategoria[]; error: null }) => unknown) => Promise.resolve({ data: actual, error: null }).then(ok),
      };
      return q;
    };
    const supabase = {
      from: () => ({
        ...consulta(filas),
        insert: (fila: Record<string, unknown>) => {
          const repetida = filas.some((f) => (f.parent_id ?? null) === (fila.parent_id ?? null) && f.name.toLowerCase() === String(fila.name).toLowerCase());
          if (repetida) {
            const error = { message: 'duplicate key value violates unique constraint' };
            return { ...consulta([]), then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error }).then(ok) };
          }
          const nueva = { id: `n${filas.length + 1}`, name: String(fila.name), parent_id: (fila.parent_id as string | undefined) ?? null };
          filas.push(nueva);
          insertadas.push(fila);
          return { ...consulta([nueva]), then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok) };
        },
      }),
    };
    return { supabase: supabase as never, insertadas, filas };
  }

  it('la guarda colgada de su categoría', async () => {
    const base = baseFalsa([{ id: 'c1', name: 'C.C.T.V', parent_id: null }]);
    assert.equal(await crearSubcategoriaCatalogo(base.supabase, 'C.C.T.V', '  Grabadores  '), 'Grabadores');
    assert.deepEqual(base.insertadas.map((f) => [f.name, f.parent_id]), [['Grabadores', 'c1']]);
  });

  it('si ya existe con otro acento, devuelve la que está y no crea otra', async () => {
    const base = baseFalsa([
      { id: 'c1', name: 'C.C.T.V', parent_id: null },
      { id: 's1', name: 'Cámaras IP', parent_id: 'c1' },
    ]);
    assert.equal(await crearSubcategoriaCatalogo(base.supabase, 'c.c.t.v', 'camaras ip'), 'Cámaras IP');
    assert.equal(base.insertadas.length, 0);
  });

  it('una de fábrica que aún no está guardada se guarda con su nombre de fábrica', async () => {
    const base = baseFalsa([{ id: 'c1', name: 'C.C.T.V', parent_id: null }]);
    assert.equal(await crearSubcategoriaCatalogo(base.supabase, 'C.C.T.V', 'accesorios'), 'Accesorios');
    assert.deepEqual(base.insertadas.map((f) => [f.name, f.parent_id]), [['Accesorios', 'c1']]);
  });

  it('el mismo nombre en otra categoría es otra subcategoría', async () => {
    const base = baseFalsa([
      { id: 'c1', name: 'C.C.T.V', parent_id: null },
      { id: 'c2', name: 'Domótica', parent_id: null },
      { id: 's1', name: 'Accesorios', parent_id: 'c1' },
    ]);
    assert.equal(await crearSubcategoriaCatalogo(base.supabase, 'Domótica', 'Accesorios'), 'Accesorios');
    assert.deepEqual(base.insertadas.map((f) => [f.name, f.parent_id]), [['Accesorios', 'c2']]);
  });

  it('si la categoría no estaba en la tabla, la crea primero', async () => {
    const base = baseFalsa([]);
    assert.equal(await crearSubcategoriaCatalogo(base.supabase, 'Audio', 'Parlantes'), 'Parlantes');
    assert.deepEqual(base.insertadas.map((f) => f.name), ['Audio', 'Parlantes']);
    assert.equal(base.insertadas[1]!.parent_id, base.filas.find((f) => f.name === 'Audio')!.id);
  });

  it('pide un nombre válido y una categoría', async () => {
    const base = baseFalsa([{ id: 'c1', name: 'C.C.T.V', parent_id: null }]);
    await assert.rejects(() => crearSubcategoriaCatalogo(base.supabase, 'C.C.T.V', 'x'), /mínimo 2/);
    await assert.rejects(() => crearSubcategoriaCatalogo(base.supabase, '', 'Grabadores'), /categoría/);
  });
});
