import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearFakeSupabase } from '../telegram/testing/fakeSupabase'
import {
  empleadoPorTokenInvitacion,
  esTokenInvitacionPlausible,
  esUuid,
  patronoPlanillaPorToken,
  resumenContratoParaFirma,
  vacantePublicaPorId,
  vacantesPublicasDeProyecto,
} from './datosPublicos'

const OBRA = '11111111-1111-4111-8111-111111111111'
const OTRA_OBRA = '22222222-2222-4222-8222-222222222222'
const VACANTE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const VACANTE_CERRADA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TOKEN_ANA = '0f8fad5b-d9cb-469f-a165-70867728950e'
const TOKEN_ANTIGUO_LUIS = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

function db() {
  return crearFakeSupabase({
    recruitment_needs: [
      {
        id: VACANTE,
        title: 'Albañil de primera',
        cargo_nombre: 'Albañil',
        cargo_codigo: '3.1',
        cargo_nivel: 3,
        tipo_vacante: 'obrero',
        protocol_active: true,
        proyecto_modulo_id: OBRA,
        created_at: '2026-10-02T10:00:00Z',
        // Campos internos que no deben salir al público.
        salario_referencial_usd: 450,
        notas_internas: 'Urgente, pagar por encima del tabulador',
        captacion_token: 'token-secreto-de-captacion',
      },
      {
        id: VACANTE_CERRADA,
        title: 'Ayudante',
        cargo_nombre: 'Ayudante',
        cargo_codigo: '1.1',
        cargo_nivel: '1',
        tipo_vacante: 'obrero',
        protocol_active: false,
        proyecto_modulo_id: OBRA,
        created_at: '2026-10-05T10:00:00Z',
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        title: 'Electricista',
        cargo_nombre: 'Electricista',
        cargo_codigo: '5.2',
        cargo_nivel: 5,
        tipo_vacante: 'obrero',
        protocol_active: true,
        proyecto_modulo_id: OTRA_OBRA,
        created_at: '2026-10-03T10:00:00Z',
      },
    ],
    ci_proyectos: [
      { id: OBRA, nombre: 'Rancho Norte', entidad_id: null, presupuesto_usd: 900000 },
      { id: OTRA_OBRA, nombre: 'Torre Sur', entidad_id: null },
    ],
    ci_empleados: [
      {
        id: 'emp-ana',
        nombre_completo: ' Ana Pérez ',
        token_registro: TOKEN_ANA,
        token: TOKEN_ANA,
        proyecto_modulo_id: OBRA,
        recruitment_need_id: VACANTE,
        hoja_vida_obrero: null,
        cedula: 'V-12345678',
      },
      {
        id: 'emp-luis',
        nombre_completo: 'Luis Gómez',
        token_registro: null,
        token: TOKEN_ANTIGUO_LUIS,
        proyecto_modulo_id: OTRA_OBRA,
        recruitment_need_id: null,
        hoja_vida_obrero: null,
      },
    ],
    ci_contratos_empleado_obra: [
      {
        id: 1,
        empleado_id: 'emp-ana',
        'cargo_oficio_desempeño': 'Ayudante',
        salario_basico_diario_ves: 100,
        lugar_prestacion_servicio: '',
        obra_id: OBRA,
        proyecto_id: null,
      },
      {
        id: 2,
        empleado_id: 'emp-ana',
        'cargo_oficio_desempeño': 'Albañil de primera',
        salario_basico_diario_ves: '250.5',
        lugar_prestacion_servicio: '',
        obra_id: OBRA,
        proyecto_id: null,
        monto_acordado_usd: 999,
      },
    ],
    ci_entidades: [],
  }) as unknown as SupabaseClient
}

describe('validación de enlaces', () => {
  it('reconoce identificadores y tokens bien formados', () => {
    assert.equal(esUuid(VACANTE), true)
    assert.equal(esUuid(` ${VACANTE} `), true)
    assert.equal(esUuid('123'), false)
    assert.equal(esUuid(`${VACANTE}' or '1'='1`), false)
    assert.equal(esTokenInvitacionPlausible(TOKEN_ANA), true)
    assert.equal(esTokenInvitacionPlausible('corto'), false)
    assert.equal(esTokenInvitacionPlausible(''), false)
    assert.equal(esTokenInvitacionPlausible('token con espacios y más de 16'), false)
    assert.equal(esTokenInvitacionPlausible('%'.repeat(40)), false)
    assert.equal(esTokenInvitacionPlausible('a'.repeat(300)), false)
  })
})

