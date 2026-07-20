/** Helpers y tipos de presentación de snapshots CCO (seguros para cliente). */

export type CcoSnapshotMotivo = 'manual' | 'diario' | 'pre_restore' | 'pre_import' | 'pre_edit';

export type CcoSnapshotMeta = {
  id: string;
  proyecto_id: string;
  label: string | null;
  motivo: CcoSnapshotMotivo;
  punto_en_tiempo: string;
  creado_por: string | null;
  resumen: Record<string, unknown>;
  bytes_aprox: number;
  created_at: string;
};

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtResumen(r: Record<string, unknown> | null | undefined): string {
  if (!r) return '—';
  const parts = [
    r.gastos != null ? `${r.gastos} gastos` : null,
    r.ingresos != null ? `${r.ingresos} ingresos` : null,
    r.contratos != null ? `${r.contratos} contratos` : null,
    r.presupuestos != null ? `${r.presupuestos} presup.` : null,
  ].filter(Boolean);
  return parts.join(' · ') || '—';
}
