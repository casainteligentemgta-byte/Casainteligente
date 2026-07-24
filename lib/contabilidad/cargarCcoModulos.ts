import type { SupabaseClient } from '@supabase/supabase-js';
import { IMPUTACION_ENTIDAD } from '@/lib/contabilidad/imputacionCompra';
import { auditoriaFechaCompra } from '@/lib/contabilidad/auditoriaFechaCompra';
import {
  ESTADO_CONTRATO_EXITOSO,
  TIPO_CONTRATO_AD,
  type ContratoAdResumen,
} from '@/lib/proyectos/contratoAdministracionDelegada';
import { listarPresupuestosLulo, type PresupuestoLuloRow } from '@/lib/proyectos/presupuestosLulo';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isMissingRelation(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return (
    err.code === '42P01' ||
    err.code === '42703' ||
    /schema cache|does not exist|relation/i.test(err.message ?? '')
  );
}

export type CcoIngresoFila = {
  id: string;
  fuente: 'inyeccion' | 'abono';
  fecha: string;
  montoUsd: number;
  detalle: string;
  metodo: string;
};

export type CcoIngresosModulo = {
  totalInyeccionesUsd: number;
  totalAbonosUsd: number;
  totalUsd: number;
  countInyecciones: number;
  countAbonos: number;
  filas: CcoIngresoFila[];
};

export type CcoDeudaProveedorFila = {
  id: string;
  fecha: string;
  proveedor: string;
  factura: string;
  montoUsd: number;
  estado: string;
};

export type CcoDeudasModulo = {
  saldoFondosUsd: number;
  totalAbonadoUsd: number;
  totalEgresosUsd: number;
  coberturaUsd: number;
  pendientes: CcoDeudaProveedorFila[];
  totalPendienteUsd: number;
};

export type CcoContratosModulo = {
  autorizado: boolean;
  contrato: ContratoAdResumen | null;
  contratosObrero: number;
};

export type CcoPresupuestosModulo = {
  presupuestos: PresupuestoLuloRow[];
  partidasCount: number;
  presupuestoTotalUsd: number;
  fuentePartidas: 'lulo' | 'ci_presupuesto_partidas' | 'ninguna';
};

export type CcoEditorMaestroModulo = {
  catalogoCapitulos: number;
  catalogoPartidas: number;
  catalogoInsumos: number;
  partidasObra: number;
};

export type CcoImportarModulo = {
  importsRecientes: {
    id: string;
    fecha: string;
    proveedor: string;
    factura: string;
    montoUsd: number;
    origen: string;
  }[];
  countImportados: number;
};

export type CcoDistribucionModulo = {
  partidasConPresupuesto: number;
  partidasTotal: number;
  montoPresupuestadoUsd: number;
};

export type CcoAuditoriaAlerta = {
  id: string;
  tipo: 'fecha_compra' | 'info';
  nivel: 'ok' | 'advertencia' | 'critico';
  titulo: string;
  detalle: string;
  fecha?: string;
};

export type CcoAuditoriaModulo = {
  alertasFecha: CcoAuditoriaAlerta[];
  countAdvertencia: number;
  countCritico: number;
  countOkMuestra: number;
};

export type CcoModulosPayload = {
  proyectoId: string | null;
  proyectoNombre: string;
  ingresos: CcoIngresosModulo;
  deudas: CcoDeudasModulo;
  contratos: CcoContratosModulo;
  presupuestos: CcoPresupuestosModulo;
  editor: CcoEditorMaestroModulo;
  importar: CcoImportarModulo;
  distribucion: CcoDistribucionModulo;
  auditoria: CcoAuditoriaModulo;
};

function emptyPayload(proyectoId: string | null, proyectoNombre: string): CcoModulosPayload {
  return {
    proyectoId,
    proyectoNombre,
    ingresos: {
      totalInyeccionesUsd: 0,
      totalAbonosUsd: 0,
      totalUsd: 0,
      countInyecciones: 0,
      countAbonos: 0,
      filas: [],
    },
    deudas: {
      saldoFondosUsd: 0,
      totalAbonadoUsd: 0,
      totalEgresosUsd: 0,
      coberturaUsd: 0,
      pendientes: [],
      totalPendienteUsd: 0,
    },
    contratos: { autorizado: false, contrato: null, contratosObrero: 0 },
    presupuestos: {
      presupuestos: [],
      partidasCount: 0,
      presupuestoTotalUsd: 0,
      fuentePartidas: 'ninguna',
    },
    editor: {
      catalogoCapitulos: 0,
      catalogoPartidas: 0,
      catalogoInsumos: 0,
      partidasObra: 0,
    },
    importar: { importsRecientes: [], countImportados: 0 },
    distribucion: {
      partidasConPresupuesto: 0,
      partidasTotal: 0,
      montoPresupuestadoUsd: 0,
    },
    auditoria: {
      alertasFecha: [],
      countAdvertencia: 0,
      countCritico: 0,
      countOkMuestra: 0,
    },
  };
}