describe('vacante del enlace de postulación', () => {
  it('entrega cargo, nivel, tipo y obra; nada interno', async () => {
    const r = await vacantePublicaPorId(db(), VACANTE)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.deepEqual(r.need, {
      id: VACANTE,
      title: 'Albañil de primera',
      cargo_nombre: 'Albañil',
      cargo_codigo: '3.1',
      cargo_nivel: 3,
      tipo_vacante: 'obrero',
      protocol_active: true,
      proyecto_modulo_id: OBRA,
    })
    assert.equal(r.proyectoNombre, 'Rancho Norte')
    const texto = JSON.stringify(r)
    assert.equal(texto.includes('450'), false)
    assert.equal(texto.includes('Urgente'), false)
    assert.equal(texto.includes('token-secreto'), false)
    assert.equal(texto.includes('900000'), false)
  })

  it('una vacante cerrada se entrega marcada como cerrada', async () => {
    const r = await vacantePublicaPorId(db(), VACANTE_CERRADA)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.need.protocol_active, false)
    assert.equal(r.need.cargo_nivel, 1)
  })

  it('identificador mal formado o inexistente: no consulta ni inventa', async () => {
    const mal = await vacantePublicaPorId(db(), 'no-es-un-id')
    assert.deepEqual(mal, { ok: false, status: 400, error: 'Enlace de registro no válido.' })
    const nada = await vacantePublicaPorId(db(), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
    assert.equal(nada.ok, false)
    if (!nada.ok) assert.equal(nada.status, 404)
  })

  it('enlace antiguo por obra: solo las vacantes de esa obra, la más nueva primero', async () => {
    const r = await vacantesPublicasDeProyecto(db(), OBRA)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.deepEqual(r.needs.map((n) => n.id), [VACANTE_CERRADA, VACANTE])
    assert.equal(JSON.stringify(r).includes('Urgente'), false)
    const mal = await vacantesPublicasDeProyecto(db(), 'x')
    assert.equal(mal.ok, false)
    const vacia = await vacantesPublicasDeProyecto(db(), '99999999-9999-4999-8999-999999999999')
    assert.deepEqual(vacia, { ok: true, needs: [] })
  })
})

describe('expediente por token de invitación', () => {
  it('encuentra por el token actual; el antiguo solo si se pide', async () => {
    const ana = await empleadoPorTokenInvitacion(db(), TOKEN_ANA, 'id')
    assert.equal(ana?.id, 'emp-ana')
    assert.equal(await empleadoPorTokenInvitacion(db(), TOKEN_ANTIGUO_LUIS, 'id'), null)
    const luis = await empleadoPorTokenInvitacion(db(), TOKEN_ANTIGUO_LUIS, 'id', { tambienTokenAntiguo: true })
    assert.equal(luis?.id, 'emp-luis')
  })

  it('un token corto o vacío nunca devuelve a nadie', async () => {
    assert.equal(await empleadoPorTokenInvitacion(db(), '', 'id', { tambienTokenAntiguo: true }), null)
    assert.equal(await empleadoPorTokenInvitacion(db(), 'emp-ana', 'id', { tambienTokenAntiguo: true }), null)
  })
})

describe('resumen del contrato para firmar', () => {
  it('muestra el último contrato del dueño del token, con el nombre de la obra', async () => {
    const r = await resumenContratoParaFirma(db(), TOKEN_ANA)
    assert.deepEqual(r, {
      ok: true,
      nombre: 'Ana Pérez',
      cargo: 'Albañil de primera',
      salario_basico_diario_ves: 250.5,
      obra: 'Rancho Norte',
    })
  })

  it('sin contrato todavía: lo dice, no muestra nada de otro trabajador', async () => {
    const supabase = db()
    // Luis entra con su token actual, pero no tiene contrato.
    const tablas = (supabase as unknown as { tablas: Record<string, Array<Record<string, unknown>>> }).tablas
    tablas.ci_empleados[1].token_registro = TOKEN_ANTIGUO_LUIS
    const r = await resumenContratoParaFirma(supabase, TOKEN_ANTIGUO_LUIS)
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.status, 404)
      assert.equal(r.codigo, 'sin_contrato')
    }
  })

  it('token desconocido o mal formado: no hay expediente', async () => {
    const desconocido = await resumenContratoParaFirma(db(), 'ffffffff-ffff-4fff-8fff-ffffffffffff')
    assert.equal(desconocido.ok, false)
    if (!desconocido.ok) assert.equal(desconocido.codigo, 'sin_expediente')
    const mal = await resumenContratoParaFirma(db(), 'x')
    assert.equal(mal.ok, false)
    if (!mal.ok) assert.equal(mal.status, 400)
  })
})

describe('patrono para la planilla del candidato', () => {
  it('con el token trae la obra del expediente', async () => {
    const r = await patronoPlanillaPorToken(db(), TOKEN_ANA)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.planillaPatrono.proyectoNombre, 'Rancho Norte')
  })

  it('acepta el token antiguo y rechaza el desconocido', async () => {
    const luis = await patronoPlanillaPorToken(db(), TOKEN_ANTIGUO_LUIS)
    assert.equal(luis.ok, true)
    if (luis.ok) assert.equal(luis.planillaPatrono.proyectoNombre, 'Torre Sur')
    const nadie = await patronoPlanillaPorToken(db(), 'ffffffff-ffff-4fff-8fff-ffffffffffff')
    assert.equal(nadie.ok, false)
    if (!nadie.ok) assert.equal(nadie.status, 404)
  })
})
