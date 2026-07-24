'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Wand2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ETIQUETA_DIA_CORTA,
  type DiaObraCodigo,
  type FranjaHorarioObra,
  ORDEN_DIAS_OBRA,
  franjasHorarioObraATexto,
  franjasHorarioPorDefecto,
} from '@/lib/proyectos/horarioObraFranjaTexto';

export type HorarioObraEditorProps = {
  value: string;
  onChange: (next: string) => void;
};

function nuevaFranja(): FranjaHorarioObra {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `f-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, dias: [], inicio: '07:00', fin: '17:00' };
}

export default function HorarioObraEditor({ value, onChange }: HorarioObraEditorProps) {
  const [modo, setModo] = useState<'constructor' | 'texto'>(() => (!value.trim() ? 'constructor' : 'texto'));
  const [franjas, setFranjas] = useState<FranjaHorarioObra[]>(() => franjasHorarioPorDefecto());
  const [textoLibre, setTextoLibre] = useState(value);

  const textoGenerado = useMemo(() => franjasHorarioObraATexto(franjas), [franjas]);

  /** Solo en modo texto: si el padre refresca (p. ej. tras guardar), alinear el textarea. */
  useEffect(() => {
    if (modo === 'texto') setTextoLibre(value);
  }, [value, modo]);

  useEffect(() => {
    if (modo === 'constructor') {
      onChange(textoGenerado);
    }
  }, [modo, textoGenerado, onChange]);

  function toggleDia(franjaId: string, dia: DiaObraCodigo) {
    setFranjas((prev) =>
      prev.map((f) => {
        if (f.id !== franjaId) return f;
        const set = new Set(f.dias);
        if (set.has(dia)) set.delete(dia);
        else set.add(dia);
        const dias = ORDEN_DIAS_OBRA.filter((d) => set.has(d));
        return { ...f, dias };
      }),
    );
  }

  function actualizarFranja(id: string, patch: Partial<Pick<FranjaHorarioObra, 'inicio' | 'fin'>>) {
    setFranjas((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function agregarFranja() {
    setFranjas((prev) => [...prev, nuevaFranja()]);
  }

  function quitarFranja(id: string) {
    setFranjas((prev) => (prev.length <= 1 ? prev : prev.filter((f) => f.id !== id)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1.5">
        <button
          type="button"
          onClick={() => setModo('constructor')}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
            modo === 'constructor'
              ? 'bg-gradient-to-r from-sky-500/30 to-fuchsia-500/25 text-white shadow-[0_0_20px_rgba(56,189,248,0.15)]'
              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
          )}
        >
          <Wand2 className="h-3.5 w-3.5 opacity-90" aria-hidden />
          Constructor
        </button>
        <button
          type="button"
          onClick={() => {
            setTextoLibre(textoGenerado || value);
            setModo('texto');
            onChange((textoGenerado || value).trim());
          }}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
            modo === 'texto'
              ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-white shadow-[0_0_20px_rgba(52,211,153,0.12)]'
              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
          )}
        >
          <FileText className="h-3.5 w-3.5 opacity-90" aria-hidden />
          Texto libre
        </button>
      </div>

      {modo === 'constructor' ? (
        <div className="space-y-4">
          {franjas.map((f, idx) => (
            <div
              key={f.id}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-950/95 to-zinc-900/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-500/10 blur-2xl" aria-hidden />
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/80">
                  Franja {idx + 1}
                </span>
                {franjas.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => quitarFranja(f.id)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-950/50 hover:text-red-300"
                    title="Quitar franja"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>

              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Días</p>
              <div className="flex flex-wrap gap-1.5">
                {ORDEN_DIAS_OBRA.map((dia) => {
                  const on = f.dias.includes(dia);
                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => toggleDia(f.id, dia)}
                      title={dia}
                      className={cn(
                        'flex h-10 min-w-[2.25rem] items-center justify-center rounded-xl border text-xs font-bold transition',
                        on
                          ? 'border-sky-400/60 bg-sky-500/20 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                          : 'border-white/10 bg-white/[0.04] text-zinc-500 hover:border-white/20 hover:text-zinc-300',
                      )}
                    >
                      {ETIQUETA_DIA_CORTA[dia]}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Inicio</span>
                  <input
                    type="time"
                    value={f.inicio}
                    onChange={(e) => actualizarFranja(f.id, { inicio: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40"
                    style={{ colorScheme: 'dark' }}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Culminación</span>
                  <input
                    type="time"
                    value={f.fin}
                    onChange={(e) => actualizarFranja(f.id, { fin: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40"
                    style={{ colorScheme: 'dark' }}
                  />
                </label>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/10"
              onClick={agregarFranja}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Otra franja (otro horario u otros días)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/10"
              onClick={() => setFranjas(franjasHorarioPorDefecto())}
            >
              Restablecer ejemplo
            </Button>
          </div>

          <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/20 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-300/90">Vista previa (contrato)</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-200">{textoGenerado || '— Selecciona al menos un día.'}</p>
          </div>
        </div>
      ) : (
        <div>
          <textarea
            value={textoLibre}
            onChange={(e) => {
              const t = e.target.value;
              setTextoLibre(t);
              onChange(t);
            }}
            rows={3}
            placeholder="Pega o redacta el horario completo…"
            className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-500/40"
          />
          <p className="mt-2 text-[11px] text-zinc-500">
            Al volver a <strong className="text-zinc-400">Constructor</strong> se generará texto nuevo desde las franjas
            (puedes copiar este texto antes si lo necesitas).
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 border-sky-500/30 text-sky-200 hover:bg-sky-950/40"
            onClick={() => {
              setModo('constructor');
              setFranjas(franjasHorarioPorDefecto());
            }}
          >
            Volver al constructor
          </Button>
        </div>
      )}
    </div>
  );
}
