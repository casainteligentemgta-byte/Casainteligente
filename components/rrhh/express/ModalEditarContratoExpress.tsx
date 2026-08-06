'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectorFaseTecnicaContrato } from '@/components/rrhh/express/SelectorFaseTecnicaContrato';
import {
  ESTADO_CIVIL_CONTRATO_DEFAULT,
  ESTADOS_CIVILES_CONTRATO,
} from '@/lib/talento/estadosCivilesContrato';

type OficioOpt = { id: string; cargo_nombre: string };

type ContratoEditable = {
  id: string;
  proyecto_id?: string | null;
  config_nomina_id?: string | null;
  obrero_nombre?: string | null;
  obrero_nombres?: string | null;
  obrero_apellidos?: string | null;
  obrero_cedula?: string | null;
  obrero_direccion?: string | null;
  estado_civil?: string | null;
  nacionalidad?: string | null;
  fecha_ingreso?: string | null;
  horario_semanal_texto?: string | null;
  bono_manual_usd?: number | null;
  objeto_contrato?: string | null;
  jornada_trabajo?: string | null;
  obrero_municipio_residencia?: string | null;
  obrero_estado_residencia?: string | null;
  cargo_nombre_snapshot?: string | null;
};

type Props = {
  open: boolean;
  contratoId: string | null;
  onOpenChange: (open: boolean) => void;
  onGuardado?: () => void;
};

const inputClass =
  'w-full rounded-md border border-white/15 bg-black/40 px-2.5 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500/50';

function fechaInputValue(raw: string | null | undefined): string {
  if (!raw) return '';
  const t = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return '';
}

