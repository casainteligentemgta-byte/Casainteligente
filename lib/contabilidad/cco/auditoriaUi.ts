/** Helpers de presentación de auditoría CCO (seguros para cliente). */

export function enriquecerDetalleAuditoria(params: {
  accion: string;
  detalle: string | null;
  metadata?: Record<string, unknown>;
}): string {
  const meta = params.metadata ?? {};
  const base = (params.detalle ?? '').trim();
  const extras: string[] = [];

  if (meta.cambios_resumen && Array.isArray(meta.cambios_resumen)) {
    const samples = (meta.cambios_resumen as unknown[])
      .slice(0, 4)
      .map((x) => String(x))
      .filter(Boolean);
    if (samples.length && !base.includes('→') && !base.includes('capítulo')) {
      extras.push(samples.join(' | '));
    }
  }

  if (typeof meta.updated === 'number' && !/\d+\s*fila/.test(base)) {
    extras.push(`${meta.updated} actualizada(s)`);
  }
  if (typeof meta.deleted === 'number' && meta.deleted > 0 && !/elimin/i.test(base)) {
    extras.push(`${meta.deleted} eliminada(s)`);
  }
  if (meta.gastos && typeof meta.gastos === 'object') {
    const g = meta.gastos as { created?: number; updated?: number };
    extras.push(`gastos +${g.created ?? 0}/~${g.updated ?? 0}`);
  }
  if (typeof meta.contratos === 'number') extras.push(`contratos ${meta.contratos}`);
  if (typeof meta.ingresos === 'number') extras.push(`ingresos ${meta.ingresos}`);
  if (typeof meta.presupuestos === 'number') extras.push(`presupuestos ${meta.presupuestos}`);
  if (typeof meta.vinculados === 'number') extras.push(`vinculados ${meta.vinculados}`);
  if (typeof meta.honorarios_admin_pct === 'number') {
    extras.push(`% admin ${meta.honorarios_admin_pct}`);
  }
  if (typeof meta.devaluacion_pct === 'number') {
    extras.push(`devaluación ${meta.devaluacion_pct}%`);
  }
  if (meta.contrato_id) extras.push(`contrato ${String(meta.contrato_id).slice(0, 8)}`);
  if (meta.compra_id) extras.push(`compra ${String(meta.compra_id).slice(0, 8)}`);

  if (!base && extras.length === 0) return '—';
  if (!extras.length) return base;
  if (!base) return extras.join(' · ');
  const useful = extras.filter((e) => !base.toLowerCase().includes(e.toLowerCase().slice(0, 12)));
  return useful.length ? `${base} · ${useful.join(' · ')}` : base;
}

export function etiquetaActor(actor: string | null | undefined): string {
  const a = String(actor ?? '').trim();
  if (!a || a === '—' || a === 'null') return 'Sin actor';
  return a;
}
