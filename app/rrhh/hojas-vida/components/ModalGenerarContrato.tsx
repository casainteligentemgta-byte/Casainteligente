'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Label } from '@/components/ui/label';
import { apiUrl } from '@/lib/http/apiUrl';
import { cn } from '@/lib/utils';
import type { SupabaseClient } from '@supabase/supabase-js';

const formSchema = z.object({
  fechaIngreso: z
    .string()
    .min(1, 'Indique la fecha de ingreso')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  tipoPlazo: z.enum(['determinado', 'indeterminado']),
  jornada: z.enum(['diurna', 'nocturna', 'mixta']),
});

export type ObreroContratoContext = {
  obrero: {
    id: string;
    nombres: string | null;
    cedula: string | null;
    nacionalidad: string | null;
    direccion_domicilio: string | null;
    cargo_nombre: string | null;
  };
  proyecto: {
    id: string;
    nombre: string | null;
    ubicacion: string | null;
    etapa_actual: string | null;
  } | null;
  entidad: {
    nombre_legal: string | null;
    rif: string | null;
    domicilio_fiscal: string | null;
    representante_legal: string | null;
    cargo_representante: string | null;
    cedula_representante: string | null;
    datos_registro: unknown;
  } | null;
};

export type ModalGenerarContratoProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabase: SupabaseClient;
  /** Alias histórico en RRHH: mismo UUID que `ci_empleados.id`. */
  obreroId: string | null;
  /** Si ya resolviste obra/proyecto fuera del modal (opcional). */
  obraId?: string | null;
  nombreObrero?: string | null;
  onExito?: (data: { contratoMarkdown: string; portalUrl?: string | null }) => void;
};

function hoyIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function resolverProyectoId(
  client: SupabaseClient,
  row: {
    proyecto_modulo_id?: string | null;
    recruitment_need_id?: string | null;
  },
  obraIdHint?: string | null,
): Promise<string | null> {
  const hint = (obraIdHint ?? '').trim();
  if (hint) return hint;
  let pid = (row.proyecto_modulo_id ?? '').trim();
  if (pid) return pid;
  const nid = (row.recruitment_need_id ?? '').trim();
  if (!nid) return null;
  const { data, error } = await client
    .from('recruitment_needs')
    .select('proyecto_modulo_id, proyecto_id')
    .eq('id', nid)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as { proyecto_modulo_id?: string | null; proyecto_id?: string | null };
  return (d.proyecto_modulo_id ?? d.proyecto_id ?? '').trim() || null;
}

