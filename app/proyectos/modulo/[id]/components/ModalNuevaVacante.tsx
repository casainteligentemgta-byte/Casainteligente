'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle, X } from 'lucide-react';
import {
  CARGOS_OBREROS,
  cargoPorCodigo,
  tipoVacantePorNivel,
  type TipoVacante,
} from '@/lib/constants/cargosObreros';
import { apiUrl, assertHttpOrigin } from '@/lib/http/apiUrl';

export type ModalNuevaVacanteProps = {
  open: boolean;
  onClose: () => void;
  /** UUID de `ci_proyectos` (detalle módulo integral). */
  proyectoModuloId: string;
  proyectoNombre?: string | null;
};

const SHELL = '#0A0A0F';

export default function ModalNuevaVacante({
  open,
  onClose,
  proyectoModuloId,
  proyectoNombre,
}: ModalNuevaVacanteProps) {
  const [paso, setPaso] = useState(1);
  const [cargoCodigo, setCargoCodigo] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [auditando, setAuditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLink, setNeedLink] = useState<string | null>(null);

  const cargoSel = cargoCodigo ? cargoPorCodigo(cargoCodigo) : undefined;
  const tipoVacante: TipoVacante | null = cargoSel ? tipoVacantePorNivel(cargoSel.nivel) : null;

  const reset = useCallback(() => {
    setPaso(1);
    setCargoCodigo('');
    setCantidad('1');
    setAuditando(false);
    setGuardando(false);
    setError(null);
    setNeedLink(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const tituloVacante = useMemo(() => {
    const n = Math.max(1, Math.floor(Number(cantidad) || 1));
    if (cargoSel) return `${n}× ${cargoSel.nombre} (nivel ${cargoSel.nivel})`;
    return 'Nueva vacante';
  }, [cargoSel, cantidad]);

  const simularAuditoria = () => {
    if (!cargoSel || !tipoVacante) {
      setError('Selecciona un cargo del tabulador.');
      return;
    }
    const q = Math.max(1, Math.floor(Number(cantidad) || 1));
    if (!Number.isFinite(q) || q < 1) {
      setError('Indica una cantidad válida (mínimo 1).');
      return;
    }
    setError(null);
    setAuditando(true);
    window.setTimeout(() => {
      setAuditando(false);
      setPaso(2);
    }, 1500);
  };

  const autorizarYContratar = async () => {
    if (!cargoSel || !tipoVacante) return;
    const q = Math.max(1, Math.floor(Number(cantidad) || 1));
    setError(null);
    const originErr = assertHttpOrigin();
    if (originErr) {
      setError(originErr);
      return;
    }
    setGuardando(true);
    const nombreProy = (proyectoNombre ?? '').trim() || 'Módulo integral';
    const notasAuditoria = [
      `Override presupuestario · módulo proyecto «${nombreProy}» (${proyectoModuloId.slice(0, 8)}…).`,
      `Plazas solicitadas: ${q}.`,
      'Validación presupuesto: simulación (CEO autorizó continuar).',
    ].join(' ');

    try {
      let res: Response;
      try {
        res = await fetch(apiUrl('/api/recruitment/needs'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: tituloVacante,
            notes: `Vacante desde módulo integral. Cliente/proyecto: ${nombreProy}.`,
            proyecto_modulo_id: proyectoModuloId,
            cargo_codigo: cargoSel.codigo,
            cargo_nombre: cargoSel.nombre,
            cargo_nivel: cargoSel.nivel,
            tipo_vacante: tipoVacante,
            alerta_presupuesto_ignorada: true,
            notas_autorizacion: notasAuditoria,
          }),
        });
      } catch {
        setError(
          'No hay conexión con el servidor Next (¿`npm run dev` activo y mismo origen/puerto que la página?).',
        );
        return;
      }
      const raw = await res.text();
      let data: { id?: string; error?: string; hint?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        const probe = apiUrl('/api/recruitment/needs');
        if (res.status === 404) {
          setError(
            `HTTP 404 en la API (respuesta no JSON). Comprueba que estás en el mismo origen que Next (p. ej. ${probe}). Si abres esa URL y ves JSON con "needs" o un error, el servidor es correcto; si ves 404 HTML, no es esta app o el puerto no coincide.`,
          );
        } else {
          setError(
            `El servidor respondió HTTP ${res.status} sin JSON válido. Revisa la terminal del dev server. URL probada: ${probe}`,
          );
        }
        return;
      }
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(' — ') || 'No se pudo crear la vacante');
        return;
      }
      const id = data.id;
      if (!id) {
        setError('La API no devolvió el id de la vacante.');
        return;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setNeedLink(`${origin}/reclutamiento?need=${id}`);
      setPaso(3);
    } catch {
      setError('Error inesperado al procesar la respuesta del servidor.');
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md transition-opacity duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-vacante-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0A0A0F] p-8 text-white shadow-2xl transition-all duration-300"
        style={{ backgroundColor: SHELL }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        {paso === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 id="modal-vacante-titulo" className="text-xl font-bold tracking-tight text-white">
                Abrir vacante
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Proyecto: <span className="text-zinc-300">{proyectoNombre?.trim() || '—'}</span>
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Cargo a solicitar
              </label>
              <select
                value={cargoCodigo}
                onChange={(e) => setCargoCodigo(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[#FF9500]/50"
                style={{ colorScheme: 'dark' }}
              >
                <option value="">Selecciona…</option>
                {CARGOS_OBREROS.map((c) => (
                  <option key={c.codigo} value={c.codigo} className="bg-zinc-900">
                    {c.nombre} (nivel {c.nivel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Cantidad</label>
              <input
                type="number"
                min={1}
                max={500}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="mt-2 w-full max-w-[140px] rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[#FFD60A]/40"
              />
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
              type="button"
              onClick={simularAuditoria}
              disabled={auditando}
              className="w-full rounded-xl bg-gradient-to-r from-[#FFD60A] to-[#FF9500] py-3.5 text-sm font-bold text-black shadow-lg shadow-orange-500/20 transition hover:opacity-95 disabled:opacity-50"
            >
              {auditando ? 'Auditando presupuesto…' : 'Siguiente'}
            </button>
          </div>
        )}

        {paso === 2 && (
          <div className="relative space-y-6 animate-in fade-in duration-300">
            <div className="flex gap-4 rounded-xl border border-[#FF9500]/45 bg-[#FF9500]/[0.08] p-4 backdrop-blur-sm">
              <AlertTriangle className="h-7 w-7 shrink-0 text-[#FF9500]" aria-hidden />
              <div>
                <h3 className="font-bold text-[#FFD60A]">Alerta de presupuesto</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  La contratación estimada para <strong className="text-white">{tituloVacante}</strong> excede el margen
                  de referencia del presupuesto del proyecto (simulación). Puedes cancelar o autorizar con trazabilidad
                  de auditoría.
                </p>
              </div>
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPaso(1);
                }}
                disabled={guardando}
                className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-white/[0.06] py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void autorizarYContratar()}
                disabled={guardando}
                className="min-h-[44px] flex-1 rounded-xl bg-gradient-to-r from-[#FF9500] to-red-600 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(249,115,22,0.25)] transition hover:opacity-95 disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Autorizar y contratar'}
              </button>
            </div>
            {guardando ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
                <p className="text-sm font-medium text-zinc-200">Guardando vacante…</p>
              </div>
            ) : null}
          </div>
        )}

        {paso === 3 && needLink && (
          <div className="space-y-6 text-center animate-in fade-in duration-300">
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
            <h2 className="text-xl font-bold text-white">Vacante registrada</h2>
            <p className="text-sm text-zinc-400">
              Se guardó con <code className="text-zinc-300">alerta_presupuesto_ignorada = true</code> y notas de
              autorización.
            </p>
            <div className="break-all rounded-xl border border-white/10 bg-white/[0.04] p-4 font-mono text-xs text-[#FFD60A]">
              {needLink}
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Hola, este es tu enlace para la entrevista: ${needLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                Enviar a candidato <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