export async function cargarCcoModulos(
  supabase: SupabaseClient,
  params?: { proyectoId?: string | null },
): Promise<CcoModulosPayload> {
  const proyectoId = params?.proyectoId?.trim() || null;

  let proyectoNombre = 'Todas las obras';
  if (proyectoId) {
    const { data: proy } = await supabase
      .from('ci_proyectos')
      .select('nombre')
      .eq('id', proyectoId)
      .maybeSingle();
    proyectoNombre = String((proy as { nombre?: string } | null)?.nombre ?? '').trim() || 'Obra';
  }

  const out = emptyPayload(proyectoId, proyectoNombre);

  // —— Ingresos: inyecciones + abonos ——
  {
    let inyQ = supabase
      .from('ci_inyecciones_capital')
      .select(
        'id,fecha_ingreso,creado_al,monto_usd,origen_fondo,metodo_pago,proyecto_id,ci_proyectos(nombre)',
      )
      .order('creado_al', { ascending: false })
      .limit(200);
    if (proyectoId) inyQ = inyQ.eq('proyecto_id', proyectoId);
    const { data: inyRows, error: inyErr } = await inyQ;
    if (!inyErr || isMissingRelation(inyErr)) {
      for (const raw of inyRows ?? []) {
        const r = raw as {
          id: string;
          fecha_ingreso?: string | null;
          creado_al?: string;
          monto_usd?: number;
          origen_fondo?: string;
          metodo_pago?: string;
        };
        const monto = num(r.monto_usd);
        out.ingresos.totalInyeccionesUsd += monto;
        out.ingresos.countInyecciones += 1;
        out.ingresos.filas.push({
          id: String(r.id),
          fuente: 'inyeccion',
          fecha: String(r.fecha_ingreso ?? r.creado_al ?? '').slice(0, 10),
          montoUsd: monto,
          detalle: String(r.origen_fondo ?? 'Inyección').trim() || 'Inyección',
          metodo: String(r.metodo_pago ?? '—'),
        });
      }
    }

    if (proyectoId) {
      const { data: abonos, error: abErr } = await supabase
        .from('ci_proyecto_abonos')
        .select(
          'id,fecha_abono,monto_usd,monto_recibido,moneda,banco_origen,referencia_transferencia,observaciones',
        )
        .eq('proyecto_id', proyectoId)
        .order('fecha_abono', { ascending: false })
        .limit(200);
      if (!abErr || isMissingRelation(abErr)) {
        for (const raw of abonos ?? []) {
          const r = raw as {
            id: string;
            fecha_abono?: string;
            monto_usd?: number;
            banco_origen?: string;
            referencia_transferencia?: string;
            observaciones?: string | null;
          };
          const monto = num(r.monto_usd);
          out.ingresos.totalAbonosUsd += monto;
          out.ingresos.countAbonos += 1;
          out.ingresos.filas.push({
            id: String(r.id),
            fuente: 'abono',
            fecha: String(r.fecha_abono ?? '').slice(0, 10),
            montoUsd: monto,
            detalle:
              String(r.observaciones ?? '').trim() ||
              `${r.banco_origen ?? 'Banco'} · ${r.referencia_transferencia ?? ''}`.trim(),
            metodo: 'TRANSFERENCIA',
          });
        }
      }
    }

    out.ingresos.totalUsd = out.ingresos.totalInyeccionesUsd + out.ingresos.totalAbonosUsd;
    out.ingresos.filas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  // —— Deudas: fondos + egresos + compras pendientes ——
  {
    if (proyectoId) {
      const { data: fondos, error: fErr } = await supabase
        .from('ci_proyecto_fondos')
        .select('saldo_usd,total_abonado_usd')
        .eq('proyecto_id', proyectoId)
        .maybeSingle();
      if (!fErr || isMissingRelation(fErr)) {
        out.deudas.saldoFondosUsd = num((fondos as { saldo_usd?: number } | null)?.saldo_usd);
        out.deudas.totalAbonadoUsd = num(
          (fondos as { total_abonado_usd?: number } | null)?.total_abonado_usd,
        );
      }
    }

    let egQ = supabase
      .from('contabilidad_compras')
      .select('id,fecha,monto_usd,supplier_name,invoice_number,estado,proyecto_id,imputacion')
      .not('proyecto_id', 'is', null)
      .neq('imputacion', IMPUTACION_ENTIDAD)
      .limit(5000);
    if (proyectoId) egQ = egQ.eq('proyecto_id', proyectoId);
    const { data: compras, error: cErr } = await egQ;
    if (!cErr || isMissingRelation(cErr)) {
      for (const raw of compras ?? []) {
        const c = raw as {
          id: string;
          fecha?: string;
          monto_usd?: number;
          supplier_name?: string;
          invoice_number?: string;
          estado?: string;
        };
        const monto = num(c.monto_usd);
        out.deudas.totalEgresosUsd += monto;
        const estado = String(c.estado ?? '').trim() || 'REGISTRADA';
        if (/PEND|BORRADOR|DRAFT|POR_PAGAR|POR PAGAR|ABIERT/i.test(estado)) {
          out.deudas.pendientes.push({
            id: String(c.id),
            fecha: String(c.fecha ?? '').slice(0, 10),
            proveedor: String(c.supplier_name ?? '—').trim() || '—',
            factura: String(c.invoice_number ?? '—').trim() || '—',
            montoUsd: monto,
            estado,
          });
          out.deudas.totalPendienteUsd += monto;
        }
      }
      out.deudas.pendientes.sort((a, b) => b.fecha.localeCompare(a.fecha));
    }

    out.deudas.coberturaUsd = out.deudas.saldoFondosUsd - out.deudas.totalPendienteUsd;
  }

  // —— Contratos AD + conteo obrero ——
  {
    if (proyectoId) {
      const { data: contrato, error: ctErr } = await supabase
        .from('ci_contratos_express')
        .select(
          `
          id,
          entidad_ejecutora_id,
          honorarios_admin_pct,
          estado,
          created_at,
          entidad:ci_entidades ( nombre )
        `,
        )
        .eq('proyecto_id', proyectoId)
        .eq('tipo_contrato', TIPO_CONTRATO_AD)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ctErr && contrato) {
        const entRaw = (contrato as { entidad?: { nombre: string } | { nombre: string }[] | null })
          .entidad;
        const ent = Array.isArray(entRaw) ? entRaw[0] : entRaw;
        out.contratos.contrato = {
          id: String((contrato as { id: string }).id),
          entidad_ejecutora_id:
            (contrato as { entidad_ejecutora_id?: string | null }).entidad_ejecutora_id ?? null,
          honorarios_admin_pct:
            (contrato as { honorarios_admin_pct?: number | null }).honorarios_admin_pct != null
              ? num((contrato as { honorarios_admin_pct?: number }).honorarios_admin_pct)
              : null,
          estado: String((contrato as { estado?: string }).estado ?? ''),
          created_at: String((contrato as { created_at?: string }).created_at ?? ''),
          entidad: ent ?? null,
        };
        out.contratos.autorizado =
          String((contrato as { estado?: string }).estado ?? '') === ESTADO_CONTRATO_EXITOSO;
      } else if (ctErr && !isMissingRelation(ctErr)) {
        // ignore non-fatal
      }

      const { count } = await supabase
        .from('ci_contratos_express')
        .select('id', { count: 'exact', head: true })
        .eq('proyecto_id', proyectoId)
        .neq('tipo_contrato', TIPO_CONTRATO_AD);
      out.contratos.contratosObrero = count ?? 0;
    }
  }

  // —— Presupuestos Lulo + partidas ——
  {
    if (proyectoId) {
      try {
        out.presupuestos.presupuestos = await listarPresupuestosLulo(supabase, proyectoId);
      } catch {
        out.presupuestos.presupuestos = [];
      }

      const { data: partidasLulo, error: plErr } = await supabase
        .from('ci_presupuesto_partidas')
        .select('id,monto_total_estimado,codigo_partida')
        .eq('proyecto_id', proyectoId)
        .limit(8000);

      if (!plErr && partidasLulo && partidasLulo.length > 0) {
        out.presupuestos.fuentePartidas = 'ci_presupuesto_partidas';
        out.presupuestos.partidasCount = partidasLulo.length;
        let total = 0;
        let conMonto = 0;
        for (const p of partidasLulo) {
          const m = num((p as { monto_total_estimado?: number }).monto_total_estimado);
          total += m;
          if (m > 0) conMonto += 1;
        }
        out.presupuestos.presupuestoTotalUsd = total;
        out.distribucion.partidasTotal = partidasLulo.length;
        out.distribucion.partidasConPresupuesto = conMonto;
        out.distribucion.montoPresupuestadoUsd = total;
        out.editor.partidasObra = partidasLulo.length;
      } else {
        const { data: partidasAlt, error: paErr } = await supabase
          .from('partidas')
          .select('id,monto_total,codigo,capitulos!inner(proyecto_id)')
          .eq('capitulos.proyecto_id', proyectoId)
          .limit(8000);
        if (!paErr && partidasAlt) {
          out.presupuestos.fuentePartidas = 'lulo';
          out.presupuestos.partidasCount = partidasAlt.length;
          let total = 0;
          let conMonto = 0;
          for (const p of partidasAlt) {
            const m = num((p as { monto_total?: number }).monto_total);
            total += m;
            if (m > 0) conMonto += 1;
          }
          out.presupuestos.presupuestoTotalUsd = total;
          out.distribucion.partidasTotal = partidasAlt.length;
          out.distribucion.partidasConPresupuesto = conMonto;
          out.distribucion.montoPresupuestadoUsd = total;
          out.editor.partidasObra = partidasAlt.length;
        }
      }
    }
  }

  // —— Editor maestro: catálogo global ——
  {
    const [cap, par, ins] = await Promise.all([
      supabase.from('lulo_catalogo_capitulos').select('id', { count: 'exact', head: true }),
      supabase.from('lulo_catalogo_partidas').select('id', { count: 'exact', head: true }),
      supabase.from('lulo_catalogo_insumos').select('codigo', { count: 'exact', head: true }),
    ]);
    if (!cap.error || isMissingRelation(cap.error)) out.editor.catalogoCapitulos = cap.count ?? 0;
    if (!par.error || isMissingRelation(par.error)) out.editor.catalogoPartidas = par.count ?? 0;
    if (!ins.error || isMissingRelation(ins.error)) out.editor.catalogoInsumos = ins.count ?? 0;
  }

  // —— Importar: compras con origen CSV / tabla / import ——
  {
    let iq = supabase
      .from('contabilidad_compras')
      .select('id,fecha,supplier_name,invoice_number,monto_usd,origen,proyecto_id')
      .not('proyecto_id', 'is', null)
      .order('fecha', { ascending: false })
      .limit(300);
    if (proyectoId) iq = iq.eq('proyecto_id', proyectoId);
    const { data: rows, error } = await iq;
    if (!error || isMissingRelation(error)) {
      const importLike = (rows ?? []).filter((r) =>
        /CSV|TABLA|IMPORT|HISTOR|PDF|EXTRACT|CUADRO/i.test(
          String((r as { origen?: string }).origen ?? ''),
        ),
      );
      const fuente = importLike.length > 0 ? importLike : (rows ?? []).slice(0, 30);
      out.importar.countImportados = importLike.length;
      out.importar.importsRecientes = fuente.slice(0, 30).map((raw) => {
        const r = raw as {
          id: string;
          fecha?: string;
          supplier_name?: string;
          invoice_number?: string;
          monto_usd?: number;
          origen?: string;
        };
        return {
          id: String(r.id),
          fecha: String(r.fecha ?? '').slice(0, 10),
          proveedor: String(r.supplier_name ?? '—'),
          factura: String(r.invoice_number ?? '—'),
          montoUsd: num(r.monto_usd),
          origen: String(r.origen ?? '—'),
        };
      });
    }
  }

  // —— Auditoría fechas de compra ——
  {
    let aq = supabase
      .from('contabilidad_compras')
      .select('id,fecha,invoice_number,supplier_name,proyecto_id')
      .not('proyecto_id', 'is', null)
      .order('fecha', { ascending: false })
      .limit(200);
    if (proyectoId) aq = aq.eq('proyecto_id', proyectoId);
    const { data: rows, error } = await aq;
    if (!error || isMissingRelation(error)) {
      let adv = 0;
      let crit = 0;
      let ok = 0;
      const alertas: CcoAuditoriaAlerta[] = [];
      for (const raw of rows ?? []) {
        const r = raw as {
          id: string;
          fecha?: string;
          invoice_number?: string;
          supplier_name?: string;
        };
        const audit = auditoriaFechaCompra(String(r.fecha ?? ''));
        if (audit.nivel === 'ok') {
          ok += 1;
          continue;
        }
        if (audit.nivel === 'advertencia') adv += 1;
        if (audit.nivel === 'critico') crit += 1;
        if (alertas.length < 40) {
          alertas.push({
            id: String(r.id),
            tipo: 'fecha_compra',
            nivel: audit.nivel,
            titulo: `${r.invoice_number || 'Sin factura'} · ${r.supplier_name || 'Proveedor'}`,
            detalle: audit.mensaje,
            fecha: audit.fecha,
          });
        }
      }
      out.auditoria.alertasFecha = alertas;
      out.auditoria.countAdvertencia = adv;
      out.auditoria.countCritico = crit;
      out.auditoria.countOkMuestra = ok;
    }
  }

  return out;
}
