import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  agregarPerfilProveedor,
  aplicarCorreccionesExtracted,
  claveRifPerfil,
  construirHintProveedor,
  correccionesDeLineas,
  correccionesDesdeCambio,
  detectarAnomaliasFactura,
  enriquecerExtractedConMemoriaPuro,
  esCampoSugerido,
  mediana,
  moda,
  normalizarNombreItem,
  prefillingDesdePerfil,
  sinCampoSugerido,
  snapshotOcrOriginal,
  textoAnomaliasParaNotificacion,
  UMBRAL_DESVIO_PRECIO,
  type CorreccionProveedor,
  type ProveedorPerfil,
} from './proveedorMemoria'

const RIF = 'J-12345678-9'

function perfilBase(over: Partial<ProveedorPerfil> = {}): ProveedorPerfil {
  return {
    rif_normalizado: claveRifPerfil(RIF),
    rif_etiqueta: RIF,
    nombre_canonico: 'Ferretería XYZ C.A.',
    moneda_habitual: 'USD',
    dias_credito_habitual: 30,
    condicion_pago_habitual: 'credito',
    entidad_id_habitual: 'ent-1',
    proyecto_id_habitual: 'proy-1',
    ubicacion_destino_id_habitual: 'alm-1',
    imputacion_habitual: 'obra',
    clasificacion_gasto_habitual: null,
    n_facturas: 5,
    items: [
      { nombre_norm: 'cabilla 3 8', nombre_habitual: 'CABILLA 3/8', precio_mediana: 10, n: 4 },
    ],
    ...over,
  }
}

describe('normalización', () => {
  it('unifica RIF con o sin guiones', () => {
    assert.equal(claveRifPerfil('J123456789'), 'J-12345678-9')
    assert.equal(claveRifPerfil('j-12345678-9'), 'J-12345678-9')
    assert.equal(claveRifPerfil(' J 12345678-9 '), 'J-12345678-9')
  })

  it('normaliza nombres de ítem (acentos, barras, mayúsculas)', () => {
    assert.equal(normalizarNombreItem('CABILLA 3/8'), 'cabilla 3 8')
    assert.equal(normalizarNombreItem('Cabilla  3-8'), 'cabilla 3 8')
    assert.equal(normalizarNombreItem('Cemento Gris'), 'cemento gris')
  })

  it('calcula mediana par e impar', () => {
    assert.equal(mediana([1, 3, 2]), 2)
    assert.equal(mediana([10, 20, 30, 40]), 25)
    assert.equal(mediana([]), null)
  })

  it('moda respeta el primero en empate', () => {
    assert.equal(moda(['USD', 'VES', 'USD']), 'USD')
    assert.equal(moda(['VES', 'USD']), 'VES')
    assert.equal(moda([]), null)
  })
})

