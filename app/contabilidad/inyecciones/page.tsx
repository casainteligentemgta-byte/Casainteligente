'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { InyeccionCapitalRow } from '@/lib/contabilidad/inyeccionesCapitalTypes';
import { useTasaBcvHoy } from '@/lib/contabilidad/useTasaBcvHoy';
import { useSyncSubmitLock } from '@/hooks/useSyncSubmitLock';

type ObraRow = { id: string; nombre: string };

const INPUT =
  'w-full rounded-md border border-white/[0.06] bg-[#12121A] px-3 py-2 text-xs text-white outline-none focus:border-[#FF9500]';
const LABEL = 'mb-1 block text-xs uppercase text-zinc-500';

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBs(n: number): string {
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InyeccionesAvanzadasPage() {
  const [inyecciones, setInyecciones] = useState<InyeccionCapitalRow[]>([]);
  const [obras, setObras] = useState<ObraRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [obraSel, setObraSel] = useState('');
  const [origen, setOrigen] = useState('');
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [monto, setMonto] = useState('');
  const [tipoTasa, setTipoTasa] = useState<'BCV' | 'PERSONALIZADA'>('BCV');
  const [tasaPersonalizada, setTasaPersonalizada] = useState('');
  const [metodoPago, setMetodoPago] = useState<'TRANSFERENCIA' | 'EFECTIVO'>('TRANSFERENCIA');
  const [banco, setBanco] = useState('');
  const [cuentaDestino, setCuentaDestino] = useState('');
  const [refBancaria, setRefBancaria] = useState('');

  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [soportePath, setSoportePath] = useState('');
  const [soporteUrl, setSoporteUrl] = useState('');
  const [serialesIa, setSerialesIa] = useState<string[]>([]);

  const { tasa: tasaBcv, loading: cargandoTasa } = useTasaBcvHoy();
  const { isSubmitting, runLocked } = useSyncSubmitLock();

  const tasaAplicada = useMemo(() => {
    if (tipoTasa === 'PERSONALIZADA') {
      const n = Number(tasaPersonalizada);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return tasaBcv && tasaBcv > 0 ? tasaBcv : null;
  }, [tipoTasa, tasaPersonalizada, tasaBcv]);

  const cargarHistorial = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await fetch('/api/contabilidad/inyecciones', { cache: 'no-store' });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        hint?: string;
        obras?: ObraRow[];
        inyecciones?: InyeccionCapitalRow[];
      };
      if (!res.ok && res.status !== 503) {
        throw new Error([json.error, json.hint].filter(Boolean).join(' — '));
      }
      setObras(json.obras ?? []);
      setInyecciones(json.inyecciones ?? []);
      if (json.error) setErrorCarga([json.error, json.hint].filter(Boolean).join(' — '));
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarHistorial();
  }, [cargarHistorial]);

  const resetFormulario = () => {
    setObraSel('');
    setOrigen('');
    setMoneda('USD');
    setMonto('');
    setTipoTasa('BCV');
    setTasaPersonalizada('');
    setMetodoPago('TRANSFERENCIA');
    setBanco('');
    setCuentaDestino('');
    setRefBancaria('');
    setSoportePath('');
    setSoporteUrl('');
    setSerialesIa([]);
  };

  const procesarImagenConIA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!obraSel) {
      toast.error('Seleccione primero la obra destino.');
      return;
    }

    setSubiendoArchivo(true);
    try {
      const fd = new FormData();
      fd.set('proyecto_id', obraSel);
      fd.set('metodo_pago', metodoPago);
      fd.set('archivo', file);

      const res = await fetch('/api/contabilidad/inyecciones/soporte', {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json()) as {
        error?: string;
        soporte_storage_path?: string;
        soporte_url?: string;
        seriales_billetes?: string[];
      };
      if (!res.ok) throw new Error(json.error || 'No se pudo procesar el archivo.');

      setSoportePath(json.soporte_storage_path ?? '');
      setSoporteUrl(json.soporte_url ?? '');
      const seriales = json.seriales_billetes ?? [];
      setSerialesIa(seriales);

      if (metodoPago === 'EFECTIVO' && seriales.length > 0) {
        toast.success(`IA extrajo ${seriales.length} serial(es) de billetes.`);
      } else {
        toast.success('Comprobante cargado.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir soporte.');
    } finally {
      setSubiendoArchivo(false);
    }
  };

  const guardarInyeccion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraSel) {
      toast.error('Seleccione obra destino.');
      return;
    }
    if (!origen.trim()) {
      toast.error('Indique origen del fondo.');
      return;
    }
    const montoN = Number(monto);
    if (!Number.isFinite(montoN) || montoN <= 0) {
      toast.error('Monto inválido.');
      return;
    }
    if (!tasaAplicada) {
      toast.error('Espere la tasa BCV o indique tasa personalizada.');
      return;
    }

    await runLocked(async () => {
      try {
        const res = await fetch('/api/contabilidad/inyecciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto_id: obraSel,
            origen_fondo: origen.trim(),
            monto: montoN,
            moneda,
            tipo_tasa: tipoTasa,
            tasa_aplicada: tasaAplicada,
            tasa_bcv: tasaBcv,
            metodo_pago: metodoPago,
            banco_origen: banco,
            cuenta_bancaria_destino: cuentaDestino,
            referencia_bancaria: refBancaria,
            soporte_storage_path: soportePath || null,
            seriales_billetes: serialesIa,
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          inyeccion?: InyeccionCapitalRow;
        };
        if (!res.ok) throw new Error(json.error || 'No se pudo registrar la inyección.');

        if (json.inyeccion) {
          setInyecciones((prev) => [json.inyeccion!, ...prev]);
        } else {
          await cargarHistorial();
        }
        toast.success('Inyección procesada y balance recalculado.');
        resetFormulario();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6 pb-24">
      <Link
        href="/contabilidad"
        className="text-xs text-zinc-500 hover:text-zinc-300 no-underline"
      >
        ← Contabilidad
      </Link>

      <div className="border border-white/[0.04] bg-white/[0.02] backdrop-blur-md rounded-xl p-6 mb-6 mt-3">
        <h1 className="text-2xl font-bold">
          Inyecciones de Capital{' '}
          <span className="text-[#FF9500]">· Módulo de Auditoría Avanzada</span>
        </h1>
        <p className="mt-2 text-xs text-zinc-500">
          Registro bimonetario con soporte bancario o custodia de efectivo en patio.
        </p>
      </div>

      {errorCarga ? (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {errorCarga}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="border border-white/10 bg-white/[0.02] backdrop-blur-xl rounded-xl p-6 space-y-4 h-fit">
          <form onSubmit={guardarInyeccion} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMetodoPago('TRANSFERENCIA')}
                className={`py-2 text-xs font-bold rounded ${metodoPago === 'TRANSFERENCIA' ? 'bg-[#FF9500] text-black' : 'bg-white/5 text-zinc-400'}`}
              >
                🏦 Banco
              </button>
              <button
                type="button"
                onClick={() => setMetodoPago('EFECTIVO')}
                className={`py-2 text-xs font-bold rounded ${metodoPago === 'EFECTIVO' ? 'bg-[#FF9500] text-black' : 'bg-white/5 text-zinc-400'}`}
              >
                💵 Efectivo
              </button>
            </div>

            <div>
              <label className={LABEL}>Obra destino</label>
              <select
                value={obraSel}
                onChange={(e) => setObraSel(e.target.value)}
                className={INPUT}
                required
              >
                <option value="">-- Seleccionar --</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Origen del fondo</label>
              <input
                type="text"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                className={INPUT}
                placeholder="Ej. Socio, préstamo interno, aporte patrimonial"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={LABEL}>Monto</label>
                <input
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className={INPUT}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className={LABEL}>Moneda</label>
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as 'USD' | 'VES')}
                  className={INPUT}
                >
                  <option value="USD">USD</option>
                  <option value="VES">VES</option>
                </select>
              </div>
            </div>

            <div className="border border-white/5 bg-white/[0.01] p-3 rounded-lg space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">
                  TASA BCV:{' '}
                  <b className="text-white">
                    {cargandoTasa ? '…' : tasaBcv != null ? tasaBcv.toFixed(2) : '—'}
                  </b>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoTasa('BCV')}
                    className={`px-2 py-0.5 rounded text-[10px] ${tipoTasa === 'BCV' ? 'bg-orange-500/20 text-[#FF9500] border border-[#FF9500]/30' : 'text-zinc-500'}`}
                  >
                    Usar BCV
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoTasa('PERSONALIZADA')}
                    className={`px-2 py-0.5 rounded text-[10px] ${tipoTasa === 'PERSONALIZADA' ? 'bg-orange-500/20 text-[#FF9500] border border-[#FF9500]/30' : 'text-zinc-500'}`}
                  >
                    Personalizar
                  </button>
                </div>
              </div>
              {tipoTasa === 'PERSONALIZADA' ? (
                <input
                  type="number"
                  step="0.01"
                  value={tasaPersonalizada}
                  onChange={(e) => setTasaPersonalizada(e.target.value)}
                  className={`${INPUT} text-center`}
                  placeholder="Introduce tasa especial"
                  required
                />
              ) : null}
            </div>

            {metodoPago === 'TRANSFERENCIA' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Banco de origen (Ej: Banesco)"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  className={INPUT}
                  required
                />
                <input
                  type="text"
                  placeholder="Cuenta destino Casa Inteligente"
                  value={cuentaDestino}
                  onChange={(e) => setCuentaDestino(e.target.value)}
                  className={INPUT}
                  required
                />
                <input
                  type="text"
                  placeholder="Número de referencia"
                  value={refBancaria}
                  onChange={(e) => setRefBancaria(e.target.value)}
                  className={`${INPUT} font-mono`}
                  required
                />
              </div>
            ) : (
              <div className="p-3 bg-yellow-500/[0.02] border border-yellow-500/10 rounded-lg text-xs text-zinc-400">
                ⚠️ Dinero clasificado como <b>EFECTIVO EN PATIO</b>. Se habilitará el escaneo de
                seriales de custodia.
              </div>
            )}

            <div>
              <label className={LABEL}>Comprobante / captura billetes</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={procesarImagenConIA}
                disabled={subiendoArchivo}
                className="w-full text-xs text-zinc-500 file:bg-white/5 file:border-0 file:text-white file:px-3 file:py-1.5 file:rounded file:mr-3 cursor-pointer"
              />
              {soporteUrl ? (
                <a
                  href={soporteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-[10px] text-[#FF9500] hover:underline"
                >
                  Ver soporte cargado
                </a>
              ) : null}
            </div>

            {serialesIa.length > 0 ? (
              <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg text-xs">
                <div className="text-[#FF9500] font-bold mb-1">🤖 Seriales leídos por IA:</div>
                <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                  {serialesIa.map((s) => (
                    <span key={s} className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={subiendoArchivo || isSubmitting}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-700 text-black text-xs font-bold py-2.5 rounded-md transition-all disabled:opacity-60"
            >
              {subiendoArchivo
                ? 'Procesando archivo…'
                : isSubmitting
                  ? 'Guardando…'
                  : 'Confirmar inyección de capital'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 overflow-x-auto border border-white/[0.04] bg-white/[0.02] backdrop-blur-md rounded-xl">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 p-12 text-zinc-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando historial…
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01] text-xs font-semibold text-zinc-400 uppercase">
                  <th className="p-4">Detalle / fecha</th>
                  <th className="p-4">Origen / cuenta</th>
                  <th className="p-4 text-center">Tasas</th>
                  <th className="p-4 text-right">Monto neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-xs text-zinc-300">
                {inyecciones.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-zinc-500">
                      Sin inyecciones registradas.
                    </td>
                  </tr>
                ) : (
                  inyecciones.map((iny) => (
                    <tr key={iny.id} className="hover:bg-white/[0.01] transition-all">
                      <td className="p-4">
                        <div className="font-bold text-white">
                          {iny.proyecto_nombre ?? 'Obra'}
                        </div>
                        <div className="text-zinc-500 font-mono mt-1">
                          {iny.creado_al
                            ? new Date(iny.creado_al).toLocaleString('es-VE')
                            : '—'}
                        </div>
                        <div className="text-[10px] text-zinc-600 mt-1">{iny.origen_fondo}</div>
                      </td>
                      <td className="p-4">
                        {iny.metodo_pago === 'EFECTIVO' ? (
                          <span className="text-amber-500 font-bold">💵 EFECTIVO DE CAJA</span>
                        ) : (
                          <span className="text-zinc-500 font-mono text-[11px]">
                            🏦 {iny.banco_origen} → cta: {iny.cuenta_bancaria_destino || 'S/N'}
                          </span>
                        )}
                        {iny.seriales_billetes.length > 0 ? (
                          <div className="mt-1 text-[10px] text-zinc-600 font-mono">
                            {iny.seriales_billetes.length} serial(es)
                          </div>
                        ) : null}
                      </td>
                      <td className="p-4 text-center font-mono text-[11px]">
                        <div>BCV: {iny.tasa_bcv ?? '—'}</div>
                        <div
                          className={`mt-1 font-bold ${iny.tipo_tasa === 'PERSONALIZADA' ? 'text-[#FF9500]' : 'text-zinc-500'}`}
                        >
                          Aplicada: {iny.tasa_aplicada}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-semibold">
                        <div className="text-green-400 text-sm">+${fmtUsd(iny.monto_usd)}</div>
                        <div className="text-zinc-500 text-[11px] mt-0.5">
                          Bs. {fmtBs(iny.monto_ves)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