async function cargarContextoContrato(client: SupabaseClient, obreroId: string, obraHint: string | null) {
  const { data: emp, error: eEmp } = await client
    .from('ci_empleados')
    .select(
      'id,nombre_completo,nombres,documento,cedula,nacionalidad,direccion_habitacion,domicilio_declarado,cargo_nombre,proyecto_modulo_id,recruitment_need_id',
    )
    .eq('id', obreroId)
    .maybeSingle();

  if (eEmp) throw new Error(eEmp.message);
  if (!emp) throw new Error('Obrero no encontrado');

  const er = emp as {
    id: string;
    nombre_completo?: string | null;
    nombres?: string | null;
    documento?: string | null;
    cedula?: string | null;
    nacionalidad?: string | null;
    direccion_habitacion?: string | null;
    domicilio_declarado?: string | null;
    cargo_nombre?: string | null;
    proyecto_modulo_id?: string | null;
    recruitment_need_id?: string | null;
  };

  const obrero: ObreroContratoContext['obrero'] = {
    id: er.id,
    nombres: er.nombre_completo ?? er.nombres ?? null,
    cedula: er.cedula ?? er.documento ?? null,
    nacionalidad: er.nacionalidad ?? null,
    direccion_domicilio: er.domicilio_declarado ?? er.direccion_habitacion ?? null,
    cargo_nombre: er.cargo_nombre ?? null,
  };

  const proyectoId = await resolverProyectoId(client, er, obraHint);
  let proyecto: ObreroContratoContext['proyecto'] = null;
  let entidad: ObreroContratoContext['entidad'] = null;

  if (proyectoId) {
    const { data: pr, error: ePr } = await client
      .from('ci_proyectos')
      .select('id,nombre,ubicacion_texto,obra_ubicacion,ubicacion,estado,entidad_id')
      .eq('id', proyectoId)
      .maybeSingle();
    if (!ePr && pr) {
      const p = pr as {
        id: string;
        nombre?: string | null;
        ubicacion_texto?: string | null;
        obra_ubicacion?: string | null;
        ubicacion?: string | null;
        estado?: string | null;
        entidad_id?: string | null;
      };
      const ubic =
        [p.obra_ubicacion, p.ubicacion_texto, p.ubicacion].map((s) => String(s ?? '').trim()).find(Boolean) ?? null;
      proyecto = {
        id: p.id,
        nombre: p.nombre ?? null,
        ubicacion: ubic,
        etapa_actual: p.estado ?? null,
      };

      const eid = (p.entidad_id ?? '').trim();
      if (eid) {
        const selFull =
          'id,nombre,nombre_legal,rif,domicilio_fiscal,direccion_fiscal,representante_legal,rep_legal_nombre,rep_legal_cedula,rep_legal_cargo,registro_mercantil';
        let ent = await client.from('ci_entidades').select(selFull).eq('id', eid).maybeSingle();
        if (ent.error) {
          ent = await client
            .from('ci_entidades')
            .select('id,nombre,rif,direccion_fiscal,representante_legal,rep_legal_nombre,rep_legal_cedula,rep_legal_cargo,registro_mercantil')
            .eq('id', eid)
            .maybeSingle();
        }
        if (!ent.error && ent.data) {
          const raw = ent.data as Record<string, unknown>;
          const nombreLegal =
            (typeof raw.nombre_legal === 'string' ? raw.nombre_legal : null) ??
            (typeof raw.nombre === 'string' ? raw.nombre : null);
          const domFiscal =
            (typeof raw.domicilio_fiscal === 'string' ? raw.domicilio_fiscal : null) ??
            (typeof raw.direccion_fiscal === 'string' ? raw.direccion_fiscal : null);
          const repNom =
            (typeof raw.rep_legal_nombre === 'string' ? raw.rep_legal_nombre : null) ??
            (typeof raw.representante_legal === 'string' ? raw.representante_legal : null);
          entidad = {
            nombre_legal: nombreLegal,
            rif: typeof raw.rif === 'string' ? raw.rif : null,
            domicilio_fiscal: domFiscal,
            representante_legal: repNom,
            cargo_representante: typeof raw.rep_legal_cargo === 'string' ? raw.rep_legal_cargo : null,
            cedula_representante: typeof raw.rep_legal_cedula === 'string' ? raw.rep_legal_cedula : null,
            datos_registro: raw.registro_mercantil ?? null,
          };
        }
      }
    }
  }

  return { obrero, proyecto, entidad };
}

const selectDark =
  'w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-white/10 [color-scheme:dark]';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xs leading-snug text-zinc-200">{value || '—'}</p>
    </div>
  );
}

