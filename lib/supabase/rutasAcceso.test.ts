import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { apiRequiereSesion, requiereSesion } from './rutasAcceso'

describe('rutas que piden sesión', () => {
  it('el catálogo de productos y los presupuestos piden sesión', () => {
    for (const ruta of ['/productos', '/productos/12/editar', '/ventas', '/almacen', '/almacen/nuevo']) {
      assert.equal(requiereSesion(ruta), true, ruta)
    }
  })

  it('la demostración del presupuesto sigue abierta', () => {
    assert.equal(requiereSesion('/ventas/preview'), false)
  })

  it('lo público sigue público', () => {
    for (const ruta of [
      '/',
      '/login',
      '/registro',
      '/reclutamiento',
      '/nexus/vision/cliente',
      '/talento/examen/abc',
      '/presupuesto/demo',
    ]) {
      assert.equal(requiereSesion(ruta), false, ruta)
    }
  })

  it('lo que ya pedía sesión la sigue pidiendo', () => {
    for (const ruta of [
      '/contabilidad',
      '/admin/dashboard',
      '/proyectos/1',
      '/rrhh',
      '/reclutamiento/hoja-de-vida/view',
      '/reclutamiento/hoja-de-vida/view/7',
    ]) {
      assert.equal(requiereSesion(ruta), true, ruta)
    }
    // /rrhh/registro es el formulario público de RR. HH.
    assert.equal(requiereSesion('/rrhh/registro'), false)
    // No confunde prefijos parecidos.
    assert.equal(requiereSesion('/productos-publicos'), false)
    assert.equal(requiereSesion('/ventasx'), false)
  })
})

describe('páginas de personal que leen tablas cerradas', () => {
  it('clientes, tablero, flota y personas piden sesión', () => {
    for (const ruta of ['/clientes', '/clientes/crm', '/dashboard', '/dashboard/contracts', '/flota/gasolina', '/personas']) {
      assert.equal(requiereSesion(ruta), true, ruta)
    }
  })
})

describe('formularios públicos de reclutamiento', () => {
  it('los enlaces del candidato siguen abiertos; operaciones pide sesión', () => {
    for (const ruta of [
      '/registro',
      '/registro/onboarding/abc/firma',
      '/reclutamiento',
      '/reclutamiento/onboarding/abc',
      '/onboarding/hoja-de-vida/abc',
      '/talento/examen',
    ]) {
      assert.equal(requiereSesion(ruta), false, ruta)
    }
    assert.equal(requiereSesion('/reclutamiento/hoja-de-vida/view/123'), true)
    for (const ruta of ['/operaciones', '/operaciones/proyectos', '/operaciones/rentabilidad']) {
      assert.equal(requiereSesion(ruta), true, ruta)
    }
  })

  it('las rutas que les entregan datos no piden sesión (validan el enlace)', () => {
    for (const ruta of [
      '/api/reclutamiento/vacante',
      '/api/reclutamiento/firma-resumen',
      '/api/reclutamiento/patrono',
      '/api/reclutamiento/captacion-meta',
      '/api/talento/examen/submit',
    ]) {
      assert.equal(apiRequiereSesion(ruta), false, ruta)
    }
  })
})

describe('quién puede usar el bot', () => {
  it('la lista de chats autorizados pide sesión; el webhook de Telegram no', () => {
    assert.equal(apiRequiereSesion('/api/telegram/whitelist'), true)
    assert.equal(apiRequiereSesion('/api/telegram/whitelist/abc'), true)
    assert.equal(apiRequiereSesion('/api/telegram'), false)
    assert.equal(apiRequiereSesion('/api/telegram/registrar-webhook'), false)
    assert.equal(apiRequiereSesion('/api/webhooks/telegram'), false)
    assert.equal(apiRequiereSesion('/api/webhook-logs'), false)
  })
})

describe('APIs que piden sesión', () => {
  it('almacén, compras, procuras y facturas del canal la piden', () => {
    for (const ruta of [
      '/api/almacen/transferencias',
      '/api/almacen/stock',
      '/api/almacen/inventario/abc/stock',
      '/api/compras/procuras',
      '/api/compras/usuarios-telegram/7',
      '/api/procuras',
      '/api/procuras/procesar-lote',
      '/api/facturas-canal/pendientes/1/ingreso-almacen',
      '/api/contabilidad/compras/9/ingreso-almacen',
    ]) {
      assert.equal(apiRequiereSesion(ruta), true, ruta)
    }
  })

  it('el bot, los cron y lo público no se tocan', () => {
    for (const ruta of [
      '/api/webhooks/telegram',
      '/api/telegram',
      '/api/webhooks/whatsapp',
      '/api/cron/weekly-report',
      '/api/health/supabase',
      '/api/talento/examen/submit',
      '/api/contabilidad/cco/emparejar-soportes',
      '/api/almacenes-publicos',
    ]) {
      assert.equal(apiRequiereSesion(ruta), false, ruta)
    }
  })
})