describe('agregación de perfil', () => {
  it('toma lo más frecuente y la mediana de precios por ítem', () => {
    const perfil = agregarPerfilProveedor([
      {
        supplier_rif: RIF,
        supplier_name: 'Ferretería XYZ C.A.',
        moneda: 'USD',
        dias_credito: 30,
        condicion_pago: 'credito',
        entidad_id: 'ent-1',
        proyecto_id: 'proy-1',
        ubicacion_destino_id: 'alm-1',
        imputacion: 'obra',
        items: [
          { description: 'CABILLA 3/8', unit_price: 8 },
          { description: 'Cemento', unit_price: 5 },
        ],
      },
      {
        supplier_rif: 'J123456789',
        supplier_name: 'Ferretería XYZ C.A.',
        moneda: 'USD',
        dias_credito: 30,
        condicion_pago: 'credito',
        entidad_id: 'ent-1',
        proyecto_id: 'proy-2',
        ubicacion_destino_id: 'alm-1',
        imputacion: 'obra',
        items: [{ description: 'cabilla 3-8', unit_price: 12 }],
      },
      {
        supplier_rif: RIF,
        supplier_name: 'Otro nombre',
        moneda: 'VES',
        dias_credito: 15,
        condicion_pago: 'contado',
        entidad_id: 'ent-2',
        proyecto_id: 'proy-1',
        ubicacion_destino_id: 'alm-2',
        imputacion: 'entidad',
        items: [{ description: 'CABILLA 3/8', unit_price: 10 }],
      },
    ])

    assert.ok(perfil)
    assert.equal(perfil!.nombre_canonico, 'Ferretería XYZ C.A.')
    assert.equal(perfil!.moneda_habitual, 'USD')
    assert.equal(perfil!.dias_credito_habitual, 30)
    assert.equal(perfil!.condicion_pago_habitual, 'credito')
    assert.equal(perfil!.entidad_id_habitual, 'ent-1')
    assert.equal(perfil!.proyecto_id_habitual, 'proy-1')
    assert.equal(perfil!.ubicacion_destino_id_habitual, 'alm-1')
    assert.equal(perfil!.imputacion_habitual, 'obra')
    assert.equal(perfil!.n_facturas, 3)
    const cabilla = perfil!.items.find((i) => i.nombre_norm === 'cabilla 3 8')
    assert.ok(cabilla)
    assert.equal(cabilla!.precio_mediana, 10)
    assert.equal(cabilla!.n, 3)
    assert.equal(cabilla!.nombre_habitual, 'CABILLA 3/8')
  })

  it('no arma perfil sin RIF', () => {
    assert.equal(agregarPerfilProveedor([{ supplier_name: 'X', items: [] }]), null)
  })
})

describe('correcciones', () => {
  it('mapea nombre, moneda e ítems conocidos', () => {
    const correcciones: CorreccionProveedor[] = [
      { campo: 'supplier_name', valor_original: 'FERRE XYZ', valor_corregido: 'Ferretería XYZ C.A.' },
      { campo: 'moneda', valor_original: 'VES', valor_corregido: 'USD' },
      { campo: 'item_description', valor_original: 'cabilla 3/8mm', valor_corregido: 'CABILLA 3/8' },
    ]
    const next = aplicarCorreccionesExtracted(
      {
        supplier_name: 'FERRE XYZ',
        moneda: 'VES',
        items: [{ description: 'Cabilla 3/8mm', quantity: 2, unit_price: 10 }],
      },
      correcciones,
    )
    assert.equal(next.supplier_name, 'Ferretería XYZ C.A.')
    assert.equal(next.moneda, 'USD')
    assert.equal(next.items?.[0]?.description, 'CABILLA 3/8')
  })

  it('registra original → corregido y líneas', () => {
    assert.deepEqual(
      correccionesDesdeCambio({
        original: { moneda: 'VES', supplier_name: 'A' },
        corregido: { moneda: 'USD', supplier_name: 'A' },
      }),
      [{ campo: 'moneda', valor_original: 'VES', valor_corregido: 'USD' }],
    )
    assert.deepEqual(
      correccionesDeLineas(
        [{ description: 'cabilla 3/8mm' }],
        [{ description: 'CABILLA 3/8' }],
      ),
      [{ campo: 'item_description', valor_original: 'cabilla 3/8mm', valor_corregido: 'CABILLA 3/8' }],
    )
    assert.deepEqual(
      correccionesDeLineas([{ description: 'CABILLA 3/8' }], [{ description: 'cabilla 3/8' }]),
      [],
    )
  })
})