export default function ModalEditarContratoExpress({
  open,
  contratoId,
  onOpenChange,
  onGuardado,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [oficios, setOficios] = useState<OficioOpt[]>([]);
  const [fasesSugeridas, setFasesSugeridas] = useState<string[]>([]);
  const [form, setForm] = useState<ContratoEditable | null>(null);
  const [schemaParcial, setSchemaParcial] = useState(false);

  const cargar = useCallback(async () => {
    if (!contratoId) return;
    setLoading(true);
    try {
      const [ctrRes, ofiRes, fasesRes] = await Promise.all([
        fetch(`/api/talento/contratos-express/${encodeURIComponent(contratoId)}`),
        supabase.from('ci_config_nomina').select('id,cargo_nombre').order('cargo_nombre').limit(500),
        fetch('/api/talento/fases-tecnicas'),
      ]);
      const j = (await ctrRes.json()) as {
        ok?: boolean;
        error?: string;
        contrato?: ContratoEditable;
        schema_parcial?: boolean;
      };
      if (!ctrRes.ok || !j.contrato) {
        toast.error(j.error ?? 'No se pudo cargar el contrato');
        onOpenChange(false);
        return;
      }
      let objeto = (j.contrato.objeto_contrato ?? '').trim();
      if (!objeto && j.contrato.proyecto_id) {
        const { data: proy } = await supabase
          .from('ci_proyectos')
          .select('fase_tecnica_contrato_default')
          .eq('id', j.contrato.proyecto_id)
          .maybeSingle();
        objeto =
          ((proy as { fase_tecnica_contrato_default?: string | null } | null)
            ?.fase_tecnica_contrato_default ?? '').trim();
      }
      setForm({
        ...j.contrato,
        estado_civil: (j.contrato.estado_civil ?? '').trim() || ESTADO_CIVIL_CONTRATO_DEFAULT,
        obrero_direccion: (j.contrato.obrero_direccion ?? '').trim() || 'de este domicilio',
        objeto_contrato: objeto || null,
      });
      setSchemaParcial(Boolean(j.schema_parcial));
      if (!ofiRes.error && ofiRes.data) {
        setOficios(
          (ofiRes.data as { id: string; cargo_nombre?: string | null }[]).map((o) => ({
            id: o.id,
            cargo_nombre: (o.cargo_nombre ?? '').trim() || o.id.slice(0, 8),
          })),
        );
      }
      try {
        const fj = (await fasesRes.json()) as { fases?: { texto?: string }[] };
        const textos = (fj.fases ?? [])
          .map((f) => (f.texto ?? '').trim())
          .filter((t) => t.length >= 2);
        setFasesSugeridas(Array.from(new Set(textos)));
      } catch {
        setFasesSugeridas([]);
      }
    } catch {
      toast.error('Error de red al cargar el contrato');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [contratoId, onOpenChange, supabase]);

  useEffect(() => {
    if (open && contratoId) void cargar();
    if (!open) {
      setForm(null);
      setSchemaParcial(false);
    }
  }, [open, contratoId, cargar]);

  function setField<K extends keyof ContratoEditable>(key: K, value: ContratoEditable[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function guardar() {
    if (!contratoId || !form) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/talento/contratos-express/${encodeURIComponent(contratoId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obrero_nombres: form.obrero_nombres ?? null,
          obrero_apellidos: form.obrero_apellidos ?? null,
          obrero_nombre: form.obrero_nombre ?? null,
          obrero_cedula: form.obrero_cedula ?? null,
          obrero_direccion: form.obrero_direccion ?? null,
          estado_civil: form.estado_civil?.trim() || ESTADO_CIVIL_CONTRATO_DEFAULT,
          nacionalidad: form.nacionalidad ?? null,
          fecha_ingreso: form.fecha_ingreso || null,
          horario_semanal_texto: form.horario_semanal_texto ?? null,
          bono_manual_usd: form.bono_manual_usd ?? 0,
          config_nomina_id: form.config_nomina_id || null,
          objeto_contrato: form.objeto_contrato ?? null,
          jornada_trabajo: form.jornada_trabajo ?? null,
          obrero_municipio_residencia: form.obrero_municipio_residencia ?? null,
          obrero_estado_residencia: form.obrero_estado_residencia ?? null,
          regenerar_pdf: true,
        }),
      });
      const j = (await res.json()) as { error?: string; signed_url?: string | null };
      if (!res.ok) {
        toast.error(j.error ?? 'No se pudo guardar');
        return;
      }
      toast.success('Contrato actualizado y PDF regenerado');
      onGuardado?.();
      onOpenChange(false);
      if (j.signed_url) {
        window.open(j.signed_url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      toast.error('Error de red al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-amber-500/30 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-50">
            <Pencil className="size-4 text-amber-300" aria-hidden />
            Editar datos del contrato
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Corrige los campos que recaudan información. Al guardar se regenera el PDF del contrato
            individual.
          </DialogDescription>
        </DialogHeader>

        {loading || !form ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Cargando…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {schemaParcial ? (
              <p className="sm:col-span-2 rounded-md border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-100/90">
                Algunas columnas nuevas aún no están en la BD. Ejecute{' '}
                <code className="text-amber-50">sql_editor_312_ci_contratos_express_campos_editables.sql</code> y{' '}
                <code className="text-amber-50">sql_editor_313_ci_fases_tecnicas_contrato.sql</code>{' '}
                para editar estado civil, fecha, fase técnica, etc.
              </p>
            ) : null}

            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Nombres
              <input
                className={inputClass}
                value={form.obrero_nombres ?? ''}
                onChange={(e) => setField('obrero_nombres', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Apellidos
              <input
                className={inputClass}
                value={form.obrero_apellidos ?? ''}
                onChange={(e) => setField('obrero_apellidos', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:col-span-2">
              Nombre completo (si no hay nombres/apellidos)
              <input
                className={inputClass}
                value={form.obrero_nombre ?? ''}
                onChange={(e) => setField('obrero_nombre', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Cédula
              <input
                className={inputClass}
                value={form.obrero_cedula ?? ''}
                onChange={(e) => setField('obrero_cedula', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Estado civil
              <select
                className={inputClass}
                value={(() => {
                  const cur = (form.estado_civil ?? '').trim();
                  if (!cur) return ESTADO_CIVIL_CONTRATO_DEFAULT;
                  if ((ESTADOS_CIVILES_CONTRATO as readonly string[]).includes(cur)) return cur;
                  return cur;
                })()}
                onChange={(e) => setField('estado_civil', e.target.value)}
              >
                {ESTADOS_CIVILES_CONTRATO.map((ec) => (
                  <option key={ec} value={ec}>
                    {ec}
                  </option>
                ))}
                {(form.estado_civil ?? '').trim() &&
                !(ESTADOS_CIVILES_CONTRATO as readonly string[]).includes(
                  (form.estado_civil ?? '').trim(),
                ) ? (
                  <option value={(form.estado_civil ?? '').trim()}>
                    {(form.estado_civil ?? '').trim()}
                  </option>
                ) : null}
              </select>
              <span className="block font-normal normal-case tracking-normal text-zinc-600">
                Por defecto Soltero. Elija el que corresponda (incluye formas en femenino).
              </span>
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:col-span-2">
              Domicilio
              <input
                className={inputClass}
                value={form.obrero_direccion ?? ''}
                placeholder="de este domicilio"
                onChange={(e) => setField('obrero_direccion', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Nacionalidad
              <input
                className={inputClass}
                value={form.nacionalidad ?? ''}
                placeholder="venezolano"
                onChange={(e) => setField('nacionalidad', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Fecha de ingreso
              <input
                type="date"
                className={inputClass}
                value={fechaInputValue(form.fecha_ingreso)}
                onChange={(e) => setField('fecha_ingreso', e.target.value || null)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:col-span-2">
              Cargo / oficio (tabulador)
              <select
                className={inputClass}
                value={form.config_nomina_id ?? ''}
                onChange={(e) => setField('config_nomina_id', e.target.value || null)}
              >
                <option value="">{form.cargo_nombre_snapshot || 'Seleccione oficio…'}</option>
                {oficios.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.cargo_nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Bono especial (USD)
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={form.bono_manual_usd ?? 0}
                onChange={(e) => setField('bono_manual_usd', Number(e.target.value) || 0)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Jornada
              <input
                className={inputClass}
                value={form.jornada_trabajo ?? ''}
                placeholder="DIURNA"
                onChange={(e) => setField('jornada_trabajo', e.target.value)}
              />
            </label>
            <div className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:col-span-2">
              Fase técnica / objeto (cláusula PRIMERA)
              <SelectorFaseTecnicaContrato
                value={form.objeto_contrato ?? ''}
                onChange={(v) => setField('objeto_contrato', v)}
                controlClassName={inputClass}
                recientes={fasesSugeridas}
              />
            </div>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:col-span-2">
              Horario semanal (cláusula CUARTA)
              <textarea
                className={`${inputClass} min-h-[4rem]`}
                value={form.horario_semanal_texto ?? ''}
                onChange={(e) => setField('horario_semanal_texto', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Municipio residencia
              <input
                className={inputClass}
                value={form.obrero_municipio_residencia ?? ''}
                onChange={(e) => setField('obrero_municipio_residencia', e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              Estado residencia
              <input
                className={inputClass}
                value={form.obrero_estado_residencia ?? ''}
                onChange={(e) => setField('obrero_estado_residencia', e.target.value)}
              />
            </label>

            <div className="sm:col-span-2 mt-2 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onOpenChange(false)}
                className="border-zinc-600 text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void guardar()}
                className="bg-amber-500 text-black hover:bg-amber-400"
              >
                {saving ? (
                  <RefreshCw className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Pencil className="size-3.5" aria-hidden />
                )}
                <span className="ml-1.5">{saving ? 'Guardando…' : 'Guardar y regenerar PDF'}</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
