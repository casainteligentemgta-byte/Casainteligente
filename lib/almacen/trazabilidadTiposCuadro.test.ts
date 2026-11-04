import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  clasificarTipoMovimientoTrazabilidad,
  type ContextoEnriquecimientoTrazabilidad,
} from '@/lib/almacen/trazabilidadTiposCuadro'

function ctxVacio(): ContextoEnriquecimientoTrazabilidad {
  return {
    comprasFactura: new Map(),
    recepcion: new Map(),
    transferencia: new Map(),
    contabilidadPorInvoice: new Map(),
  }
}

function mov(parcial: Partial<{
  tipo_movimiento: string
  delta_disponible: number
  notas: string | null
  referencia_tipo: string | null
  referencia_id: string | null
}>) {
  return {
    id: 'm1',
    tipo_movimiento: 'ajuste',
    delta_disponible: 0,
    delta_reservada: null,
    delta_transito_entrante: null,
    created_at: '2026-11-03T00:00:00Z',
    notas: null,
    referencia_tipo: null,
    referencia_id: null,
    documento_id: null,
    ...parcial,
  }
}

describe('clasificarTipoMovimientoTrazabilidad', () => {
  it('marca kardex «baja» como pérdida / deterioro aunque no haya transferencia en contexto', () => {
    assert.equal(
      clasificarTipoMovimientoTrazabilidad(
        mov({ tipo_movimiento: 'baja', delta_disponible: -2, notas: 'Baja · Dañado' }),
        ctxVacio(),
      ),
      'perdida_deterioro',
    )
    assert.equal(
      clasificarTipoMovimientoTrazabilidad(
        mov({ tipo_movimiento: 'baja', delta_disponible: 2, notas: 'Baja · Dañado' }),
        ctxVacio(),
      ),
      'perdida_deterioro',
    )
  })

  it('marca retorno_merma como pérdida / deterioro', () => {
    const ctx = ctxVacio()
    ctx.transferencia.set('t1', {
      id: 't1',
      codigo: 'MER-1',
      tipo_movimiento: 'retorno_merma',
      observaciones: 'Baja · Robo',
      origen_nombre: 'Almacén Norte',
      destino_nombre: 'Deterioro y bajas',
      proyecto_nombre: 'Obra Norte',
    })
    assert.equal(
      clasificarTipoMovimientoTrazabilidad(
        mov({
          tipo_movimiento: 'baja',
          delta_disponible: -1,
          referencia_tipo: 'transferencias_inventario',
          referencia_id: 't1',
        }),
        ctx,
      ),
      'perdida_deterioro',
    )
  })
})
