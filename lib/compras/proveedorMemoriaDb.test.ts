import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import {
  cargarCorreccionesProveedor,
  cargarPerfilProveedor,
  enriquecerExtractedConMemoria,
  registrarCorreccionesTrasEdicion,
  refrescarPerfilProveedorTrasConfirmacion,
} from './proveedorMemoriaDb'
import { claveRifPerfil } from './proveedorMemoria'

const RIF = 'J-12345678-9'
const CLAVE = claveRifPerfil(RIF)

describe('proveedorMemoriaDb', () => {
  it('enriquece un OCR nuevo con perfil y correcciones guardadas', async () => {
    const db = crearFakeSupabase({
      ci_proveedor_perfil: [
        {
          rif_normalizado: CLAVE,
          rif_etiqueta: RIF,
          nombre_canonico: 'Ferretería XYZ C.A.',
          moneda_habitual: 'USD',
          dias_credito_habitual: 30,
          condicion_pago_habitual: 'credito',
          entidad_id_habitual: 'ent-1',
          proyecto_id_habitual: 'proy-1',
          ubicacion_destino_id_habitual: 'alm-1',
          imputacion_habitual: 'obra',
          n_facturas: 4,
          items: [
            { nombre_norm: 'cabilla 3 8', nombre_habitual: 'CABILLA 3/8', precio_mediana: 10, n: 4 },
          ],
        },
      ],
      ci_proveedor_correcciones: [
        {
          rif_normalizado: CLAVE,
          campo: 'supplier_name',
          valor_original: 'FERRE XYZ',
          valor_corregido: 'Ferretería XYZ C.A.',
          n_veces: 2,
        },
        {
          rif_normalizado: CLAVE,
          campo: 'item_description',
          valor_original: 'cabilla 3/8mm',
          valor_corregido: 'CABILLA 3/8',
          n_veces: 1,
        },
      ],
    })

    const { extracted, anomalias } = await enriquecerExtractedConMemoria(
      db as unknown as SupabaseClient,
      {
        supplier_rif: 'J123456789',
        supplier_name: 'FERRE XYZ',
        total_amount: 10,
        items: [{ description: 'cabilla 3/8mm', quantity: 1, unit_price: 10 }],
      },
    )

    assert.equal(extracted.supplier_name, 'Ferretería XYZ C.A.')
    assert.equal(extracted.items?.[0]?.description, 'CABILLA 3/8')
    assert.equal(extracted.moneda, 'USD')
    assert.ok(extracted.campos_sugeridos?.includes('moneda'))
    assert.equal(extracted.sugerencias_destino?.proyecto_id, 'proy-1')
    assert.equal(extracted.ocr_original?.supplier_name, 'FERRE XYZ')
    assert.equal(anomalias.some((a) => a.tipo === 'precio_cero'), false)
  })

  it('guarda correcciones y actualiza el perfil al confirmar', async () => {
    const db = crearFakeSupabase({
      ci_proveedor_perfil: [],
      ci_proveedor_correcciones: [],
      contabilidad_compras: [],
    })
    const sb = db as unknown as SupabaseClient

    await registrarCorreccionesTrasEdicion(sb, {
      rif: RIF,
      original: { moneda: 'VES', supplier_name: 'FERRE XYZ', supplier_rif: RIF },
      corregido: { moneda: 'USD', supplier_name: 'Ferretería XYZ C.A.', supplier_rif: RIF },
      origen: 'web',
    })

    const corr = await cargarCorreccionesProveedor(sb, RIF)
    assert.equal(corr.length, 2)
    assert.ok(corr.some((c) => c.campo === 'moneda' && c.valor_corregido === 'USD'))

    await refrescarPerfilProveedorTrasConfirmacion(sb, {
      extracted: {
        supplier_rif: RIF,
        supplier_name: 'Ferretería XYZ C.A.',
        moneda: 'USD',
        condicion_pago: 'contado',
        items: [{ description: 'CABILLA 3/8', unit_price: 11 }],
      },
      entidadId: 'ent-1',
      proyectoId: 'proy-1',
      ubicacionDestinoId: 'alm-1',
    })

    const perfil = await cargarPerfilProveedor(sb, RIF)
    assert.ok(perfil)
    assert.equal(perfil!.nombre_canonico, 'Ferretería XYZ C.A.')
    assert.equal(perfil!.moneda_habitual, 'USD')
    assert.equal(perfil!.entidad_id_habitual, 'ent-1')
    assert.equal(perfil!.items[0]?.nombre_habitual, 'CABILLA 3/8')
  })

  it('no rompe si las tablas no existen (migración pendiente)', async () => {
    const db = crearFakeSupabase({}, { tablasAusentes: ['ci_proveedor_perfil', 'ci_proveedor_correcciones'] })
    const sb = db as unknown as SupabaseClient
    assert.equal(await cargarPerfilProveedor(sb, RIF), null)
    assert.deepEqual(await cargarCorreccionesProveedor(sb, RIF), [])
    const { extracted } = await enriquecerExtractedConMemoria(sb, {
      supplier_rif: RIF,
      supplier_name: 'X',
    })
    assert.equal(extracted.supplier_name, 'X')
  })
})
