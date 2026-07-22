'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CcoProyectoConfig } from '@/lib/contabilidad/cco/proyectoConfig';

type GemeloPar = {
  fecha: string;
  monto_usd: number;
  conservar: { id: string; origen_fondo: string };
  eliminar: Array<{ id: string; origen_fondo: string }>;
};

type PreviewGemelos = {
  cantidad: number;
  montoUsd: number;
  pares: GemeloPar[];
};

type Props = {
  proyectoId: string;
  onSaved?: (config: CcoProyectoConfig) => void;
};

function fmtUsd(n: number): string {
  return n.toLocaleString('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CcoTabAjustes({ proyectoId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reparando, setReparando] = useState(false);
  const [revisandoGemelos, setRevisandoGemelos] = useState(false);
  const [resolviendoGemelos, setResolviendoGemelos] = useState(false);
  const [previewGemelos, setPreviewGemelos] = useState<PreviewGemelos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [honorariosAd, setHonorariosAd] = useState<number | null>(null);
  const [form, setForm] = useState({
    honorarios_admin_pct: '15',
    devaluacion_pct: '0',
    empresa_nombre: '',
    obra_alias: '',
    area_m2: '',
    fuente: 'default' as CcoProyectoConfig['fuente_honorarios'],
  });

  const cargar = useCallback(async () => {
    if (!proyectoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contabilidad/cco/config?proyecto=${encodeURIComponent(proyectoId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Error');
      const c = json.config as CcoProyectoConfig;
      setHonorariosAd(json.honorarios_ad != null ? Number(json.honorarios_ad) : null);
      const deval = Number(c.devaluacion_pct ?? 0);
      setForm({
        honorarios_admin_pct: String(c.honorarios_admin_pct ?? 15),
        // API ya normaliza a forma V4 (−); forzar string del valor corregido.
        devaluacion_pct: String(Number.isFinite(deval) ? deval : 0),
        empresa_nombre: c.empresa_nombre ?? '',
        obra_alias: c.obra_alias ?? '',
        area_m2: c.area_m2 != null ? String(c.area_m2) : '',
        fuente: c.fuente_honorarios,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    void cargar();
    setPreviewGemelos(null);
  }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!proyectoId) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          honorarios_admin_pct: Number(form.honorarios_admin_pct),
          devaluacion_pct: Number(form.devaluacion_pct),
          empresa_nombre: form.empresa_nombre || null,
          obra_alias: form.obra_alias || null,
          area_m2: form.area_m2 !== '' ? Number(form.area_m2) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo guardar');
      const c = json.config as CcoProyectoConfig;
      setForm((f) => ({
        ...f,
        fuente: 'cco',
        devaluacion_pct: String(c.devaluacion_pct ?? f.devaluacion_pct),
      }));
      setOkMsg('Ajustes guardados. El dashboard usará % admin y devaluación de esta obra.');
      onSaved?.(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function repararDescuadre() {
    if (!proyectoId) return;
    if (
      !window.confirm(
        '¿Reparar descuadre CCO?\n\n• Elimina logs de auditoría importados como gasto\n• Quita gastos gemelos duplicados\n• Quita ingresos gemelos (p. ej. LUIS · ABONO + ABONO)\n• Corrige devaluación brecha→V4 (p. ej. +34,45% → −25,62%)\n\nNo toca facturas Telegram con purchase_invoice.',
      )
    ) {
      return;
    }
    setReparando(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/higiene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_id: proyectoId, dry_run: false }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo reparar');
      const partes = [
        json.auditoriaEliminada
          ? `${json.auditoriaEliminada} auditoría(s) eliminada(s)`
          : null,
        json.duplicadosEliminados
          ? `${json.duplicadosEliminados} gasto(s) gemelo(s) eliminado(s)`
          : null,
        json.ingresosGemelosEliminados
          ? `${json.ingresosGemelosEliminados} ingreso(s) gemelo(s) eliminado(s)`
          : null,
        json.devaluacionCorregida
          ? `devaluación ${json.devaluacionAntes} → ${json.devaluacionDespues}`
          : null,
      ].filter(Boolean);
      setOkMsg(
        partes.length
          ? `Reparación OK: ${partes.join(' · ')}. Recarga el dashboard.`
          : 'Sin cambios: libro ya limpio.',
      );
      setPreviewGemelos(null);
      if (json.devaluacionDespues != null) {
        setForm((f) => ({ ...f, devaluacion_pct: String(json.devaluacionDespues) }));
      }
      onSaved?.({
        proyecto_id: proyectoId,
        honorarios_admin_pct: Number(form.honorarios_admin_pct),
        devaluacion_pct: Number(json.devaluacionDespues ?? form.devaluacion_pct),
        empresa_nombre: form.empresa_nombre || null,
        obra_alias: form.obra_alias || null,
        area_m2: form.area_m2 !== '' ? Number(form.area_m2) : null,
        fuente_honorarios: 'cco',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setReparando(false);
    }
  }

  async function revisarIngresosGemelos() {
    if (!proyectoId) return;
    setRevisandoGemelos(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/higiene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          dry_run: true,
          modo: 'ingresos_gemelos',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo revisar');
      const pares = (Array.isArray(json.ingresosGemelosPares)
        ? json.ingresosGemelosPares
        : []) as GemeloPar[];
      const cantidad = Number(json.ingresosGemelosEliminados ?? 0);
      const montoUsd = Number(json.ingresosGemelosMontoUsd ?? 0);
      setPreviewGemelos({ cantidad, montoUsd, pares });
      setOkMsg(
        cantidad > 0
          ? `Encontrados ${cantidad} ingreso(s) gemelo(s) (~${fmtUsd(montoUsd)} de doble conteo). Revisa y confirma para eliminar.`
          : 'No hay ingresos gemelos (LUIS · ABONO + ABONO) en esta obra.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setPreviewGemelos(null);
    } finally {
      setRevisandoGemelos(false);
    }
  }

  async function resolverIngresosGemelos() {
    if (!proyectoId || !previewGemelos || previewGemelos.cantidad <= 0) return;
    if (
      !window.confirm(
        `¿Eliminar ${previewGemelos.cantidad} ingreso(s) gemelo(s)?\n\n` +
          `Se quita la copia con operador (p. ej. «· LUIS ·») y se conserva el ABONO limpio.\n` +
          `Monto de doble conteo a liberar: ~${fmtUsd(previewGemelos.montoUsd)}.\n\n` +
          `No toca ADELANTOs manuales ni ingresos sin gemelo.`,
      )
    ) {
      return;
    }
    setResolviendoGemelos(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch('/api/contabilidad/cco/higiene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          dry_run: false,
          modo: 'ingresos_gemelos',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'No se pudo resolver');
      const n = Number(json.ingresosGemelosEliminados ?? 0);
      const monto = Number(json.ingresosGemelosMontoUsd ?? 0);
      setPreviewGemelos(null);
      setOkMsg(
        n > 0
          ? `Eliminados ${n} ingreso(s) gemelo(s) (~${fmtUsd(monto)}). Recarga el dashboard para ver el KPI.`
          : 'Sin cambios: no quedaban gemelos.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setResolviendoGemelos(false);
    }
  }

  const busy = saving || reparando || revisandoGemelos || resolviendoGemelos;

  if (!proyectoId) {
    return (
      <div style={box}>
        <h3 style={h3}>Ajustes CCO</h3>
        <p style={muted}>Selecciona una obra para editar % admin global y devaluación.</p>
      </div>
    );
  }

  return (
    <div style={box}>
      <h3 style={h3}>Ajustes CCO · obra</h3>
      <p style={muted}>
        Equivalente a <code>.session_metadata.json</code> de V4. El % admin aquí alimenta honorarios del libro CCO
        (distinto del contrato AD de oficina, si existe).
      </p>

      {loading ? (
        <div style={{ display: 'flex', gap: 8, color: '#64748B', alignItems: 'center' }}>
          <Loader2 className="animate-spin" size={16} /> Cargando…
        </div>
      ) : (
        <form onSubmit={guardar} style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <label style={label}>
            % Admin global (honorarios CCO)
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              required
              value={form.honorarios_admin_pct}
              onChange={(e) => setForm((f) => ({ ...f, honorarios_admin_pct: e.target.value }))}
              style={input}
            />
            <span style={{ fontWeight: 600, color: '#94A3B8', fontSize: 11 }}>
              Fuente actual: {form.fuente}
              {honorariosAd != null ? ` · AD oficina: ${honorariosAd}%` : ''}
            </span>
          </label>

          <label style={label}>
            Devaluación promedio (%)
            <input
              type="number"
              min={-100}
              max={100}
              step="0.0001"
              required
              value={form.devaluacion_pct}
              onChange={(e) => setForm((f) => ({ ...f, devaluacion_pct: e.target.value }))}
              style={input}
            />
            <span style={{ fontWeight: 600, color: '#94A3B8', fontSize: 11 }}>
              Forma V4 (poder adquisitivo): suele ser negativa. Si pegas la brecha Binance/BCV
              (+34,45%), al guardar se convierte a ≈ −25,62%.
            </span>
          </label>

          <label style={label}>
            Alias obra
            <input
              value={form.obra_alias}
              onChange={(e) => setForm((f) => ({ ...f, obra_alias: e.target.value }))}
              style={input}
              placeholder="RANCHO FLAMBOYANT"
            />
          </label>

          <label style={label}>
            Empresa
            <input
              value={form.empresa_nombre}
              onChange={(e) => setForm((f) => ({ ...f, empresa_nombre: e.target.value }))}
              style={input}
            />
          </label>

          <label style={label}>
            Área m²
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.area_m2}
              onChange={(e) => setForm((f) => ({ ...f, area_m2: e.target.value }))}
              style={input}
            />
          </label>

          {error ? <p style={{ color: '#B91C1C', fontSize: 13, margin: 0 }}>{error}</p> : null}
          {okMsg ? <p style={{ color: '#15803D', fontSize: 13, margin: 0 }}>{okMsg}</p> : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy} style={btnPrimary}>
              {saving ? 'Guardando…' : 'Guardar ajustes'}
            </button>
            <button type="button" onClick={() => void cargar()} disabled={busy} style={btnGhost}>
              Recargar
            </button>
            <button
              type="button"
              onClick={() => void repararDescuadre()}
              disabled={busy}
              style={btnWarn}
            >
              {reparando ? 'Reparando…' : 'Reparar oficial / real'}
            </button>
          </div>

          <div style={gemelosBox}>
            <h4 style={h4}>Ingresos gemelos (doble conteo CSV)</h4>
            <p style={{ ...muted, marginBottom: 10 }}>
              El CSV a veces trae el mismo ABONO dos veces: una con operador de sesión
              («· LUIS ·») y otra limpia. Ambas suman al KPI. Aquí puedes revisar y borrar
              solo la copia con operador. No toca ADELANTOs manuales.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => void revisarIngresosGemelos()}
                disabled={busy}
                style={btnGhost}
              >
                {revisandoGemelos ? 'Revisando…' : 'Revisar gemelos'}
              </button>
              <button
                type="button"
                onClick={() => void resolverIngresosGemelos()}
                disabled={busy || !previewGemelos || previewGemelos.cantidad <= 0}
                style={btnDanger}
              >
                {resolviendoGemelos
                  ? 'Eliminando…'
                  : previewGemelos && previewGemelos.cantidad > 0
                    ? `Eliminar ${previewGemelos.cantidad} gemelo(s)`
                    : 'Eliminar gemelos'}
              </button>
            </div>
            {previewGemelos ? (
              <div style={{ fontSize: 13, color: '#334155' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700 }}>
                  {previewGemelos.cantidad > 0
                    ? `${previewGemelos.cantidad} a eliminar · ~${fmtUsd(previewGemelos.montoUsd)} de doble conteo`
                    : 'Sin gemelos detectados'}
                </p>
                {previewGemelos.pares.length > 0 ? (
                  <div style={paresList}>
                    {previewGemelos.pares.slice(0, 12).map((p) => (
                      <div key={`${p.fecha}-${p.monto_usd}-${p.conservar.id}`} style={parRow}>
                        <div style={{ fontWeight: 700 }}>
                          {p.fecha} · {fmtUsd(p.monto_usd)}
                        </div>
                        <div style={{ color: '#15803D', fontSize: 12 }}>
                          Conservar: {p.conservar.origen_fondo || '(sin origen)'}
                        </div>
                        {p.eliminar.map((e) => (
                          <div key={e.id} style={{ color: '#B91C1C', fontSize: 12 }}>
                            Borrar: {e.origen_fondo || e.id.slice(0, 8)}
                          </div>
                        ))}
                      </div>
                    ))}
                    {previewGemelos.pares.length > 12 ? (
                      <p style={{ margin: 0, color: '#64748B', fontSize: 12 }}>
                        …y {previewGemelos.pares.length - 12} par(es) más
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}

const box: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E2E8F0',
  padding: 24,
};
const h3: React.CSSProperties = { margin: '0 0 8px', fontSize: 18, fontWeight: 800 };
const h4: React.CSSProperties = { margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#0F172A' };
const muted: React.CSSProperties = { color: '#64748B', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 };
const label: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color: '#64748B',
};
const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: 14,
  fontWeight: 600,
  color: '#0F172A',
};
const btnPrimary: React.CSSProperties = {
  background: '#2563EB',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
const btnGhost: React.CSSProperties = {
  background: '#fff',
  color: '#334155',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
const btnWarn: React.CSSProperties = {
  background: '#FFF7ED',
  color: '#9A3412',
  border: '1px solid #FDBA74',
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
const btnDanger: React.CSSProperties = {
  background: '#FEF2F2',
  color: '#991B1B',
  border: '1px solid #FECACA',
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 13,
};
const gemelosBox: React.CSSProperties = {
  marginTop: 8,
  padding: 14,
  borderRadius: 10,
  border: '1px solid #FDE68A',
  background: '#FFFBEB',
};
const paresList: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  maxHeight: 280,
  overflow: 'auto',
};
const parRow: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  background: '#fff',
  border: '1px solid #E2E8F0',
};