describe('prefill sugerido', () => {
  it('rellena moneda, crédito y destino ausentes y los marca sugeridos', () => {
    const { extracted, camposSugeridos } = prefillingDesdePerfil(
      { supplier_rif: RIF, supplier_name: 'Ferretería XYZ C.A.', items: [] },
      perfilBase(),
    )
    assert.equal(extracted.moneda, 'USD')
    assert.equal(extracted.condicion_pago, 'credito')
    assert.equal(extracted.dias_credito, 30)
    assert.ok(camposSugeridos.includes('moneda'))
    assert.ok(camposSugeridos.includes('dias_credito'))
    assert.equal(extracted.sugerencias_destino?.proyecto_id, 'proy-1')
    assert.ok(esCampoSugerido(extracted, 'proyecto_id'))
    assert.deepEqual(sinCampoSugerido(extracted, 'moneda').campos_sugeridos?.includes('moneda'), false)
  })

  it('no pisa moneda ya confirmada', () => {
    const { extracted } = prefillingDesdePerfil(
      { moneda: 'VES', supplier_rif: RIF },
      perfilBase(),
    )
    assert.equal(extracted.moneda, 'VES')
    assert.equal(esCampoSugerido(extracted, 'moneda'), false)
  })
})

describe('anomalías', () => {
  it(`alerta precio >${UMBRAL_DESVIO_PRECIO * 100}% vs mediana, precio 0, moneda distinta y suma ≠ total`, () => {
    const perfil = perfilBase()
    const anom = detectarAnomaliasFactura({
      extracted: {
        moneda: 'VES',
        total_amount: 100,
        items: [
          { description: 'CABILLA 3/8', quantity: 1, unit_price: 20 },
          { description: 'Tornillo suelto', quantity: 1, unit_price: 0 },
        ],
      },
      perfil,
    })
    const tipos = anom.map((a) => a.tipo).sort()
    assert.deepEqual(tipos, ['moneda_distinta', 'precio_cero', 'precio_desviado', 'suma_lineas_distinta'].sort())
    assert.ok(anom.every((a) => a.mensaje.length > 8))
    assert.match(textoAnomaliasParaNotificacion(anom), /Revisar|precio|moneda|suma|0/i)
  })

  it('no alerta desvío de precio con una sola muestra histórica', () => {
    const anom = detectarAnomaliasFactura({
      extracted: {
        moneda: 'USD',
        items: [{ description: 'CABILLA 3/8', quantity: 1, unit_price: 99 }],
      },
      perfil: perfilBase({
        items: [{ nombre_norm: 'cabilla 3 8', nombre_habitual: 'CABILLA 3/8', precio_mediana: 10, n: 1 }],
      }),
    })
    assert.equal(anom.some((a) => a.tipo === 'precio_desviado'), false)
  })
})

describe('enriquecer + hint', () => {
  it('deja snapshot OCR, aplica corrección y sugiere el resto', () => {
    const next = enriquecerExtractedConMemoriaPuro({
      ocr: {
        supplier_rif: RIF,
        supplier_name: 'FERRE XYZ',
        items: [{ description: 'cabilla 3/8mm', quantity: 1, unit_price: 10 }],
        total_amount: 10,
      },
      perfil: perfilBase(),
      correcciones: [
        { campo: 'supplier_name', valor_original: 'FERRE XYZ', valor_corregido: 'Ferretería XYZ C.A.' },
        { campo: 'item_description', valor_original: 'cabilla 3/8mm', valor_corregido: 'CABILLA 3/8' },
      ],
    })
    assert.equal(next.ocr_original?.supplier_name, 'FERRE XYZ')
    assert.equal(next.supplier_name, 'Ferretería XYZ C.A.')
    assert.equal(next.items?.[0]?.description, 'CABILLA 3/8')
    assert.equal(next.moneda, 'USD')
    assert.ok(esCampoSugerido(next, 'moneda'))
    assert.equal(snapshotOcrOriginal(next).supplier_name, 'Ferretería XYZ C.A.')
  })

  it('arma un hint corto en español', () => {
    const hint = construirHintProveedor(perfilBase(), [
      { campo: 'supplier_name', valor_original: 'FERRE XYZ', valor_corregido: 'Ferretería XYZ C.A.' },
    ])
    assert.match(hint, /Ferretería XYZ/)
    assert.match(hint, /USD/)
    assert.match(hint, /CABILLA 3\/8/)
    assert.ok(hint.length < 900)
  })
})
