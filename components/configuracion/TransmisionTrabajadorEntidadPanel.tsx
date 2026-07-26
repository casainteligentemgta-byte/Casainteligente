'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  etiquetaCategoriaEquipo,
  mapProyectoEquipoRow,
  normalizarCategoriaEquipo,
  PROYECTO_EQUIPO_SELECT_ENTIDAD,
  type ProyectoEquipoRow,
} from '@/lib/proyectos/proyectoEquipos';
import { createClient } from '@/lib/supabase/client';

type Props = {
  entidadId: string;
  entidadNombre?: string;
};

/** Orden de recolección / WhatsApp / sugerencias IA sobre el inventario del patrono. */
export default function TransmisionTrabajadorEntidadPanel({ entidadId, entidadNombre }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [equipos, setEquipos] = useState<ProyectoEquipoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajadorNombre, setTrabajadorNombre] = useState('');
  const [trabajadorTelefono, setTrabajadorTelefono] = useState('');
  const [copiedKit, setCopiedKit] = useState(false);
  const [generandoSugerencias, setGenerandoSugerencias] = useState(false);
  const [sugerenciasIA, setSugerenciasIA] = useState<string | null>(null);
  const [sugerenciasDesdeGemini, setSugerenciasDesdeGemini] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('ci_proyecto_equipos')
      .select(PROYECTO_EQUIPO_SELECT_ENTIDAD)
      .eq('entidad_id', entidadId)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(error.message);
      setEquipos([]);
    } else {
      setEquipos((data ?? []).map((r) => mapProyectoEquipoRow(r as Record<string, unknown>)));
    }
    setCargando(false);
  }, [entidadId, supabase]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const textoKitRecoleccion = useMemo(() => {
    const encabezado = [
      'Orden de recoleccion de herramientas',
      `Patrono: ${entidadNombre?.trim() || 'Entidad'}`,
      trabajadorNombre.trim() ? `Trabajador asignado: ${trabajadorNombre.trim()}` : null,
      '',
      'Lista de inventario a recolectar:',
    ]
      .filter(Boolean)
      .join('\n');

    const items = equipos.length
      ? equipos
          .map((e, idx) => {
            const cat = etiquetaCategoriaEquipo(e.categoria);
            const detalle = [e.marca, e.modelo].filter(Boolean).join(' ');
            let extra = '';
            if (normalizarCategoriaEquipo(e.categoria) === 'maquinaria_alquilada') {
              const partes = [
                e.arrendatario ? `Arrendatario: ${e.arrendatario}` : null,
                e.arrendatario_rif ? `RIF: ${e.arrendatario_rif}` : null,
                e.fecha_arriendo_inicio ? `Desde: ${e.fecha_arriendo_inicio}` : null,
                e.costo_arriendo != null
                  ? `Costo: ${e.moneda_arriendo ?? 'USD'} ${e.costo_arriendo}`
                  : null,
              ].filter(Boolean);
              if (partes.length) extra = ` · ${partes.join(' · ')}`;
            }
            return `${idx + 1}. [${cat}] ${e.nombre_equipo} - Cantidad: ${e.cantidad}${
              detalle ? ` (${detalle})` : ''
            }${e.serial ? ` - Serial: ${e.serial}` : ''}${extra}`;
          })
          .join('\n')
      : 'Sin equipos cargados en el patrono.';

    return `${encabezado}\n${items}\n\nConfirmar disponibilidad y salida de almacen.`;
  }, [entidadNombre, equipos, trabajadorNombre]);

  async function copiarKit() {
    if (!textoKitRecoleccion) return;
    try {
      await navigator.clipboard.writeText(textoKitRecoleccion);
      setCopiedKit(true);
      window.setTimeout(() => setCopiedKit(false), 1800);
    } catch {
      toast.error('No se pudo copiar la orden al portapapeles.');
    }
  }

  const waLink = useMemo(() => {
    const telefono = trabajadorTelefono.replace(/\D+/g, '');
    if (!telefono || !textoKitRecoleccion) return null;
    return `https://wa.me/${telefono}?text=${encodeURIComponent(textoKitRecoleccion)}`;
  }, [trabajadorTelefono, textoKitRecoleccion]);

  async function generarSugerenciasIA() {
    setGenerandoSugerencias(true);
    setSugerenciasIA(null);
    try {
      const res = await fetch('/api/proyectos/sugerir-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto: {
            nombre: entidadNombre?.trim() || 'Patrono',
            ubicacion: '',
            observaciones: 'Inventario de equipos del patrono',
          },
          inventarioActual: equipos.map((e) => ({
            nombre: e.nombre_equipo,
            categoria: normalizarCategoriaEquipo(e.categoria),
            marca: e.marca,
            modelo: e.modelo,
            cantidad: e.cantidad,
            arrendatario: e.arrendatario,
            costo_arriendo: e.costo_arriendo,
          })),
        }),
      });
      const data = (await res.json()) as { texto?: string; desdeGemini?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudieron generar sugerencias.');
        return;
      }
      setSugerenciasIA(data.texto ?? 'Sin contenido.');
      setSugerenciasDesdeGemini(Boolean(data.desdeGemini));
    } catch {
      toast.error('Error de red al consultar sugerencias.');
    } finally {
      setGenerandoSugerencias(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
            Transmisión al trabajador
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Orden de recolección del inventario del patrono (WhatsApp / portapapeles).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase text-zinc-400 hover:bg-white/5"
        >
          Actualizar lista
        </button>
      </div>

      {cargando ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando inventario…
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={trabajadorNombre}
              onChange={(e) => setTrabajadorNombre(e.target.value)}
              placeholder="Nombre del trabajador"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
            />
            <input
              value={trabajadorTelefono}
              onChange={(e) => setTrabajadorTelefono(e.target.value)}
              placeholder="WhatsApp (ej: 58412...)"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-sky-500/40"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copiarKit()}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10"
            >
              {copiedKit ? 'Copiado' : 'Copiar orden de recoleccion'}
            </button>
            <a
              href={waLink ?? '#'}
              target="_blank"
              rel="noreferrer"
              className={`rounded-xl px-3 py-2 text-xs font-semibold text-white ${
                waLink ? 'bg-emerald-600 hover:bg-emerald-500' : 'pointer-events-none bg-zinc-600'
              }`}
            >
              Enviar por WhatsApp
            </a>
            <button
              type="button"
              onClick={() => void generarSugerenciasIA()}
              disabled={generandoSugerencias}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {generandoSugerencias ? 'Analizando...' : 'Sugerir herramientas e insumos (IA)'}
            </button>
          </div>
          <textarea
            value={textoKitRecoleccion}
            readOnly
            rows={7}
            className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300"
          />
          {sugerenciasIA ? (
            <div className="mt-3 rounded-xl border border-indigo-500/25 bg-indigo-950/40 p-3">
              <p className="text-xs font-semibold text-indigo-300">
                Sugerencia inteligente ({sugerenciasDesdeGemini ? 'Gemini' : 'modo local'})
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{sugerenciasIA}</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
