'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Banknote, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';
import { apiUrl } from '@/lib/http/apiUrl';
import { parseFetchJson } from '@/lib/utils/parseFetchJson';
import { formatApiErrorBody } from '@/lib/utils/formatErrorMessage';
import {
  METODOS_ABONO_PRESUPUESTO,
  etiquetaEstadoCuota,
  etiquetaMetodoAbono,
  redondearUsd,
  type BudgetAbono,
  type BudgetCuota,
} from '@/lib/presupuesto/cobros';

type Tab = 'abono' | 'cuotas' | 'historial';

type Resumen = {
  id: string;
  customer_name?: string | null;
  subtotal: number;
  monto_pagado: number;
  saldo: number;
  status: string;
};

export default function PresupuestoCobrosModal({
  open,
  budgetId,
  customerName,
  onClose,
  onChanged,
}: {
  open: boolean;
  budgetId: string | null;
  customerName?: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('abono');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [abonos, setAbonos] = useState<BudgetAbono[]>([]);
  const [cuotas, setCuotas] = useState<(BudgetCuota & { estado_ui?: string })[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [metodo, setMetodo] = useState<(typeof METODOS_ABONO_PRESUPUESTO)[number]>('zelle');
  const [banco, setBanco] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [cuotaId, setCuotaId] = useState('');

  const [cantidadCuotas, setCantidadCuotas] = useState('3');
  const [primeraFecha, setPrimeraFecha] = useState('');
  const [intervalo, setIntervalo] = useState('30');

  const { isSubmitting, runLocked } = useSyncSubmitLock();
  const { tasa, loading: cargandoTasa } = useTasaBcvHoy(fecha || undefined);

  const resetForm = useCallback(() => {
    setMonto('');
    setMoneda('USD');
    setMetodo('zelle');
    setBanco('');
    setReferencia('');
    setFecha(new Date().toISOString().slice(0, 10));
    setNotas('');
    setCuotaId('');
    setCantidadCuotas('3');
    setPrimeraFecha(new Date().toISOString().slice(0, 10));
    setIntervalo('30');
    setError(null);
    setTab('abono');
  }, []);

  const load = useCallback(async () => {
    if (!budgetId) return;
    setLoading(true);
    setHint(null);
    try {
      const res = await fetch(apiUrl(`/api/budgets/${budgetId}/abonos`), { credentials: 'include' });
      const json = await parseFetchJson<{
        presupuesto?: Resumen;
        abonos?: BudgetAbono[];
        cuotas?: (BudgetCuota & { estado_ui?: string })[];
        error?: string;
        hint?: string;
      }>(res);
      if (!res.ok) {
        if (json.hint) setHint(json.hint);
        throw new Error(formatApiErrorBody(json));
      }
      setResumen(json.presupuesto ?? null);
      setAbonos(json.abonos ?? []);
      setCuotas(json.cuotas ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los cobros');
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    if (!open) return;
    resetForm();
    void load();
  }, [open, resetForm, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isSubmitting, onClose]);

  const equivalenteUsd = useMemo(() => {
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (moneda === 'USD') return redondearUsd(n);
    if (!tasa || tasa <= 0) return null;
    return redondearUsd(n / tasa);
  }, [monto, moneda, tasa]);

  const guardarAbono = () => {
    if (!budgetId) return;
    setError(null);
    const montoN = Number(monto);
    if (!Number.isFinite(montoN) || montoN <= 0) {
      setError('Indique el monto recibido.');
      return;
    }
    if (!fecha) {
      setError('Indique la fecha del abono.');
      return;
    }
    if (moneda === 'VES' && (!tasa || tasa <= 0)) {
      setError('Espere la tasa BCV o elija otra fecha.');
      return;
    }
    void runLocked(async () => {
      try {
        const res = await fetch(apiUrl(`/api/budgets/${budgetId}/abonos`), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            monto: montoN,
            moneda,
            monto_usd: equivalenteUsd,
            tasa_bcv: moneda === 'VES' ? tasa : null,
            metodo,
            banco_origen: banco.trim() || null,
            referencia: referencia.trim() || null,
            fecha_abono: fecha,
            notas: notas.trim() || null,
            cuota_id: cuotaId || null,
          }),
        });
        const json = await parseFetchJson<{ error?: string; hint?: string }>(res);
        if (!res.ok) {
          if (json.hint) setHint(json.hint);
          throw new Error(formatApiErrorBody(json));
        }
        toast.success('Abono registrado.');
        setMonto('');
        setReferencia('');
        setNotas('');
        await load();
        onChanged?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo registrar el abono';
        setError(msg);
        toast.error(msg);
      }
    });
  };

  const planificar = () => {
    if (!budgetId) return;
    setError(null);
    void runLocked(async () => {
      try {
        const res = await fetch(apiUrl(`/api/budgets/${budgetId}/cuotas`), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cantidad: Number(cantidadCuotas),
            primera_fecha: primeraFecha,
            intervalo_dias: Number(intervalo),
          }),
        });
        const json = await parseFetchJson<{ error?: string }>(res);
        if (!res.ok) throw new Error(formatApiErrorBody(json));
        toast.success('Cuotas planificadas.');
        await load();
        onChanged?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudieron crear las cuotas';
        setError(msg);
        toast.error(msg);
      }
    });
  };

  const borrarAbono = (abonoId: string) => {
    if (!budgetId || !confirm('¿Eliminar este abono?')) return;
    void runLocked(async () => {
      const res = await fetch(apiUrl(`/api/budgets/${budgetId}/abonos?abono_id=${abonoId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await load();
        onChanged?.();
      }
    });
  };

  const borrarCuota = (id: string) => {
    if (!budgetId) return;
    void runLocked(async () => {
      const res = await fetch(apiUrl(`/api/budgets/${budgetId}/cuotas?cuota_id=${id}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await parseFetchJson<{ error?: string }>(res);
      if (!res.ok) {
        toast.error(formatApiErrorBody(json));
        return;
      }
      await load();
      onChanged?.();
    });
  };

  if (!open || !budgetId) return null;

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const input: CSSProperties = {
    width: '100%',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '10px 12px',
    color: '#0F172A',
    fontSize: '14px',
    outline: 'none',
  };
  const label: CSSProperties = {
    display: 'block',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: '6px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cobros-presupuesto-title"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(15,23,42,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '16px 18px 8px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Banknote size={20} color="#047857" />
            <div>
              <h2 id="cobros-presupuesto-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                Registrar abono
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748B' }}>
                {resumen?.customer_name || customerName || 'Presupuesto'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '0 18px 12px' }}>
          {[
            { l: 'Total', v: resumen ? `$${fmt(resumen.subtotal)}` : '—' },
            { l: 'Abonado', v: resumen ? `$${fmt(resumen.monto_pagado)}` : '—' },
            { l: 'Saldo', v: resumen ? `$${fmt(resumen.saldo)}` : '—' },
          ].map((x) => (
            <div key={x.l} style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 8px' }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{x.l}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{x.v}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '0 18px 12px' }}>
          {(
            [
              ['abono', 'Abono'],
              ['cuotas', 'Cuotas'],
              ['historial', 'Historial'],
            ] as const
          ).map(([k, labelTab]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setError(null);
              }}
              style={{
                flex: 1,
                border: tab === k ? '1px solid #04785755' : '1px solid #E2E8F0',
                background: tab === k ? '#D1FAE5' : '#FFFFFF',
                color: tab === k ? '#047857' : '#475569',
                borderRadius: 999,
                padding: '8px 6px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {labelTab}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 18px 20px' }}>
          {hint ? (
            <p style={{ fontSize: 12, color: '#B45309', background: '#FEF3C7', padding: 10, borderRadius: 10 }}>
              Pendiente en producción: {hint}
            </p>
          ) : null}
          {error ? <p style={{ fontSize: 13, color: '#DC2626', margin: '0 0 10px' }}>{error}</p> : null}
          {loading ? <p style={{ fontSize: 13, color: '#94A3B8' }}>Cargando…</p> : null}

          {tab === 'abono' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={label}>Monto</label>
                <input style={input} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={label}>Moneda</label>
                  <select style={input} value={moneda} onChange={(e) => setMoneda(e.target.value as 'USD' | 'VES')}>
                    <option value="USD">USD</option>
                    <option value="VES">Bs</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Método</label>
                  <select
                    style={input}
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value as (typeof METODOS_ABONO_PRESUPUESTO)[number])}
                  >
                    {METODOS_ABONO_PRESUPUESTO.map((m) => (
                      <option key={m} value={m}>
                        {etiquetaMetodoAbono(m)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {moneda === 'VES' ? (
                <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                  {cargandoTasa ? 'Cargando tasa BCV…' : tasa ? `≈ $${fmt(equivalenteUsd ?? 0)} (BCV ${tasa})` : 'Sin tasa BCV'}
                </p>
              ) : null}
              <div>
                <label style={label}>Fecha</label>
                <input style={input} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              {cuotas.length ? (
                <div>
                  <label style={label}>Aplicar a cuota (opcional)</label>
                  <select style={input} value={cuotaId} onChange={(e) => setCuotaId(e.target.value)}>
                    <option value="">Automático (la más próxima)</option>
                    {cuotas.map((c) => (
                      <option key={c.id} value={c.id}>
                        Cuota {c.numero} · ${fmt(c.monto)} · {c.fecha_vencimiento} · {c.estado_ui ?? etiquetaEstadoCuota(c)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label style={label}>Banco / origen</label>
                <input style={input} value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <label style={label}>Referencia</label>
                <input style={input} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Zelle, transferencia…" />
              </div>
              <div>
                <label style={label}>Nota</label>
                <input style={input} value={notas} onChange={(e) => setNotas(e.target.value)} />
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={guardarAbono}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px',
                  background: '#047857',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                {isSubmitting ? 'Guardando…' : 'Registrar abono'}
              </button>
            </div>
          ) : null}

          {tab === 'cuotas' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                Parte el saldo en cuotas. Las ya abonadas se conservan.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={label}>Cantidad</label>
                  <input style={input} inputMode="numeric" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} />
                </div>
                <div>
                  <label style={label}>Primera fecha</label>
                  <input style={input} type="date" value={primeraFecha} onChange={(e) => setPrimeraFecha(e.target.value)} />
                </div>
                <div>
                  <label style={label}>Cada (días)</label>
                  <input style={input} inputMode="numeric" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} />
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={planificar}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px',
                  background: '#1D4ED8',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {isSubmitting ? 'Guardando…' : 'Crear plan de cuotas'}
              </button>
              {cuotas.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {cuotas.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: '#F8FAFC',
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <strong>Cuota {c.numero}</strong>
                        <span style={{ color: '#64748B' }}> · {c.fecha_vencimiento}</span>
                        <div style={{ color: '#475569', fontSize: 12 }}>
                          ${fmt(c.monto_pagado)} / ${fmt(c.monto)} · {c.estado_ui ?? etiquetaEstadoCuota(c)}
                        </div>
                      </div>
                      {Number(c.monto_pagado) <= 0 ? (
                        <button
                          type="button"
                          onClick={() => borrarCuota(c.id)}
                          style={{ border: 'none', background: 'transparent', color: '#DC2626', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#94A3B8' }}>Sin cuotas planificadas.</p>
              )}
            </div>
          ) : null}

          {tab === 'historial' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {abonos.length === 0 ? (
                <p style={{ fontSize: 13, color: '#94A3B8' }}>Aún no hay abonos.</p>
              ) : (
                abonos.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: '#F8FAFC',
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <strong>${fmt(Number(a.monto_usd))}</strong>
                      <span style={{ color: '#64748B' }}>
                        {' '}
                        · {etiquetaMetodoAbono(a.metodo)} · {a.fecha_abono}
                      </span>
                      {a.referencia ? <div style={{ color: '#64748B', fontSize: 12 }}>{a.referencia}</div> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => borrarAbono(a.id)}
                      style={{ border: 'none', background: 'transparent', color: '#DC2626', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Borrar
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
