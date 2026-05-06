'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { apiUrl } from '@/lib/http/apiUrl';
import { cn } from '@/lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const generarContratoSchema = z.object({
  tipoContrato: z.enum(['tiempo_determinado', 'tiempo_indeterminado']),
  jornadaTrabajo: z.enum(['diurna', 'nocturna', 'mixta']),
  fechaIngreso: z
    .string()
    .min(1, 'Indique la fecha de ingreso')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
});

export type GenerarContratoFormValues = z.infer<typeof generarContratoSchema>;

/** La API exige montos; valores por defecto hasta exponerlos en el formulario. */
const DEFAULT_MONTO_USD = 100;
const DEFAULT_PCT_INICIAL = 0;

export type ModalGenerarContratoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabase: SupabaseClient;
  empleadoId: string | null;
  obraId: string | null;
  nombreObrero?: string | null;
  onExito?: (data: { contratoId: string; portalUrl?: string | null }) => void;
};

function hoyIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const selectDark =
  'w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-white/10 [color-scheme:dark]';

export function ModalGenerarContrato({
  open,
  onOpenChange,
  supabase,
  empleadoId,
  obraId,
  nombreObrero,
  onExito,
}: ModalGenerarContratoProps) {
  const [tipoContrato, setTipoContrato] = useState<'tiempo_determinado' | 'tiempo_indeterminado'>(
    'tiempo_indeterminado',
  );
  const [jornadaTrabajo, setJornadaTrabajo] = useState<'diurna' | 'nocturna' | 'mixta'>('diurna');
  const [fechaIngreso, setFechaIngreso] = useState(() => hoyIsoLocal());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof GenerarContratoFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTipoContrato('tiempo_indeterminado');
      setJornadaTrabajo('diurna');
      setFechaIngreso(hoyIsoLocal());
      setFieldErrors({});
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const parsed = generarContratoSchema.safeParse({ tipoContrato, jornadaTrabajo, fechaIngreso });
    if (!parsed.success) {
      const next: Partial<Record<keyof GenerarContratoFormValues, string>> = {};
      const fe = parsed.error.flatten().fieldErrors;
      if (fe.tipoContrato?.[0]) next.tipoContrato = fe.tipoContrato[0];
      if (fe.jornadaTrabajo?.[0]) next.jornadaTrabajo = fe.jornadaTrabajo[0];
      if (fe.fechaIngreso?.[0]) next.fechaIngreso = fe.fechaIngreso[0];
      setFieldErrors(next);
      return;
    }

    const eid = (empleadoId ?? '').trim();
    const oid = (obraId ?? '').trim();
    if (!eid) {
      toast.error('Falta el expediente del obrero.');
      return;
    }
    if (!oid) {
      toast.error(
        'Este expediente no tiene proyecto u obra vinculada. Asigne proyecto o vacante antes de generar el contrato.',
      );
      return;
    }

    setSubmitting(true);
    const { error: upErr } = await supabase
      .from('ci_empleados')
      .update({ estado: 'aprobado', estatus: 'disponible' } as never)
      .eq('id', eid);

    if (upErr) {
      setSubmitting(false);
      toast.error(upErr.message);
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/talento/contratos/generar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          empleado_id: eid,
          obra_id: oid,
          monto_acordado_usd: DEFAULT_MONTO_USD,
          porcentaje_inicial: DEFAULT_PCT_INICIAL,
          tipo_contrato: parsed.data.tipoContrato,
          jornada_trabajo: parsed.data.jornadaTrabajo,
          fecha_ingreso: parsed.data.fechaIngreso,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        contrato_portal_obrero_url?: string | null;
      };
      if (!res.ok) {
        toast.error(json.error ?? `Error ${res.status}`);
        setSubmitting(false);
        return;
      }
      if (!json.id) {
        toast.error('Respuesta inválida del servidor');
        setSubmitting(false);
        return;
      }
      toast.success('Contrato generado y obrero aprobado.');
      setSubmitting(false);
      onOpenChange(false);
      onExito?.({ contratoId: json.id, portalUrl: json.contrato_portal_obrero_url ?? null });
    } catch {
      setSubmitting(false);
      toast.error('Error de red al generar el contrato');
    }
  }

  const sinObra = !obraId?.trim();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[121] max-h-[min(92vh,640px)] w-[min(100vw-1.5rem,440px)] -translate-x-1/2 -translate-y-1/2',
            'overflow-y-auto rounded-2xl border border-white/10 bg-[#0A0A0F] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)]',
            'focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight text-white">Generar contrato legal</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-zinc-500">
                Elite Black · datos laborales para el alta en{' '}
                <span className="text-zinc-400">ci_contratos_empleado_obra</span>
                {nombreObrero?.trim() ? (
                  <>
                    {' '}
                    · <span className="text-zinc-300">{nombreObrero.trim()}</span>
                  </>
                ) : null}
              </Dialog.Description>
            </div>
            <Dialog.Close
              type="button"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {sinObra ? (
            <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-sm text-amber-100/90">
              No hay <span className="font-semibold">proyecto / obra</span> vinculado a este expediente. Complete la
              vacante o el proyecto del empleado antes de continuar.
            </p>
          ) : null}

          <form onSubmit={(ev) => void handleSubmit(ev)} className="mt-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="tipo-plazo" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Tipo de plazo
              </Label>
              <select
                id="tipo-plazo"
                className={selectDark}
                value={tipoContrato}
                onChange={(ev) =>
                  setTipoContrato(ev.target.value as 'tiempo_determinado' | 'tiempo_indeterminado')
                }
              >
                <option value="tiempo_determinado">Determinado</option>
                <option value="tiempo_indeterminado">Indeterminado</option>
              </select>
              {fieldErrors.tipoContrato ? <p className="text-xs text-red-400">{fieldErrors.tipoContrato}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="jornada" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Jornada de trabajo
              </Label>
              <select
                id="jornada"
                className={selectDark}
                value={jornadaTrabajo}
                onChange={(ev) => setJornadaTrabajo(ev.target.value as 'diurna' | 'nocturna' | 'mixta')}
              >
                <option value="diurna">Diurna (40 h semanales)</option>
                <option value="nocturna">Nocturna (35 h semanales)</option>
                <option value="mixta">Mixta (37,5 h semanales)</option>
              </select>
              {fieldErrors.jornadaTrabajo ? <p className="text-xs text-red-400">{fieldErrors.jornadaTrabajo}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha-ingreso" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Fecha de ingreso
              </Label>
              <input
                id="fecha-ingreso"
                type="date"
                className={selectDark}
                value={fechaIngreso}
                onChange={(ev) => setFechaIngreso(ev.target.value)}
              />
              {fieldErrors.fechaIngreso ? <p className="text-xs text-red-400">{fieldErrors.fechaIngreso}</p> : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-5">
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                disabled={submitting || sinObra}
                className="min-w-[200px] border-0 bg-[#34C759] font-semibold text-black shadow-lg hover:bg-[#2eb050] disabled:opacity-50"
              >
                {submitting ? 'Generando…' : 'Generar contrato legal'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
