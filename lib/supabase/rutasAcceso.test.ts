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
    for (const ruta of [
      '/presupuestos',
      '/contratos/administracion-delegada',
      '/evaluaciones',
      '/evaluaciones/abc/reporte',
      '/ajustes',
      '/nexus/builder',
      '/nexus/clientes',
      '/nexus/proyectos',
    ]) {
      assert.equal(requiereSesion(ruta), true, ruta)
    }
    // Lo que ve el cliente por enlace sigue abierto.
    for (const ruta of ['/nexus/vision/cliente', '/presupuesto/p-49', '/abogado/registro', '/ventas/preview']) {
      assert.equal(requiereSesion(ruta), false, ruta)
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

  it('el bot, los cron y lo que no puede traer sesión siguen abiertos', () => {
    for (const ruta of [
      '/api/webhooks/telegram',
      '/api/webhooks/whatsapp',
      '/api/telegram',
      '/api/webhook-logs',
      '/api/telegram/registrar-webhook',
      '/api/cron/weekly-report',
      '/api/cron/cco-snapshots-diarios',
      '/api/health',
      '/api/health/supabase',
      '/api/auth/permisos',
      '/api/auth/me',
      '/api/pruebas/bot',
      '/api/alerts/telegram-exception',
      '/api/proyectos/tours/worker-callback',
      '/api/netvision/compartido/abc',
      '/api/legal/solicitudes',
      '/api/finanzas/bcv-tasa',
      '/api/talento/examen/submit',
    ]) {
      assert.equal(apiRequiereSesion(ruta), false, ruta)
    }
  })

  it('todo lo demás pide sesión, también lo que todavía no existe', () => {
    for (const ruta of [
      '/api/contabilidad/balance-mensual',
      '/api/contabilidad/cco/emparejar-soportes',
      '/api/contabilidad/gastos-entidad',
      '/api/proyectos/clientes',
      '/api/proyectos/abc/nomina',
      '/api/proyectos/abc/bot-usuarios',
      '/api/proyectos/tours/worker-health',
      '/api/budgets/abc/pdf',
      '/api/legal/casos',
      '/api/legal/solicitudes/admin',
      '/api/legal/solicitudes/abc/aprobar',
      '/api/flota/conductores',
      '/api/metron/analisis',
      '/api/pheme/minuta',
      '/api/netvision/projects',
      '/api/nexus/proposals/demo/pdf',
      '/api/finanzas/bcv-tasas',
      '/api/finanzas/bcv-tasa/otra',
      '/api/scan-invoice',
      '/api/alertas-config',
      '/api/usuarios-roles',
      '/api/telegram/whitelist',
      '/api',
      '/api/una-ruta-nueva',
      '/api/almacenes-publicos',
    ]) {
      assert.equal(apiRequiereSesion(ruta), true, ruta)
    }
    // Las páginas no son asunto de esta regla.
    assert.equal(apiRequiereSesion('/apiario'), false)
    assert.equal(apiRequiereSesion('/registro'), false)
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
})

describe('toda ruta abierta del proyecto está revisada', () => {
  it('las rutas reales que responden sin sesión son exactamente estas', () => {
    // Recorre app/api: si aparece una ruta abierta que no está aquí, alguien amplió las
    // listas de rutasAcceso.ts sin revisar que la ruta tenga su propio control.
    const revisadas = [
      // llamadas de fuera, con su propia clave
      '/api/webhooks/telegram',
      '/api/webhooks/whatsapp',
      '/api/webhooks/vercel-deploy',
      '/api/webhook-logs',
      '/api/telegram',
      '/api/telegram/registrar-webhook',
      '/api/alerts/telegram-exception',
      '/api/proyectos/tours/worker-callback',
      '/api/cron/agenda-reminders',
      '/api/cron/avance-diario-campo',
      '/api/cron/cco-auditor-diario',
      '/api/cron/cco-snapshots-diarios',
      '/api/cron/permisologia-vencimientos',
      '/api/cron/weekly-report',
      // sesión y diagnóstico
      '/api/auth/cambiar-password',
      '/api/auth/invitar',
      '/api/auth/me',
      '/api/auth/permisos',
      '/api/auth/usuarios-roles',
      '/api/health',
      '/api/health/local',
      '/api/health/supabase',
      '/api/pruebas/bot',
      // públicas por diseño
      '/api/finanzas/bcv-tasa',
      '/api/legal/solicitudes',
      '/api/netvision/compartido/[token]',
      // candidato y trabajador, con su enlace
      '/api/expediente/marcar-token-usado',
      '/api/expediente/validar-token',
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
    let total = 0
    const recorrer = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name)
        if (e.isDirectory()) recorrer(ruta)
        else if (/^route\.(ts|tsx|js)$/.test(e.name)) {
          total += 1
          const url = '/api/' + relative(raiz, dir).split(sep).join('/')
          // Los tramos dinámicos ([id]) se prueban con un valor cualquiera.
          if (!apiRequiereSesion(url.replace(/\[[^\]]+\]/g, 'abc'))) abiertas.push(url)
        }
      }
    }
    recorrer(raiz)
    assert.ok(total > 250, `se esperaban más de 250 rutas y se encontraron ${total}`)
    assert.deepEqual(abiertas.sort(), [...revisadas].sort())
  })
})
