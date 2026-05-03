'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle, X } from 'lucide-react';
import {
  CARGOS_OBREROS,
  cargoPorCodigo,
  tipoVacantePorNivel,
  type TipoVacante,
} from '@/lib/constants/cargosObreros';
import { calcularCompensacionDiaria, formatoVES } from '@/lib/nomina/compensacionDiaria';
import { apiUrl, assertHttpOrigin } from '@/lib/http/apiUrl';

export type ModalNuevaVacanteProps = {
  open: boolean;
  onClose: () => void;
  proyectoId: string;
  /** Días laborados del mes (misma referencia que el análisis de costos). */
  diasLaboradosMes: number;
  añoMes: string;
  analisis: {
    costoRealMesVES: number;
    presupuestoManoObraReferenciaVES: number;
    filas: Array<{ nombre: string; nivel: number; totalAcumuladoMesVES: number }>;
    obra: { nombre: string };
  };
  onCreated?: (payload: { needId: string; reclutamientoUrl: string }) => void;
};

function distribucionPorNivel(
  filas: ModalNuevaVacanteProps['analisis']['filas'],
): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const f of filas) {
    const k = String(f.nivel);
    dist[k] = (dist[k] ?? 0) + 1;
  }
  return dist;
}

export default function ModalNuevaVacante({
  open,
  onClose,
  proyectoId,
  diasLaboradosMes,
  añoMes,
  analisis,
  onCreated,
}: ModalNuevaVacanteProps) {
  const dias = Math.max(1, Math.min(31, Math.floor(diasLaboradosMes)));
  const [paso, setPaso] = useState(1);
  const [cargoCodigo, setCargoCodigo] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [iaTexto, setIaTexto] = useState<string | null>(null);
  const [alertaPresupuesto, setAlertaPresupuesto] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState('');
  const [needLink, setNeedLink] = useState<string | null>(null);

  const cargoSel = cargoCodigo ? cargoPorCodigo(cargoCodigo) : undefined;
  const tipoVacante: TipoVacante | null = cargoSel ? tipoVacantePorNivel(cargoSel.nivel) : null;

  const reset = useCallback(() => {
    setPaso(1);
    setCargoCodigo('');
    setAnalizando(false);
    setErrorApi(null);
    setIaTexto(null);
    setAlertaPresupuesto(false);
    setMensajeAlerta('');
    setNeedLink(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const tituloVacante = useMemo(() => {
    if (cargoSel) return `Vacante: ${cargoSel.nombre} (nivel ${cargoSel.nivel})`;
    return 'Nueva vacante';
  }, [cargoSel]);

  const simularValidacionIA = async () => {
    if (!cargoSel || !tipoVacante) {
      setErrorApi('Selecciona un cargo del tabulador.');
      return;
    }
    setErrorApi(null);
    setAnalizando(true);
    setIaTexto(null);

    const comp = calcularCompensacionDiaria(cargoSel.nivel);
    const extraMes = Math.round(comp.totalDiarioVES * dias * 100) / 100;
    const conNuevo = Math.round((analisis.costoRealMesVES + extraMes) * 100) / 100;

    const presup = analisis.presupuestoManoObraReferenciaVES;
    let alerta = false;
    let msg = '';
    if (presup > 0 && conNuevo > presup) {
      alerta = true;
      const excesoPct = Math.round(((conNuevo - presup) / presup) * 10_000) / 100;
      msg = `Contratar a un ${cargoSel.nombre} suma unos ${formatoVES(extraMes)} VES al mes (referencia ${dias} días laborados). Con el equipo actual, el costo mensual pasaría de ${formatoVES(analisis.costoRealMesVES)} a ${formatoVES(conNuevo)} VES, por encima del presupuesto de mano de obra (${formatoVES(presup)} VES) en un ${excesoPct}%.`;
    } else if (presup <= 0) {
      msg =
        'La obra no tiene presupuesto de mano de obra definido (o es cero); no se puede contrastar automáticamente. Puedes registrar la vacante igualmente.';
    } else {
      msg = `Estimación de costo mensual adicional: ${formatoVES(extraMes)} VES (${dias} días). Quedaría por debajo del presupuesto de mano de obra de referencia.`;
    }
    setAlertaPresupuesto(alerta);
    setMensajeAlerta(msg);

    try {
      const res = await fetch('/api/finanzas/gemini-nomina-analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presupuestoManoObraVES: presup > 0 ? presup : analisis.costoRealMesVES + extraMes,
          costoRealMesVES: conNuevo,
          añoMes,
          distribucionPorNivel: distribucionPorNivel(analisis.filas),
          filasResumidas: [
            ...analisis.filas.map((f) => ({
              nombre: f.nombre,
              nivel: f.nivel,
              totalMesVES: f.totalAcumuladoMesVES,
            })),
            {
              nombre: `(Vacante) ${cargoSel.nombre}`,
              nivel: cargoSel.nivel,
              totalMesVES: extraMes,
            },
          ],
        }),
      });
      const data = (await res.json()) as { texto?: string; error?: string };
      if (!res.ok) {
        setIaTexto(data.error ?? 'No se obtuvo texto de la API.');
      } else {
        setIaTexto(data.texto ?? '');
      }
    } catch {
      setIaTexto('Error de red al consultar el análisis.');
    } finally {
      setAnalizando(false);
      setPaso(2);
    }
  };

  const ejecutarContratacion = async (esOverride: boolean) => {
    if (!cargoSel || !tipoVacante) return;
    setErrorApi(null);
    const originErr = assertHttpOrigin();
    if (originErr) {
      setErrorApi(originErr);
      return;
    }
    setAnalizando(true);
    const notasExtra = esOverride
      ? '\n[Presupuesto: el usuario autorizó crear la vacante pese a la alerta de desviación estimada.]'
      : '';
    try {
      let res: Response;
      try {
        res = await fetch(apiUrl('/api/recruitment/needs'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: tituloVacante,
            notes: `Desde finanzas del proyecto «${analisis.obra.nombre}».${notasExtra}`.trim(),
            proyecto_id: proyectoId,
            cargo_codigo: cargoSel.codigo,
            cargo_nombre: cargoSel.nombre,
            cargo_nivel: cargoSel.nivel,
            tipo_vacante: tipoVacante,
          }),
        });
      } catch {
        setErrorApi(
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
          setErrorApi(
            `HTTP 404 en la API (respuesta no JSON). Abre en el navegador: ${probe}. Si no ves JSON, el origen o el servidor no es el de esta app Next.`,
          );
        } else {
          setErrorApi(
            `El servidor respondió HTTP ${res.status} sin JSON válido. Revisa la terminal del dev server. URL: ${probe}`,
          );
        }
        return;
      }
      if (!res.ok) {
        setErrorApi([data.error, data.hint].filter(Boolean).join(' — ') || 'Error al crear la vacante');
        return;
      }
      const id = data.id;
      if (!id) {
        setErrorApi('La API no devolvió el id de la vacante.');
        return;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/reclutamiento?need=${id}`;
      setNeedLink(url);
      onCreated?.({ needId: id, reclutamientoUrl: url });
      setPaso(3);
    } catch {
      setErrorApi('Error inesperado al procesar la respuesta del servidor.');
    } finally {
      setAnalizando(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-nueva-vacante-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0A0A0F] p-8 font-sans text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-zinc-500 hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        {paso === 1 && (
          <div className="space-y-6">
            <h2 id="modal-nueva-vacante-title" className="flex items-center gap-2 pr-8 text-xl font-bold">
              <span className="text-orange-500" aria-hidden>
                👷
              </span>
              Abrir nueva vacante
            </h2>
            <p className="text-xs text-zinc-500">
              Proyecto: <span className="text-zinc-300">{analisis.obra.nombre}</span>
            </p>
            <div>
              <label className="text-xs font-bold uppercase text-gray-400">Cargo (tabulador)</label>
              <select
                value={cargoCodigo}
                onChange={(e) => setCargoCodigo(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
              >
                <option value="">Selecciona…</option>
                {CARGOS_OBREROS.map((c) => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.nombre} (nivel {c.nivel})
                  </option>
                ))}
              </select>
            </div>
            {errorApi ? <p className="text-sm text-red-400">{errorApi}</p> : null}
            <button
              type="button"
              onClick={() => void simularValidacionIA()}
              disabled={analizando}
              className="w-full rounded-xl bg-white py-3 font-bold text-black transition-all hover:bg-gray-200 disabled:opacity-50"
            >
              {analizando ? 'Auditando presupuesto…' : 'Siguiente'}
            </button>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-6">
            {alertaPresupuesto ? (
              <div className="flex items-start gap-4 rounded-xl border border-orange-500/50 bg-orange-500/10 p-4">
                <AlertTriangle className="shrink-0 text-orange-500" size={24} aria-hidden />
                <div>
                  <h3 className="font-bold text-orange-500">Alerta de presupuesto</h3>
                  <p className="mt-1 text-sm text-gray-300">{mensajeAlerta}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 text-sm text-emerald-100/95">
                {mensajeAlerta}
              </div>
            )}

            {iaTexto ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-zinc-300">
                <p className="mb-1 font-semibold text-zinc-400">Análisis (referencia)</p>
                {iaTexto}
              </div>
            ) : null}

            {errorApi ? <p className="text-sm text-red-400">{errorApi}</p> : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrorApi(null);
                  setPaso(1);
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 font-bold text-white transition-all hover:bg-white/10"
              >
                Volver
              </button>
              {!alertaPresupuesto ? (
                <button
                  type="button"
                  onClick={() => void ejecutarContratacion(false)}
                  disabled={analizando}
                  className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {analizando ? 'Guardando…' : 'Registrar vacante'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void ejecutarContratacion(true)}
                  disabled={analizando}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 font-bold text-white shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {analizando ? '…' : 'Autorizar y registrar'}
                </button>
              )}
            </div>
          </div>
        )}

        {paso === 3 && needLink && (
          <div className="space-y-6 text-center">
            <CheckCircle className="mx-auto text-green-500" size={48} aria-hidden />
            <h2 className="text-xl font-bold">Vacante registrada</h2>
            <p className="text-sm text-gray-400">
              Enlace para el candidato (entrevista asociada al puesto). Cópialo o envíalo por WhatsApp.
            </p>
            <div className="break-all rounded-xl border border-white/10 bg-white/5 p-4 font-mono text-sm text-orange-400">
              {needLink}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(needLink);
                  } catch {
                    /* ignore */
                  }
                }}
                className="w-full rounded-xl border border-white/15 bg-white/10 py-3 font-bold text-white hover:bg-white/15"
              >
                Copiar enlace
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Hola, este es tu enlace para la entrevista guiada: ${needLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-bold text-white transition-all hover:bg-green-500"
              >
                Abrir WhatsApp <ArrowRight size={18} aria-hidden />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-white/10 py-2 text-sm text-zinc-400 hover:text-white"
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