export function ModalGenerarContrato({
  open,
  onOpenChange,
  supabase,
  obreroId,
  obraId,
  nombreObrero,
  onExito,
}: ModalGenerarContratoProps) {
  const oid = (obreroId ?? '').trim();
  const [tipoPlazo, setTipoPlazo] = useState<'determinado' | 'indeterminado'>('indeterminado');
  const [jornada, setJornada] = useState<'diurna' | 'nocturna' | 'mixta'>('diurna');
  const [fechaIngreso, setFechaIngreso] = useState(() => hoyIsoLocal());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'fechaIngreso' | 'tipoPlazo' | 'jornada', string>>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTipoPlazo('indeterminado');
      setJornada('diurna');
      setFechaIngreso(hoyIsoLocal());
      setFieldErrors({});
    }
  }, [open]);

  const ctxQuery = useQuery({
    queryKey: ['rrhh-modal-contrato-context', oid, open, obraId ?? ''],
    queryFn: () => cargarContextoContrato(supabase, oid, obraId ?? null),
    enabled: open && oid.length > 0,
    staleTime: 30_000,
  });

  const sinProyecto = open && oid && ctxQuery.isSuccess && !ctxQuery.data?.proyecto;

  const datosConsolidadosEnvio = useMemo(() => {
    const d = ctxQuery.data;
    if (!d) return null;
    return {
      obrero: d.obrero,
      proyecto: d.proyecto,
      entidad_empleador: d.entidad,
    };
  }, [ctxQuery.data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    const parsed = formSchema.safeParse({ fechaIngreso, tipoPlazo, jornada });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        fechaIngreso: fe.fechaIngreso?.[0],
        tipoPlazo: fe.tipoPlazo?.[0],
        jornada: fe.jornada?.[0],
      });
      return;
    }
    if (!oid) {
      toast.error('Falta el identificador del obrero.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: upErr } = await supabase
        .from('ci_empleados')
        .update({ estado: 'aprobado', estatus: 'disponible' } as never)
        .eq('id', oid);

      if (upErr) {
        toast.error(upErr.message);
        setSubmitting(false);
        return;
      }

      const tipoApi = parsed.data.tipoPlazo === 'determinado' ? 'DETERMINADO' : 'INDETERMINADO';

      const body = {
        empleado_id: oid,
        empleadoId: oid,
        fecha_ingreso: parsed.data.fechaIngreso,
        fechaIngreso: parsed.data.fechaIngreso,
        tipo_plazo: tipoApi,
        tipoPlazo: tipoApi,
        tipo_contrato: tipoApi,
        jornada_trabajo: parsed.data.jornada,
        jornadaTrabajo: parsed.data.jornada,
        datos_consolidados: datosConsolidadosEnvio,
      };

      const res = await fetch(apiUrl('/api/talento/contratos/generar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        contrato?: string;
        error?: string;
      };

      if (!res.ok || !json.success || typeof json.contrato !== 'string') {
        toast.error(json.error ?? `Error ${res.status}`);
        setSubmitting(false);
        return;
      }

      const blob = new Blob([json.contrato], { type: 'text/markdown;charset=utf-8' });
      const portalUrl = URL.createObjectURL(blob);

      toast.success('Contrato generado (markdown). Se abre en una nueva pestaña.');
      setSubmitting(false);
      onOpenChange(false);
      window.open(portalUrl, '_blank', 'noopener,noreferrer');
      onExito?.({ contratoMarkdown: json.contrato, portalUrl });
      setTimeout(() => URL.revokeObjectURL(portalUrl), 180_000);
    } catch {
      toast.error('Error de red al generar el contrato');
      setSubmitting(false);
    }
  }

  const tituloNombre = (nombreObrero ?? '').trim() || ctxQuery.data?.obrero.nombres || 'Obrero';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[121] max-h-[min(92vh,720px)] w-[min(100vw-1.5rem,480px)] -translate-x-1/2 -translate-y-1/2',
            'overflow-y-auto rounded-2xl border border-white/10 bg-[#0A0A0F] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)]',
            'focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight text-white">Generar contrato</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-relaxed text-zinc-500">
                Casa Inteligente · RRHH ·{' '}
                <span className="text-zinc-300">{tituloNombre}</span>
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

          {!oid ? (
            <p className="mt-4 text-sm text-amber-200/90">No hay expediente seleccionado.</p>
          ) : ctxQuery.isLoading ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-2 py-6 text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" aria-hidden />
              <p className="text-sm">Cargando expediente, proyecto y empleador…</p>
            </div>
          ) : ctxQuery.isError ? (
            <p className="mt-4 rounded-xl border border-red-500/25 bg-red-950/20 px-3 py-2 text-sm text-red-200">
              {ctxQuery.error instanceof Error ? ctxQuery.error.message : 'Error al cargar datos'}
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Resumen consolidado</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <InfoRow label="Obrero" value={ctxQuery.data!.obrero.nombres ?? ''} />
                  <InfoRow label="Cédula / doc." value={ctxQuery.data!.obrero.cedula ?? ''} />
                  <InfoRow label="Nacionalidad" value={ctxQuery.data!.obrero.nacionalidad ?? ''} />
                  <InfoRow label="Domicilio declarado" value={ctxQuery.data!.obrero.direccion_domicilio ?? ''} />
                  <InfoRow label="Cargo (tabulador)" value={ctxQuery.data!.obrero.cargo_nombre ?? ''} />
                  <InfoRow label="Proyecto / obra" value={ctxQuery.data!.proyecto?.nombre ?? ''} />
                  <InfoRow label="Ubicación obra" value={ctxQuery.data!.proyecto?.ubicacion ?? ''} />
                  <InfoRow label="Etapa actual" value={ctxQuery.data!.proyecto?.etapa_actual ?? ''} />
                  <InfoRow label="Empleador (nombre legal)" value={ctxQuery.data!.entidad?.nombre_legal ?? ''} />
                  <InfoRow label="RIF" value={ctxQuery.data!.entidad?.rif ?? ''} />
                  <InfoRow label="Domicilio fiscal" value={ctxQuery.data!.entidad?.domicilio_fiscal ?? ''} />
                  <InfoRow label="Representante legal" value={ctxQuery.data!.entidad?.representante_legal ?? ''} />
                  <InfoRow label="Cargo representante" value={ctxQuery.data!.entidad?.cargo_representante ?? ''} />
                  <InfoRow label="C.I. representante" value={ctxQuery.data!.entidad?.cedula_representante ?? ''} />
                </div>
                {ctxQuery.data!.entidad?.datos_registro != null ? (
                  <details className="rounded-lg border border-white/[0.06] bg-black/30 px-2 py-2 text-[11px] text-zinc-400">
                    <summary className="cursor-pointer font-semibold text-zinc-300">Datos registro mercantil (JSON)</summary>
                    <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-zinc-500">
                      {JSON.stringify(ctxQuery.data!.entidad!.datos_registro, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>

              {sinProyecto ? (
                <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-sm text-amber-100/90">
                  Este expediente no tiene <span className="font-semibold">proyecto</span> vinculado (ni vía vacante).
                  La API puede fallar o quedar incompleta; asigne módulo o vacante al candidato.
                </p>
              ) : null}

              <form onSubmit={(ev) => void handleSubmit(ev)} className="mt-5 space-y-5 border-t border-white/10 pt-5">
                <div className="space-y-2">
                  <Label htmlFor="fecha-ingreso-mgc" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Fecha de ingreso
                  </Label>
                  <input
                    id="fecha-ingreso-mgc"
                    type="date"
                    className={selectDark}
                    value={fechaIngreso}
                    onChange={(ev) => setFechaIngreso(ev.target.value)}
                  />
                  {fieldErrors.fechaIngreso ? <p className="text-xs text-red-400">{fieldErrors.fechaIngreso}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo-plazo-mgc" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Tipo de plazo
                  </Label>
                  <select
                    id="tipo-plazo-mgc"
                    className={selectDark}
                    value={tipoPlazo}
                    onChange={(ev) => setTipoPlazo(ev.target.value as 'determinado' | 'indeterminado')}
                  >
                    <option value="determinado">Determinado</option>
                    <option value="indeterminado">Indeterminado</option>
                  </select>
                  {fieldErrors.tipoPlazo ? <p className="text-xs text-red-400">{fieldErrors.tipoPlazo}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jornada-mgc" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Jornada
                  </Label>
                  <select
                    id="jornada-mgc"
                    className={selectDark}
                    value={jornada}
                    onChange={(ev) => setJornada(ev.target.value as 'diurna' | 'nocturna' | 'mixta')}
                  >
                    <option value="diurna">Diurna</option>
                    <option value="nocturna">Nocturna</option>
                    <option value="mixta">Mixta</option>
                  </select>
                  {fieldErrors.jornada ? <p className="text-xs text-red-400">{fieldErrors.jornada}</p> : null}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-5">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-xl border border-white/15 bg-transparent px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={submitting || ctxQuery.isLoading || !ctxQuery.data}
                    className="min-w-[200px] rounded-xl border-0 bg-[#34C759] px-4 py-2.5 text-sm font-semibold text-black shadow-lg transition hover:bg-[#2eb050] disabled:opacity-50"
                  >
                    {submitting ? 'Generando…' : 'Generar contrato'}
                  </button>
                </div>
              </form>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