describe('APIs de RRHH: cerradas salvo las del candidato', () => {
  it('las rutas del personal piden sesión', () => {
    for (const ruta of [
      // contratos y expedientes
      '/api/talento/contratos-express',
      '/api/talento/contratos-express/abc',
      '/api/talento/contratos-express/abc/formalizar',
      '/api/talento/contratos-express/debug',
      '/api/talento/contratos-fast/formalizar',
      '/api/talento/contratos/generar',
      '/api/talento/contratos/abc',
      '/api/talento/contratos/abc/firmar-fisica',
      '/api/talento/documentos-plantillas',
      '/api/talento/documentos-plantillas/contrato',
      '/api/talento/generar-link',
      '/api/talento/psique/recomendar',
      '/api/talento/hoja-vida/plantilla',
      '/api/rrhh/contrato-pdf/stream',
      '/api/rrhh/empleados/abc/contrato-vista',
      '/api/rrhh/solicitados-resumen/documento',
      '/api/rrhh/nomina/semana',
      '/api/registro/emitir-invitacion-examen',
      '/api/registro/planilla-empleo-pdf',
      // vacantes y tablero de reclutamiento
      '/api/recruitment/needs',
      '/api/recruitment/candidatos-examen',
      '/api/recruitment/dashboard-funnel',
      '/api/recruitment/result/abc',
      '/api/recruitment/examen/nueva-invitacion',
      '/api/recruitment/ceo-auth',
      '/api/reclutamiento/captacion-token',
      // configuración
      '/api/admin/alertas-config',
      '/api/admin/config-nomina/aplicar-proyectos',
      '/api/admin/config/nomina/eficiencia-ad',
      '/api/admin/maquinaria/liquidar',
      '/api/admin/schema-repair/contabilidad-compras',
      // una ruta nueva bajo estos prefijos nace cerrada
      '/api/talento/algo-nuevo',
      '/api/rrhh/algo-nuevo',
    ]) {
      assert.equal(apiRequiereSesion(ruta), true, ruta)
    }
  })

  it('las rutas del candidato siguen abiertas (validan su enlace)', () => {
    for (const ruta of [
      '/api/reclutamiento/vacante',
      '/api/reclutamiento/captacion-meta',
      '/api/reclutamiento/captacion-completar',
      '/api/reclutamiento/patrono',
      '/api/reclutamiento/firma-resumen',
      '/api/registro/finalizar',
      '/api/registro/subir-firma',
      '/api/registro/contrato-laboral/pdf',
      '/api/recruitment/session',
      '/api/recruitment/session-cv',
      '/api/recruitment/turn',
      '/api/recruitment/events',
      '/api/talento/contratos/firmar',
      '/api/talento/hoja-legal/generar',
      '/api/talento/examen/invitacion',
      '/api/talento/examen/submit',
      '/api/talento/examen/finalizar',
      '/api/talento/examen/evaluar',
      '/api/talento/examen/evaluar-unificada',
      '/api/talento/examen/evaluar-color',
      '/api/expediente/validar-token',
      '/api/expediente/marcar-token-usado',
    ]) {
      assert.equal(apiRequiereSesion(ruta), false, ruta)
    }
  })

  it('una excepción no abre a sus vecinas de nombre parecido', () => {
    assert.equal(apiRequiereSesion('/api/talento/contratos/firmar-otra-cosa'), true)
    assert.equal(apiRequiereSesion('/api/recruitment/sessions'), true)
    assert.equal(apiRequiereSesion('/api/reclutamiento/vacantes'), true)
    assert.equal(apiRequiereSesion('/api/talento/examenes'), true)
  })

  it('cada ruta abierta bajo esos prefijos está en la lista revisada', () => {
    // Recorre las rutas reales del proyecto: si aparece una abierta que no está aquí,
    // alguien amplió APIS_DEL_CANDIDATO sin revisar que la ruta valide el enlace.
    const revisadas = [
      '/api/reclutamiento/captacion-completar',
      '/api/reclutamiento/captacion-meta',
      '/api/reclutamiento/firma-resumen',
      '/api/reclutamiento/patrono',
      '/api/reclutamiento/vacante',
      '/api/recruitment/events',
      '/api/recruitment/session',
      '/api/recruitment/session-cv',
      '/api/recruitment/turn',
      '/api/registro/contrato-laboral/aceptar',
      '/api/registro/contrato-laboral/descarga',
      '/api/registro/contrato-laboral/meta',
      '/api/registro/contrato-laboral/pdf',
      '/api/registro/finalizar',
      '/api/registro/subir-firma',
      '/api/talento/contratos/firmar',
      '/api/talento/examen/evaluar',
      '/api/talento/examen/evaluar-color',
      '/api/talento/examen/evaluar-obrero',
      '/api/talento/examen/evaluar-unificada',
      '/api/talento/examen/finalizar',
      '/api/talento/examen/invitacion',
      '/api/talento/examen/submit',
      '/api/talento/hoja-legal/generar',
    ]
    const raiz = join(process.cwd(), 'app', 'api')
    const abiertas: string[] = []
    const recorrer = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name)
        if (e.isDirectory()) recorrer(ruta)
        else if (/^route\.(ts|tsx|js)$/.test(e.name)) {
          const url = '/api/' + relative(raiz, dir).split(sep).join('/')
          const bajoPrefijo = ['rrhh', 'talento', 'recruitment', 'reclutamiento', 'registro', 'admin'].some(
            (p) => url === `/api/${p}` || url.startsWith(`/api/${p}/`),
          )
          // Los tramos dinámicos ([id]) se prueban con un valor cualquiera.
          const ejemplo = url.replace(/\[[^\]]+\]/g, 'abc')
          if (bajoPrefijo && !apiRequiereSesion(ejemplo)) abiertas.push(url)
        }
      }
    }
    recorrer(raiz)
    assert.deepEqual(abiertas.sort(), [...revisadas].sort())
  })
})

