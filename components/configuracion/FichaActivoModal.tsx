'use client';

import { Mail, Printer, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  abrirFichaActivoImpresion,
  textoFichaActivo,
  tituloFichaActivo,
  urlEmailFichaActivo,
  urlTelegramFichaActivo,
  urlWhatsAppFichaActivo,
  type FichaActivoDatos,
} from '@/lib/proyectos/fichaActivoPrint';
import { etiquetaCategoriaEquipo } from '@/lib/proyectos/proyectoEquipos';
import { COSTADOS_ACTIVO, ETIQUETA_COSTADO } from '@/lib/proyectos/activoFotosCostados';

type Props = {
  datos: FichaActivoDatos;
  onClose: () => void;
};

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-VE');
}

async function compartirNativo(d: FichaActivoDatos) {
  const texto = textoFichaActivo(d);
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: tituloFichaActivo(d), text: texto });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast.success('Ficha copiada. Péguela en WhatsApp o el correo.');
  } catch {
    window.open(urlWhatsAppFichaActivo(d), '_blank', 'noopener,noreferrer');
  }
}

export default function FichaActivoModal({ datos, onClose }: Props) {
  const tipo = etiquetaCategoriaEquipo(datos.categoria);
  const filas: { label: string; value: string }[] = [
    { label: 'Tipo', value: tipo },
    { label: 'Patrono', value: datos.entidadNombre?.trim() || '—' },
    { label: 'Equipo', value: datos.nombre },
    { label: 'Marca', value: datos.marca?.trim() || '—' },
    { label: 'Modelo', value: datos.modelo?.trim() || '—' },
    { label: 'Serial / placa', value: datos.serial?.trim() || '—' },
    { label: 'Cantidad', value: String(datos.cantidad) },
    { label: 'Ubicación', value: datos.ubicacion?.trim() || 'Sin ubicación' },
    { label: 'Fecha de asignación', value: fmtFecha(datos.fechaAsignacion) },
    { label: 'Notas', value: datos.notas?.trim() || '—' },
  ];

  const imprimir = () => {
    try {
      abrirFichaActivoImpresion(datos);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir la ficha para imprimir');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-activo-titulo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0A0A0F] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{tipo}</p>
            <h2 id="ficha-activo-titulo" className="truncate text-lg font-bold text-white">
              {datos.nombre}
            </h2>
            {datos.entidadNombre ? (
              <p className="truncate text-xs text-zinc-500">{datos.entidadNombre}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar ficha"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <dl className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.03]">
            {filas.map((f) => (
              <div key={f.label} className="grid grid-cols-[38%_1fr] gap-2 px-3 py-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{f.label}</dt>
                <dd className="text-sm text-white">{f.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            Fotos por costado
          </p>
          {datos.fotos.length ? (
            <div className="grid grid-cols-2 gap-2">
              {COSTADOS_ACTIVO.map((lado) => {
                const foto = datos.fotos.find(
                  (f) => f.label === ETIQUETA_COSTADO[lado],
                );
                return (
                  <div
                    key={lado}
                    className="overflow-hidden rounded-xl border border-white/10 bg-black/40"
                  >
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto.url} alt={foto.label} className="h-28 w-full object-cover" />
                    ) : (
                      <div className="flex h-28 items-center justify-center text-[11px] text-zinc-600">
                        Sin foto
                      </div>
                    )}
                    <p className="px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      {ETIQUETA_COSTADO[lado]}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin fotos cargadas.</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-3">
          <button
            type="button"
            onClick={imprimir}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black hover:bg-zinc-200"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir
          </button>
          <button
            type="button"
            onClick={() => void compartirNativo(datos)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-3 py-2.5 text-sm font-bold text-emerald-200 hover:bg-emerald-900/60"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Enviar
          </button>
          <a
            href={urlWhatsAppFichaActivo(datos)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-zinc-200 hover:bg-white/10"
          >
            WhatsApp
          </a>
          <a
            href={urlTelegramFichaActivo(datos)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-zinc-200 hover:bg-white/10"
          >
            Telegram
          </a>
          <a
            href={urlEmailFichaActivo(datos)}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-zinc-300 hover:bg-white/10"
            aria-label="Enviar por correo"
          >
            <Mail className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </div>
  );
}
