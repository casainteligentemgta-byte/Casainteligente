/**
 * Fase 4 — Diagnóstico clientes ↔ obras ↔ compras ↔ legacy.
 *
 * Uso:
 *   node scripts/diag-clientes-obras.mjs
 *   node scripts/diag-clientes-obras.mjs --json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonOut = process.argv.includes('--json');

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function normRif(s) {
  return norm(s).replace(/[^a-z0-9]/g, '');
}

const env = parseEnvFile(fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const report = {
  ok: true,
  alertas: [],
  conteos: {},
  ci_proyectos: {},
  compras_30d: {},
  legacy_tb_clientes: {},
  brecha_crm_compras: [],
  recomendaciones: [],
};

function alerta(msg) {
  report.alertas.push(msg);
  report.ok = false;
}

async function countTable(table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) return { table, error: error.message };
  return { table, count: count ?? 0 };
}

function logSection(title) {
  if (!jsonOut) console.log(`\n=== ${title} ===`);
}

async function main() {
  const tables = [
    'customers',
    'ci_proyectos',
    'ci_entidades',
    'contabilidad_compras',
    'nexus_clients',
  ];

  logSection('Conteos');
  for (const t of tables) {
    const r = await countTable(t);
    report.conteos[t] = r.error ? { error: r.error } : r.count;
    if (!jsonOut) {
      console.log(r.error ? `${t}: ERROR ${r.error}` : `${t}: ${r.count}`);
    }
  }

  const { count: tbCount, error: tbErr } = await sb
    .from('tb_clientes')
    .select('*', { count: 'exact', head: true });
  report.conteos.tb_clientes = tbErr ? { error: tbErr.message } : (tbCount ?? 0);
  if (!jsonOut) {
    console.log(
      tbErr ? 'tb_clientes: (no existe o sin acceso)' : `tb_clientes (legacy): ${tbCount ?? 0}`,
    );
  }

  const { data: customers } = await sb
    .from('customers')
    .select('id, nombre, apellido, razon_social, rif, email, customer_type');

  const rifIndex = new Map();
  const nombreIndex = new Map();
  for (const c of customers ?? []) {
    const rif = normRif(c.rif);
    if (rif) rifIndex.set(rif, c);
    const label = norm(c.razon_social || [c.nombre, c.apellido].filter(Boolean).join(' '));
    if (label) nombreIndex.set(label, c);
  }

  logSection('Legacy tb_clientes vs customers');
  const { data: tbRows, error: tbReadErr } = await sb
    .from('tb_clientes')
    .select('id, nombre, tipo, email, telefono')
    .limit(200);

  const tbSinPar = [];
  const tbConPar = [];
  if (tbReadErr) {
    report.legacy_tb_clientes.error = tbReadErr.message;
    if (!jsonOut) console.log(`No se pudo leer tb_clientes: ${tbReadErr.message}`);
  } else {
    for (const t of tbRows ?? []) {
      const nombre = norm(t.nombre);
      const match = nombreIndex.get(nombre);
      if (match) tbConPar.push({ tb: t, customer_id: match.id });
      else tbSinPar.push(t);
    }
    report.legacy_tb_clientes = {
      total: tbRows?.length ?? 0,
      con_par_nombre: tbConPar.length,
      sin_par_nombre: tbSinPar.length,
      muestra_sin_par: tbSinPar.slice(0, 5).map((t) => ({
        id: t.id,
        nombre: t.nombre,
        tipo: t.tipo,
      })),
    };
    if (!jsonOut) {
      console.log(`Filas leídas: ${tbRows?.length ?? 0}`);
      console.log(`Con par por nombre en customers: ${tbConPar.length}`);
      console.log(`Sin par por nombre: ${tbSinPar.length}`);
      if (tbSinPar.length) {
        console.log('Muestra sin par (top 5):');
        for (const t of tbSinPar.slice(0, 5)) {
          console.log(`  ${t.id} | ${t.nombre} | tipo=${t.tipo ?? '—'}`);
        }
      }
    }
    if ((tbRows?.length ?? 0) > 0 && tbSinPar.length > 0) {
      alerta(`${tbSinPar.length} fila(s) en tb_clientes sin equivalente obvio en customers (por nombre).`);
      report.recomendaciones.push(
        'Revisar tb_clientes legacy; /clientes/crm ya no la usa. Migrar manualmente o archivar.',
      );
    }
  }

  let proys = null;
  let proyErr = null;
  {
    const r = await sb
      .from('ci_proyectos')
      .select('id, nombre, customer_id, entidad_id, estado, tipo_proyecto, obra_cliente');
    proys = r.data;
    proyErr = r.error;
    if (proyErr && /obra_cliente|42703|column/i.test(proyErr.message ?? '')) {
      const r2 = await sb
        .from('ci_proyectos')
        .select('id, nombre, customer_id, entidad_id, estado, tipo_proyecto');
      proys = (r2.data ?? []).map((p) => ({ ...p, obra_cliente: null }));
      proyErr = r2.error;
    }
  }
  if (proyErr) {
    alerta(`No se pudo leer ci_proyectos: ${proyErr.message}`);
    if (!jsonOut) console.log(`ERROR ci_proyectos: ${proyErr.message}`);
  }

  const conCliente = (proys ?? []).filter((p) => p.customer_id);
  const sinCliente = (proys ?? []).filter((p) => !p.customer_id);
  const conEntidad = (proys ?? []).filter((p) => p.entidad_id);
  const sinEntidad = (proys ?? []).filter((p) => !p.entidad_id);

  report.ci_proyectos = {
    total: proys?.length ?? 0,
    con_customer_id: conCliente.length,
    sin_customer_id: sinCliente.length,
    con_entidad_id: conEntidad.length,
    sin_entidad_id: sinEntidad.length,
    muestra_sin_cliente: sinCliente.slice(0, 10).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      entidad_id: p.entidad_id,
      obra_cliente: p.obra_cliente,
    })),
  };

  logSection('ci_proyectos');
  if (!jsonOut) {
    console.log(`Total: ${report.ci_proyectos.total}`);
    console.log(`Con customer_id: ${report.ci_proyectos.con_customer_id}`);
    console.log(`Sin customer_id: ${report.ci_proyectos.sin_customer_id}`);
    console.log(`Con entidad_id: ${report.ci_proyectos.con_entidad_id}`);
    console.log(`Sin entidad_id: ${report.ci_proyectos.sin_entidad_id}`);
    if (sinCliente.length) {
      console.log('\nObras sin customer_id (top 10):');
      for (const p of sinCliente.slice(0, 10)) {
        console.log(
          `  ${p.id} | ${p.nombre} | estado=${p.estado} | entidad=${p.entidad_id ?? '—'} | obra_cliente=${p.obra_cliente ?? '—'}`,
        );
      }
    }
  }

  if (sinCliente.length > 0) {
    alerta(`${sinCliente.length} obra(s) sin customer_id — el CRM no las vincula al listado /clientes.`);
    report.recomendaciones.push(
      'Ejecutar: node scripts/backfill-proyectos-customer-id.mjs (dry-run) y revisar sugerencias.',
    );
  }
  if (sinEntidad.length > 0) {
    alerta(`${sinEntidad.length} obra(s) sin entidad_id — compras pueden quedar sin patrono fiscal.`);
  }

  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: compras } = await sb
    .from('contabilidad_compras')
    .select('id, proyecto_id, entidad_id, invoice_number, supplier_name, created_at, imputacion')
    .gte('created_at', hace30)
    .order('created_at', { ascending: false });

  const sinProyecto = (compras ?? []).filter((c) => !c.proyecto_id);
  report.compras_30d = {
    total: compras?.length ?? 0,
    sin_proyecto_id: sinProyecto.length,
    detalle_sin_proyecto: sinProyecto.map((c) => ({
      id: c.id,
      invoice_number: c.invoice_number,
      supplier_name: c.supplier_name,
      entidad_id: c.entidad_id,
      imputacion: c.imputacion,
      created_at: c.created_at,
    })),
  };

  logSection('contabilidad_compras (30d)');
  if (!jsonOut) {
    console.log(`Total: ${report.compras_30d.total}`);
    console.log(`Sin proyecto_id: ${report.compras_30d.sin_proyecto_id}`);
    if (sinProyecto.length) {
      console.log('\nCompras sin proyecto_id:');
      for (const c of sinProyecto) {
        console.log(
          `  ${c.id} | ${c.invoice_number ?? 'S/N'} | ${c.supplier_name ?? '—'} | entidad=${c.entidad_id ?? '—'} | ${String(c.created_at).slice(0, 10)}`,
        );
      }
    }
  }

  if (sinProyecto.length > 0) {
    alerta(`${sinProyecto.length} compra(s) recientes sin proyecto_id.`);
    report.recomendaciones.push('Reubicar compras huérfanas en /contabilidad/compras (Obra / almacén).');
  }

  const proySinClienteIds = new Set(sinCliente.map((p) => p.id));
  const comprasObraSinCrm = (compras ?? []).filter(
    (c) => c.proyecto_id && proySinClienteIds.has(c.proyecto_id),
  );

  report.brecha_crm_compras = comprasObraSinCrm.map((c) => ({
    compra_id: c.id,
    proyecto_id: c.proyecto_id,
    invoice_number: c.invoice_number,
  }));

  logSection('Brecha CRM (compras en obras sin customer_id)');
  if (!jsonOut) {
    console.log(`Compras 30d en obras sin customer_id: ${comprasObraSinCrm.length}`);
    for (const c of comprasObraSinCrm.slice(0, 10)) {
      console.log(`  compra ${c.id} | proyecto ${c.proyecto_id} | ${c.invoice_number ?? 'S/N'}`);
    }
  }
  if (comprasObraSinCrm.length > 0) {
    report.recomendaciones.push(
      'Asignar customer_id en ci_proyectos para que /clientes y badges CRM en compras reflejen al cliente.',
    );
  }

  logSection('Nexus');
  const nexusCount = report.conteos.nexus_clients;
  const customersCount = typeof report.conteos.customers === 'number' ? report.conteos.customers : 0;
  if (!jsonOut) {
    console.log(`nexus_clients: ${typeof nexusCount === 'number' ? nexusCount : '—'}`);
    console.log(`customers (CRM operativo): ${customersCount}`);
    console.log('Puente nexus → customers: planificado (docs/NEXUS-HOME.md), sin sync automático.');
  }

  logSection('Resumen');
  if (report.alertas.length === 0) {
    report.recomendaciones.push('Sin alertas críticas. Ejecutar este script tras cambios masivos en clientes/obras.');
    if (!jsonOut) console.log('OK — sin alertas críticas.');
  } else {
    if (!jsonOut) {
      console.log('ALERTAS:');
      for (const a of report.alertas) console.log(`  • ${a}`);
    }
  }
  if (report.recomendaciones.length && !jsonOut) {
    console.log('\nRecomendaciones:');
    for (const r of report.recomendaciones) console.log(`  → ${r}`);
  }

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
