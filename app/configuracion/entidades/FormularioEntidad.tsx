'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { Building2, Calendar, FileText, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  formatRifMascara,
  permisologiaDesdeCampos,
  registroMercantilDesdeCampos,
  validarEntidadPatrono,
  vencimientoAlertaNaranja,
} from '@/lib/configuracion/validarEntidadPatrono';
import { uploadEntidadAsset } from '@/lib/supabase/entidad-assets';
import { createClient } from '@/lib/supabase/client';
import type { CiEntidad, PermisologiaCi, RegistroMercantilCi, RepresentanteMercantilCi } from '@/types/ci-entidad';

const inputClass =
  'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40';

const labelClass = 'block text-[10px] font-bold uppercase tracking-wide text-zinc-500';

const tabTriggerClass =
  'flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-zinc-400 transition data-[state=active]:border-[#FF9500]/40 data-[state=active]:bg-[#FF9500]/10 data-[state=active]:text-[#FFD60A]';

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function strField(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === 'string' ? v : '';
}

function newRepRowId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `rep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type RepFormRow = {
  id: string;
  nombre: string;
  cedula: string;
  edad: string;
  estado_civil: string;
  nacionalidad: string;
  cargo: string;
  domicilio: string;
  profesion: string;
};

function emptyRepFormRow(): RepFormRow {
  return {
    id: newRepRowId(),
    nombre: '',
    cedula: '',
    edad: '',
    estado_civil: '',
    nacionalidad: '',
    cargo: '',
    domicilio: '',
    profesion: '',
  };
}

function repFormDesdeMercantil(r: RepresentanteMercantilCi): RepFormRow {
  return {
    id: newRepRowId(),
    nombre: (r.nombre ?? '').trim(),
    cedula: (r.cedula ?? '').trim(),
    edad: (r.edad ?? '').trim(),
    estado_civil: (r.estado_civil ?? '').trim(),
    nacionalidad: (r.nacionalidad ?? '').trim(),
    cargo: (r.cargo ?? '').trim(),
    domicilio: (r.domicilio ?? '').trim(),
    profesion: (r.profesion ?? '').trim(),
  };
}

function parseRepresentantesRm(raw: unknown): RepresentanteMercantilCi[] {
  if (!Array.isArray(raw)) return [];
  const out: RepresentanteMercantilCi[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    out.push({
      nombre: typeof o.nombre === 'string' ? o.nombre : undefined,
      cedula: typeof o.cedula === 'string' ? o.cedula : undefined,
      edad: typeof o.edad === 'string' ? o.edad : undefined,
      estado_civil: typeof o.estado_civil === 'string' ? o.estado_civil : undefined,
      nacionalidad: typeof o.nacionalidad === 'string' ? o.nacionalidad : undefined,
      cargo: typeof o.cargo === 'string' ? o.cargo : undefined,
      domicilio: typeof o.domicilio === 'string' ? o.domicilio : undefined,
      profesion: typeof o.profesion === 'string' ? o.profesion : undefined,
    });
  }
  return out;
}

export type FormularioEntidadProps = {
  open: boolean;
  onClose: () => void;
  /** null = alta; con id = edición (datos actuales de la fila). */
  entidad: CiEntidad | null;
  onGuardado: () => void;
};

export default function FormularioEntidad({ open, onClose, entidad, onGuardado }: FormularioEntidadProps) {
  const supabase = useMemo(() => createClient(), []);
  const esEdicion = Boolean(entidad?.id);

  const [tab, setTab] = useState('datos');
  const [guardando, setGuardando] = useState(false);

  const [nombreLegal, setNombreLegal] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [rif, setRif] = useState('');
  const [direccionFiscal, setDireccionFiscal] = useState('');

  const [repFilas, setRepFilas] = useState<RepFormRow[]>([emptyRepFormRow()]);

  const [rmDomicilioEmpresa, setRmDomicilioEmpresa] = useState('');
  const [rmTomo, setRmTomo] = useState('');
  const [rmNumero, setRmNumero] = useState('');
  const [rmFecha, setRmFecha] = useState('');
  const [rmCirc, setRmCirc] = useState('');

  const [permIvss, setPermIvss] = useState('');
  const [permInces, setPermInces] = useState('');
  const [permSol, setPermSol] = useState('');

  const [logoUrl, setLogoUrl] = useState('');
  const [selloUrl, setSelloUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selloFile, setSelloFile] = useState<File | null>(null);

  const resetDesdeEntidad = useCallback(() => {
    const e = entidad;
    setTab('datos');
    setNombreLegal((e?.nombre ?? '').trim());
    setNombreComercial((e?.nombre_comercial ?? '').trim());
    setRif(formatRifMascara((e?.rif ?? '').trim()));
    setDireccionFiscal((e?.direccion_fiscal ?? '').trim());

    const rm = asRecord(e?.registro_mercantil ?? null);
    setRmDomicilioEmpresa(strField(rm, 'domicilio_empresa'));
    setRmTomo(strField(rm, 'tomo'));
    setRmNumero(strField(rm, 'numero'));
    setRmFecha(strField(rm, 'fecha'));
    setRmCirc(strField(rm, 'circunscripcion'));

    const repsRm = parseRepresentantesRm(rm.representantes);
    if (repsRm.length > 0) {
      setRepFilas(repsRm.map(repFormDesdeMercantil));
    } else {
      const nom = (e?.rep_legal_nombre ?? '').trim();
      const ced = (e?.rep_legal_cedula ?? '').trim();
      const car = (e?.rep_legal_cargo ?? '').trim();
      if (nom || ced || car) {
        setRepFilas([
          {
            id: newRepRowId(),
            nombre: nom,
            cedula: ced,
            edad: '',
            estado_civil: '',
            nacionalidad: '',
            cargo: car,
            domicilio: '',
            profesion: '',
          },
        ]);
      } else {
        setRepFilas([emptyRepFormRow()]);
      }
    }

    const p = asRecord(e?.permisologia ?? null);
    setPermIvss(strField(p, 'ivss_vence'));
    setPermInces(strField(p, 'inces_vence'));
    setPermSol(strField(p, 'solvencia_laboral_vence'));

    setLogoUrl((e?.logo_url ?? '').trim());
    setSelloUrl((e?.sello_url ?? '').trim());
    setLogoFile(null);
    setSelloFile(null);
  }, [entidad]);

  useEffect(() => {
    if (!open) return;
    resetDesdeEntidad();
  }, [open, resetDesdeEntidad]);

  const alertIvss = permIvss.trim() ? vencimientoAlertaNaranja(permIvss.trim()) : false;
  const alertInces = permInces.trim() ? vencimientoAlertaNaranja(permInces.trim()) : false;
  const alertSol = permSol.trim() ? vencimientoAlertaNaranja(permSol.trim()) : false;

  const inputPermClass = (alert: boolean) =>
    `${inputClass} ${alert ? 'border-orange-500/70 ring-1 ring-orange-500/30' : ''}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validarEntidadPatrono({ nombreLegal, rif });
    if (Object.keys(errs).length) {
      if (errs.nombre) toast.error(errs.nombre);
      if (errs.rif) toast.error(errs.rif);
      if (errs.general) toast.error(errs.general);
      setTab('datos');
      return;
    }

    setGuardando(true);
    try {
      const representantesPayload: RepresentanteMercantilCi[] = repFilas.map((row) => ({
        nombre: row.nombre.trim() || undefined,
        cedula: row.cedula.trim() || undefined,
        edad: row.edad.trim() || undefined,
        estado_civil: row.estado_civil.trim() || undefined,
        nacionalidad: row.nacionalidad.trim() || undefined,
        cargo: row.cargo.trim() || undefined,
        domicilio: row.domicilio.trim() || undefined,
        profesion: row.profesion.trim() || undefined,
      }));

      const registroMercantil: RegistroMercantilCi = registroMercantilDesdeCampos({
        domicilioEmpresa: rmDomicilioEmpresa,
        tomo: rmTomo,
        numero: rmNumero,
        fecha: rmFecha,
        circunscripcion: rmCirc,
        representantes: representantesPayload,
      });
      const permisologia: PermisologiaCi = permisologiaDesdeCampos({
        ivss: permIvss,
        inces: permInces,
        solvenciaLaboral: permSol,
      });

      const primera = repFilas[0];
      const repLegalNombre = primera?.nombre.trim() || null;
      const repLegalCedula = primera?.cedula.trim() || null;
      const repLegalCargo = primera?.cargo.trim() || null;

      let id = entidad?.id ?? '';

      const basePayload = {
        nombre: nombreLegal.trim(),
        nombre_comercial: nombreComercial.trim() || null,
        rif: rif.trim() || null,
        direccion_fiscal: direccionFiscal.trim() || null,
        rep_legal_nombre: repLegalNombre,
        rep_legal_cedula: repLegalCedula,
        rep_legal_cargo: repLegalCargo,
        registro_mercantil: registroMercantil,
        permisologia,
        updated_at: new Date().toISOString(),
      };

      if (!esEdicion) {
        const { data: ins, error: insErr } = await supabase
          .from('ci_entidades')
          .insert({
            ...basePayload,
            notas: null,
            logo_url: logoUrl.trim() || null,
            sello_url: selloUrl.trim() || null,
          })
          .select('id')
          .single();
        if (insErr || !ins) {
          toast.error(insErr?.message ?? 'No se pudo crear la entidad.');
          if (
            (insErr?.message ?? '').toLowerCase().includes('column') ||
            (insErr?.message ?? '').includes('schema cache')
          ) {
            toast.info(
              'Ejecuta la migración 064_ci_entidades_patrono_extend.sql en Supabase y recarga el esquema (PostgREST).',
            );
          }
          return;
        }
        id = (ins as { id: string }).id;
      } else {
        const { error: up0 } = await supabase
          .from('ci_entidades')
          .update({
            ...basePayload,
            logo_url: logoUrl.trim() || null,
            sello_url: selloUrl.trim() || null,
          })
          .eq('id', id);
        if (up0) {
          toast.error(up0.message ?? 'No se pudo actualizar.');
          return;
        }
      }

      let nextLogo = logoUrl.trim() || null;
      let nextSello = selloUrl.trim() || null;

      if (logoFile) {
        const up = await uploadEntidadAsset(supabase, id, 'logo', logoFile);
        if (up.error) toast.error(`Logo: ${up.error}`);
        else if (up.publicUrl) nextLogo = up.publicUrl;
      }
      if (selloFile) {
        const up = await uploadEntidadAsset(supabase, id, 'sello', selloFile);
        if (up.error) toast.error(`Sello: ${up.error}`);
        else if (up.publicUrl) nextSello = up.publicUrl;
      }

      if (logoFile || selloFile) {
        const { error: upImg } = await supabase
          .from('ci_entidades')
          .update({
            logo_url: nextLogo,
            sello_url: nextSello,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (upImg) toast.error(upImg.message ?? 'No se pudieron guardar las URLs de imagen.');
      }

      toast.success(esEdicion ? 'Entidad actualizada.' : 'Entidad registrada.');
      onGuardado();
      onClose();
    } finally {
      setGuardando(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-entidad-titulo"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0F] shadow-2xl shadow-black/50"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FF9500]/35 bg-[#FF9500]/10">
              <Building2 className="h-5 w-5 text-[#FFD60A]" aria-hidden />
            </div>
            <div>
              <h2 id="form-entidad-titulo" className="text-lg font-bold tracking-tight text-white">
                {esEdicion ? 'Editar patrono' : 'Nueva entidad legal'}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Datos del patrono para contratos, registro mercantil y planilla de empleo (referencia Gaceta).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="flex max-h-[calc(92vh-5rem)] flex-col">
          <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <Tabs.List className="flex shrink-0 flex-wrap gap-1 border-b border-white/10 bg-white/[0.02] px-3 py-2">
              <Tabs.Trigger value="datos" className={tabTriggerClass}>
                <Building2 className="h-3.5 w-3.5" />
                Datos
              </Tabs.Trigger>
              <Tabs.Trigger value="representante" className={tabTriggerClass}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Representantes
              </Tabs.Trigger>
              <Tabs.Trigger value="mercantil" className={tabTriggerClass}>
                <FileText className="h-3.5 w-3.5" />
                Mercantil
              </Tabs.Trigger>
              <Tabs.Trigger value="permisos" className={tabTriggerClass}>
                <Calendar className="h-3.5 w-3.5" />
                Permisología
              </Tabs.Trigger>
              <Tabs.Trigger value="medios" className={tabTriggerClass}>
                Logo / sello
              </Tabs.Trigger>
            </Tabs.List>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <Tabs.Content value="datos" className="space-y-4 outline-none">
                <div>
                  <label className={labelClass}>Nombre legal *</label>
                  <input
                    required
                    value={nombreLegal}
                    onChange={(e) => setNombreLegal(e.target.value)}
                    className={inputClass}
                    placeholder="Razón social registrada"
                  />
                </div>
                <div>
                  <label className={labelClass}>Nombre comercial</label>
                  <input
                    value={nombreComercial}
                    onChange={(e) => setNombreComercial(e.target.value)}
                    className={inputClass}
                    placeholder="Marca o nombre de fantasía"
                  />
                </div>
                <div>
                  <label className={labelClass}>RIF (J-00000000-0)</label>
                  <input
                    value={rif}
                    onChange={(e) => setRif(formatRifMascara(e.target.value))}
                    className={inputClass}
                    placeholder="J-12345678-9"
                    inputMode="text"
                  />
                </div>
                <div>
                  <label className={labelClass}>Dirección fiscal</label>
                  <textarea
                    value={direccionFiscal}
                    onChange={(e) => setDireccionFiscal(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-y`}
                    placeholder="Sede, ciudad, estado"
                  />
                </div>
              </Tabs.Content>

              <Tabs.Content value="representante" className="space-y-5 outline-none">
                <p className="text-xs text-zinc-500">
                  Deben figurar en la planilla de empleo (referencia Gaceta): nombre y apellido, C.I., edad, estado
                  civil, cargo, nacionalidad y domicilio del representante. Varios representantes: el primero alimenta{' '}
                  <code className="text-zinc-400">rep_legal_*</code> y la planilla usa ese mismo orden.
                </p>
                {repFilas.map((row, idx) => (
                  <div
                    key={row.id}
                    className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#FFD60A]/80">
                        Representante {idx + 1}
                      </span>
                      {repFilas.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRepFilas((prev) => prev.filter((r) => r.id !== row.id))
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-950/30 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-950/45"
                        >
                          <Trash2 className="h-3 w-3" />
                          Quitar
                        </button>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>Nombre completo</label>
                      <input
                        value={row.nombre}
                        onChange={(e) =>
                          setRepFilas((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, nombre: e.target.value } : r)),
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className={labelClass}>Cédula</label>
                        <input
                          value={row.cedula}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, cedula: e.target.value } : r)),
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Edad (años)</label>
                        <input
                          value={row.edad}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, edad: e.target.value } : r)),
                            )
                          }
                          className={inputClass}
                          inputMode="numeric"
                          placeholder="Ej. 42"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Nacionalidad</label>
                        <input
                          value={row.nacionalidad}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, nacionalidad: e.target.value } : r)),
                            )
                          }
                          className={inputClass}
                          placeholder="Ej. venezolana"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Estado civil</label>
                        <input
                          value={row.estado_civil}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, estado_civil: e.target.value } : r)),
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Profesión</label>
                        <input
                          value={row.profesion}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, profesion: e.target.value } : r)),
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Cargo</label>
                      <input
                        value={row.cargo}
                        onChange={(e) =>
                          setRepFilas((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, cargo: e.target.value } : r)),
                          )
                        }
                        className={inputClass}
                        placeholder="Ej. Presidente, Gerente general"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Domicilio</label>
                      <textarea
                        value={row.domicilio}
                        onChange={(e) =>
                          setRepFilas((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, domicilio: e.target.value } : r)),
                          )
                        }
                        rows={2}
                        className={`${inputClass} resize-y`}
                        placeholder="Urbanización, calle, ciudad"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setRepFilas((prev) => [...prev, emptyRepFormRow()])}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] py-2.5 text-xs font-semibold text-zinc-400 transition hover:border-[#FF9500]/40 hover:text-[#FFD60A]"
                >
                  <Plus className="h-4 w-4" />
                  Añadir otro representante
                </button>
              </Tabs.Content>

              <Tabs.Content value="mercantil" className="space-y-4 outline-none">
                <p className="text-xs text-zinc-500">
                  Objeto <code className="text-zinc-400">registro_mercantil</code>. El domicilio de la empresa aquí
                  es el que se imprime en la planilla de empleo; si queda vacío, se usa la dirección fiscal (pestaña
                  Datos).
                </p>
                <div>
                  <label className={labelClass}>Domicilio de la empresa (según registro)</label>
                  <textarea
                    value={rmDomicilioEmpresa}
                    onChange={(e) => setRmDomicilioEmpresa(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-y`}
                    placeholder="Coincide o amplía la dirección fiscal consta en el Registro Mercantil"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Registro Mercantil / circunscripción (donde está inscrita)</label>
                    <input
                      value={rmCirc}
                      onChange={(e) => setRmCirc(e.target.value)}
                      className={inputClass}
                      placeholder="Ej. Primera Circunscripción del estado Miranda"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Tomo</label>
                    <input value={rmTomo} onChange={(e) => setRmTomo(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Número</label>
                    <input value={rmNumero} onChange={(e) => setRmNumero(e.target.value)} className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Fecha de inscripción</label>
                    <input
                      type="date"
                      value={rmFecha}
                      onChange={(e) => setRmFecha(e.target.value)}
                      className={inputClass}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </Tabs.Content>

              <Tabs.Content value="permisos" className="space-y-4 outline-none">
                <p className="text-xs text-zinc-500">
                  Fechas de vencimiento (YYYY-MM-DD). Si faltan menos de 30 días, el campo se resalta en naranja.
                </p>
                <div>
                  <label className={labelClass}>IVSS — vence</label>
                  <input
                    type="date"
                    value={permIvss}
                    onChange={(e) => setPermIvss(e.target.value)}
                    className={inputPermClass(alertIvss)}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className={labelClass}>INCES — vence</label>
                  <input
                    type="date"
                    value={permInces}
                    onChange={(e) => setPermInces(e.target.value)}
                    className={inputPermClass(alertInces)}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className={labelClass}>Solvencia laboral — vence</label>
                  <input
                    type="date"
                    value={permSol}
                    onChange={(e) => setPermSol(e.target.value)}
                    className={inputPermClass(alertSol)}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </Tabs.Content>

              <Tabs.Content value="medios" className="space-y-5 outline-none">
                <p className="text-xs text-zinc-500">
                  Sube archivo (Storage público) o pega URL absoluta (https://…). Si eliges archivo, prevalece sobre la
                  URL al guardar.
                </p>
                <div>
                  <label className={labelClass}>Logo — URL</label>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className={inputClass}
                    placeholder="https://…"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-2 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sello — URL</label>
                  <input
                    value={selloUrl}
                    onChange={(e) => setSelloUrl(e.target.value)}
                    className={inputClass}
                    placeholder="https://…"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-2 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200"
                    onChange={(e) => setSelloFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </Tabs.Content>
            </div>
          </Tabs.Root>

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/10 bg-white/[0.02] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-900/30 hover:opacity-95 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
