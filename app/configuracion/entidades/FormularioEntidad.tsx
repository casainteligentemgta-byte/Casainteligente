'use client';

import * as Tabs from '@radix-ui/react-tabs';
import {
  Building2,
  Calendar,
  FileText,
  ImageIcon,
  Plus,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import EquipoEntidadPanel from '@/components/configuracion/EquipoEntidadPanel';
import MaquinariaPropiaEntidadPanel from '@/components/configuracion/MaquinariaPropiaEntidadPanel';
import {
  edadDesdeFechaNacimiento,
  esCedulaVenezolana,
  letraCedula,
  nacionalidadDesdeCedula,
} from '@/lib/configuracion/representanteCedula';
import {
  formatRifMascara,
  permisologiaDesdeCampos,
  registroMercantilDesdeCampos,
  validarEntidadPatrono,
  vencimientoAlertaNaranja,
} from '@/lib/configuracion/validarEntidadPatrono';
import { apiUrl } from '@/lib/http/apiUrl';
import { uploadEntidadAsset } from '@/lib/supabase/entidad-assets';
import { createClient } from '@/lib/supabase/client';
import type { CiEntidad, PermisologiaCi, RegistroMercantilCi, RepresentanteMercantilCi } from '@/types/ci-entidad';

const inputClass =
  'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40';

const labelClass = 'block text-[10px] font-bold uppercase tracking-wide text-zinc-500';

type SeccionPatronoId =
  | 'datos'
  | 'representante'
  | 'mercantil'
  | 'permisos'
  | 'medios'
  | 'equipo'
  | 'maquinaria';

type SeccionPatronoItem = {
  id: SeccionPatronoId;
  label: string;
  icon: LucideIcon;
  soloEdicion?: boolean;
};

/** Submenús del modal «Ficha del patrono». */
const SECCIONES_PATRONO: SeccionPatronoItem[] = [
  { id: 'datos', label: 'Datos', icon: Building2 },
  { id: 'representante', label: 'Representantes', icon: ShieldCheck },
  { id: 'mercantil', label: 'Mercantil', icon: FileText },
  { id: 'permisos', label: 'Permisología', icon: Calendar },
  { id: 'medios', label: 'Logo / sello', icon: ImageIcon },
  { id: 'equipo', label: 'Equipo', icon: Users, soloEdicion: true },
  { id: 'maquinaria', label: 'Maquinaria', icon: Truck, soloEdicion: true },
];

const LABEL_SECCION: Record<SeccionPatronoId, string> = {
  datos: 'Datos',
  representante: 'Representantes',
  mercantil: 'Mercantil',
  permisos: 'Permisología',
  medios: 'Logo / sello',
  equipo: 'Equipo',
  maquinaria: 'Maquinaria',
};

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
  /** ISO YYYY-MM-DD */
  fecha_nacimiento: string;
  estado_civil: string;
  /** Solo si la cédula no es V (extranjero u otro). */
  nacionalidadOtro: string;
  municipio_residencia: string;
  estado_residencia: string;
  cargo: string;
  domicilio: string;
  profesion: string;
  /** Tratamiento ante el nombre: Sr. (M) / Sra. (F); también alimenta la comparecencia del contrato. */
  genero: 'M' | 'F';
};

function emptyRepFormRow(): RepFormRow {
  return {
    id: newRepRowId(),
    nombre: '',
    cedula: '',
    fecha_nacimiento: '',
    estado_civil: '',
    nacionalidadOtro: '',
    municipio_residencia: '',
    estado_residencia: '',
    cargo: '',
    domicilio: '',
    profesion: '',
    genero: 'M',
  };
}

function repFormDesdeMercantil(r: RepresentanteMercantilCi): RepFormRow {
  const cedula = (r.cedula ?? '').trim();
  const nat = (r.nacionalidad ?? '').trim();
  const esVen = esCedulaVenezolana(cedula) || (!cedula && (!nat || /^venezol/i.test(nat)));
  return {
    id: newRepRowId(),
    nombre: (r.nombre ?? '').trim(),
    cedula,
    fecha_nacimiento: (r.fecha_nacimiento ?? '').trim().slice(0, 10),
    estado_civil: (r.estado_civil ?? '').trim(),
    nacionalidadOtro: esVen ? '' : nat,
    municipio_residencia: (r.municipio_residencia ?? '').trim(),
    estado_residencia: (r.estado_residencia ?? '').trim(),
    cargo: (r.cargo ?? '').trim(),
    domicilio: (r.domicilio ?? '').trim(),
    profesion: (r.profesion ?? '').trim(),
    genero: r.genero === 'F' ? 'F' : 'M',
  };
}

function parseRepresentantesRm(raw: unknown): RepresentanteMercantilCi[] {
  if (!Array.isArray(raw)) return [];
  const out: RepresentanteMercantilCi[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const gRaw = o.genero ?? o.sexo;
    let genero: 'M' | 'F' = 'M';
    if (typeof gRaw === 'string') {
      const t = gRaw.trim().toUpperCase();
      if (t === 'F' || t === 'FEMENINO' || t === 'FEMENINA') genero = 'F';
    }
    out.push({
      nombre: typeof o.nombre === 'string' ? o.nombre : undefined,
      cedula: typeof o.cedula === 'string' ? o.cedula : undefined,
      fecha_nacimiento: typeof o.fecha_nacimiento === 'string' ? o.fecha_nacimiento : undefined,
      edad: typeof o.edad === 'string' ? o.edad : undefined,
      estado_civil: typeof o.estado_civil === 'string' ? o.estado_civil : undefined,
      nacionalidad: typeof o.nacionalidad === 'string' ? o.nacionalidad : undefined,
      cargo: typeof o.cargo === 'string' ? o.cargo : undefined,
      domicilio: typeof o.domicilio === 'string' ? o.domicilio : undefined,
      municipio_residencia: typeof o.municipio_residencia === 'string' ? o.municipio_residencia : undefined,
      estado_residencia: typeof o.estado_residencia === 'string' ? o.estado_residencia : undefined,
      profesion: typeof o.profesion === 'string' ? o.profesion : undefined,
      genero,
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

  const [tab, setTab] = useState<SeccionPatronoId>('datos');
  /** false = solo lista de submenús; true = contenido de la sección elegida. */
  const [enSeccion, setEnSeccion] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [nombreLegal, setNombreLegal] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [rif, setRif] = useState('');
  const [direccionFiscal, setDireccionFiscal] = useState('');

  const [repFilas, setRepFilas] = useState<RepFormRow[]>([emptyRepFormRow()]);

  const [rmDomicilioEmpresa, setRmDomicilioEmpresa] = useState('');
  const [rmEstadoRegistro, setRmEstadoRegistro] = useState('');
  const [rmMunicipioRegistro, setRmMunicipioRegistro] = useState('');
  const [rmSectorRegistro, setRmSectorRegistro] = useState('');
  const [rmTomo, setRmTomo] = useState('');
  const [rmNumero, setRmNumero] = useState('');
  const [rmFecha, setRmFecha] = useState('');
  const [rmCirc, setRmCirc] = useState('');

  const [permIvss, setPermIvss] = useState('');
  const [permInces, setPermInces] = useState('');
  const [permSol, setPermSol] = useState('');
  const [permIvssDocUrl, setPermIvssDocUrl] = useState('');
  const [permIncesDocUrl, setPermIncesDocUrl] = useState('');
  const [permSolDocUrl, setPermSolDocUrl] = useState('');
  const [permIvssFile, setPermIvssFile] = useState<File | null>(null);
  const [permIncesFile, setPermIncesFile] = useState<File | null>(null);
  const [permSolFile, setPermSolFile] = useState<File | null>(null);

  const [logoUrl, setLogoUrl] = useState('');
  const [selloUrl, setSelloUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [selloFile, setSelloFile] = useState<File | null>(null);

  /** Actas ya guardadas (URL pública). */
  const [rmActas, setRmActas] = useState<{ url: string; nombre?: string }[]>([]);
  /** Archivos de actas pendientes de subir al guardar. */
  const [actaFilesPendientes, setActaFilesPendientes] = useState<File[]>([]);
  const [rmRifDocUrl, setRmRifDocUrl] = useState('');
  const [rifDocFile, setRifDocFile] = useState<File | null>(null);

  const resetDesdeEntidad = useCallback(() => {
    const e = entidad;
    setTab('datos');
    setEnSeccion(false);
    setNombreLegal((e?.nombre ?? '').trim());
    setNombreComercial((e?.nombre_comercial ?? '').trim());
    setRif(formatRifMascara((e?.rif ?? '').trim()));
    setDireccionFiscal((e?.direccion_fiscal ?? '').trim());

    const rm = asRecord(e?.registro_mercantil ?? null);
    setRmDomicilioEmpresa(strField(rm, 'domicilio_empresa'));
    setRmEstadoRegistro(strField(rm, 'domicilio_estado_registro'));
    setRmMunicipioRegistro(strField(rm, 'domicilio_municipio_registro'));
    setRmSectorRegistro(strField(rm, 'domicilio_sector_registro'));
    setRmTomo(strField(rm, 'tomo'));
    setRmNumero(strField(rm, 'numero'));
    setRmFecha(strField(rm, 'fecha'));
    setRmCirc(strField(rm, 'circunscripcion'));

    const actasRaw = rm.actas;
    if (Array.isArray(actasRaw)) {
      setRmActas(
        actasRaw
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const o = item as Record<string, unknown>;
            const url = typeof o.url === 'string' ? o.url.trim() : '';
            if (!url) return null;
            const nombre = typeof o.nombre === 'string' ? o.nombre.trim() : '';
            return { url, nombre: nombre || undefined };
          })
          .filter((x): x is { url: string; nombre?: string } => Boolean(x)),
      );
    } else {
      setRmActas([]);
    }
    setRmRifDocUrl(strField(rm, 'rif_documento_url'));
    setActaFilesPendientes([]);
    setRifDocFile(null);

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
            fecha_nacimiento: '',
            estado_civil: '',
            nacionalidadOtro: '',
            municipio_residencia: '',
            estado_residencia: '',
            cargo: car,
            domicilio: '',
            profesion: '',
            genero: 'M',
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
    setPermIvssDocUrl(strField(p, 'ivss_documento_url'));
    setPermIncesDocUrl(strField(p, 'inces_documento_url'));
    setPermSolDocUrl(strField(p, 'solvencia_laboral_documento_url'));
    setPermIvssFile(null);
    setPermIncesFile(null);
    setPermSolFile(null);

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

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (tab === 'equipo' || tab === 'maquinaria') return;
    const errs = validarEntidadPatrono({ nombreLegal, rif });
    if (Object.keys(errs).length) {
      if (errs.nombre) toast.error(errs.nombre);
      if (errs.rif) toast.error(errs.rif);
      if (errs.general) toast.error(errs.general);
      setTab('datos');
      setEnSeccion(true);
      return;
    }

    setGuardando(true);
    try {
      const representantesPayload: RepresentanteMercantilCi[] = repFilas.map((row) => {
        const cedula = row.cedula.trim();
        const fechaNac = row.fecha_nacimiento.trim().slice(0, 10);
        const nacionalidadAuto = nacionalidadDesdeCedula(cedula);
        const nacionalidad =
          nacionalidadAuto ??
          (row.nacionalidadOtro.trim() || undefined);
        const edad =
          edadDesdeFechaNacimiento(fechaNac) || undefined;
        return {
          nombre: row.nombre.trim() || undefined,
          cedula: cedula || undefined,
          fecha_nacimiento: fechaNac || undefined,
          edad,
          estado_civil: row.estado_civil.trim() || undefined,
          nacionalidad,
          cargo: row.cargo.trim() || undefined,
          domicilio: row.domicilio.trim() || undefined,
          municipio_residencia: row.municipio_residencia.trim() || undefined,
          estado_residencia: row.estado_residencia.trim() || undefined,
          profesion: row.profesion.trim() || undefined,
          genero: row.genero,
        };
      });

      let actasGuardadas = [...rmActas];
      let rifDocUrl = rmRifDocUrl.trim();

      const buildRegistro = (
        actas: { url: string; nombre?: string }[],
        rifUrl: string,
      ): RegistroMercantilCi =>
        registroMercantilDesdeCampos({
          domicilioEmpresa: rmDomicilioEmpresa,
          domicilioEstadoRegistro: rmEstadoRegistro,
          domicilioMunicipioRegistro: rmMunicipioRegistro,
          domicilioSectorRegistro: rmSectorRegistro,
          tomo: rmTomo,
          numero: rmNumero,
          fecha: rmFecha,
          circunscripcion: rmCirc,
          representantes: representantesPayload,
          actas,
          rifDocumentoUrl: rifUrl,
        });

      let registroMercantil = buildRegistro(actasGuardadas, rifDocUrl);
      let ivssDocUrl = permIvssDocUrl.trim();
      let incesDocUrl = permIncesDocUrl.trim();
      let solDocUrl = permSolDocUrl.trim();

      const buildPermisologia = (
        ivssUrl: string,
        incesUrl: string,
        solUrl: string,
      ): PermisologiaCi =>
        permisologiaDesdeCampos({
          ivss: permIvss,
          inces: permInces,
          solvenciaLaboral: permSol,
          ivssDocumentoUrl: ivssUrl,
          incesDocumentoUrl: incesUrl,
          solvenciaDocumentoUrl: solUrl,
        });

      let permisologia = buildPermisologia(ivssDocUrl, incesDocUrl, solDocUrl);

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
      let docsChanged = false;
      let permDocsChanged = false;

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

      for (const file of actaFilesPendientes) {
        const up = await uploadEntidadAsset(supabase, id, 'acta', file);
        if (up.error) toast.error(`Acta «${file.name}»: ${up.error}`);
        else if (up.publicUrl) {
          actasGuardadas = [...actasGuardadas, { url: up.publicUrl, nombre: file.name }];
          docsChanged = true;
        }
      }
      if (rifDocFile) {
        const up = await uploadEntidadAsset(supabase, id, 'rif', rifDocFile);
        if (up.error) toast.error(`RIF: ${up.error}`);
        else if (up.publicUrl) {
          rifDocUrl = up.publicUrl;
          docsChanged = true;
        }
      }

      if (permIvssFile) {
        const up = await uploadEntidadAsset(supabase, id, 'permiso-ivss', permIvssFile);
        if (up.error) toast.error(`IVSS: ${up.error}`);
        else if (up.publicUrl) {
          ivssDocUrl = up.publicUrl;
          permDocsChanged = true;
        }
      }
      if (permIncesFile) {
        const up = await uploadEntidadAsset(supabase, id, 'permiso-inces', permIncesFile);
        if (up.error) toast.error(`INCES: ${up.error}`);
        else if (up.publicUrl) {
          incesDocUrl = up.publicUrl;
          permDocsChanged = true;
        }
      }
      if (permSolFile) {
        const up = await uploadEntidadAsset(supabase, id, 'permiso-solvencia', permSolFile);
        if (up.error) toast.error(`Solvencia: ${up.error}`);
        else if (up.publicUrl) {
          solDocUrl = up.publicUrl;
          permDocsChanged = true;
        }
      }

      if (docsChanged) {
        registroMercantil = buildRegistro(actasGuardadas, rifDocUrl);
        setRmActas(actasGuardadas);
        setRmRifDocUrl(rifDocUrl);
        setActaFilesPendientes([]);
        setRifDocFile(null);
      }
      if (permDocsChanged) {
        permisologia = buildPermisologia(ivssDocUrl, incesDocUrl, solDocUrl);
        setPermIvssDocUrl(ivssDocUrl);
        setPermIncesDocUrl(incesDocUrl);
        setPermSolDocUrl(solDocUrl);
        setPermIvssFile(null);
        setPermIncesFile(null);
        setPermSolFile(null);
      }

      if (logoFile || selloFile || docsChanged || permDocsChanged) {
        const { error: upImg } = await supabase
          .from('ci_entidades')
          .update({
            logo_url: nextLogo,
            sello_url: nextSello,
            ...(docsChanged ? { registro_mercantil: registroMercantil } : {}),
            ...(permDocsChanged ? { permisologia } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (upImg) toast.error(upImg.message ?? 'No se pudieron guardar archivos o URLs.');
      }

      toast.success(
        esEdicion
          ? 'Entidad actualizada.'
          : 'Entidad registrada. Se creó su catálogo de materiales (vacío).',
      );

      // Avisa a Telegram / Departamento Legal si hay vencimientos en ventana.
      if (id && (permIvss.trim() || permInces.trim() || permSol.trim())) {
        void fetch(apiUrl('/api/configuracion/entidades/permisologia/notificar'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entidadId: id }),
        }).catch(() => {
          /* no bloquear el guardado */
        });
      }

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
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (enSeccion) setEnSeccion(false);
                else onClose();
              }}
              aria-label={enSeccion ? 'Volver a submenús' : 'Salir'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF9500]/35 bg-[#FF9500]/10 transition hover:bg-[#FF9500]/20"
            >
              <Building2 className="h-5 w-5 text-[#FFD60A]" aria-hidden />
            </button>
            <div className="min-w-0">
              <h2 id="form-entidad-titulo" className="truncate text-lg font-bold tracking-tight text-white">
                {enSeccion
                  ? LABEL_SECCION[tab]
                  : esEdicion
                    ? 'Ficha del patrono'
                    : 'Nueva entidad'}
              </h2>
              {enSeccion && esEdicion && entidad?.nombre ? (
                <p className="truncate text-[11px] text-zinc-500">{entidad.nombre}</p>
              ) : null}
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

        <div className="flex max-h-[calc(92vh-5rem)] flex-col">
          {!enSeccion ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SECCIONES_PATRONO.filter((s) => !s.soloEdicion || (esEdicion && entidad?.id)).map((s) => {
                  const Icon = s.icon;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setTab(s.id);
                          setEnSeccion(true);
                        }}
                        className="flex w-full flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-5 text-center transition hover:border-[#FF9500]/40 hover:bg-[#FF9500]/10"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FF9500]/30 bg-[#FF9500]/10">
                          <Icon className="h-5 w-5 text-[#FFD60A]" aria-hidden />
                        </span>
                        <span className="text-sm font-semibold text-zinc-100">{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
          <Tabs.Root
            value={tab}
            onValueChange={(v) => setTab(v as SeccionPatronoId)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <Tabs.Content value="datos" className="space-y-4 outline-none">
                <div>
                  <label className={labelClass}>Razón social *</label>
                  <input
                    required
                    value={nombreLegal}
                    onChange={(e) => setNombreLegal(e.target.value)}
                    className={inputClass}
                    placeholder="Razón social registrada"
                  />
                </div>
                <div>
                  <label className={labelClass}>Denominación comercial</label>
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
                    <div className="flex gap-2">
                      <div className="w-[5.5rem] shrink-0">
                        <label className={labelClass}>Tratamiento</label>
                        <select
                          className={inputClass}
                          value={row.genero}
                          aria-label="Tratamiento Sr. o Sra."
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, genero: e.target.value === 'F' ? 'F' : 'M' } : r,
                              ),
                            )
                          }
                        >
                          <option value="M">Sr.</option>
                          <option value="F">Sra.</option>
                        </select>
                      </div>
                      <div className="min-w-0 flex-1">
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
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className={labelClass}>Cédula</label>
                        <input
                          value={row.cedula}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? {
                                      ...r,
                                      cedula: e.target.value,
                                      nacionalidadOtro: esCedulaVenezolana(e.target.value)
                                        ? ''
                                        : r.nacionalidadOtro,
                                    }
                                  : r,
                              ),
                            )
                          }
                          className={inputClass}
                          placeholder="V-12345678 o E-…"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Fecha de nacimiento</label>
                        <input
                          type="date"
                          value={row.fecha_nacimiento}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, fecha_nacimiento: e.target.value } : r,
                              ),
                            )
                          }
                          className={inputClass}
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
                          placeholder="Ej. casado"
                        />
                      </div>
                    </div>
                    {esCedulaVenezolana(row.cedula) ? (
                      <p className="text-[11px] text-zinc-500">
                        Nacionalidad (cédula V): <span className="text-zinc-300">Venezolano</span>
                      </p>
                    ) : null}
                    {letraCedula(row.cedula) === 'E' ||
                    (row.cedula.trim() !== '' && !esCedulaVenezolana(row.cedula) && letraCedula(row.cedula) == null) ? (
                      <div>
                        <label className={labelClass}>Nacionalidad</label>
                        <input
                          value={row.nacionalidadOtro}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, nacionalidadOtro: e.target.value } : r)),
                            )
                          }
                          className={inputClass}
                          placeholder="Ej. colombiana"
                        />
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>Municipio de residencia</label>
                        <input
                          value={row.municipio_residencia}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, municipio_residencia: e.target.value } : r,
                              ),
                            )
                          }
                          className={inputClass}
                          placeholder="Municipio donde reside"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Estado de residencia</label>
                        <input
                          value={row.estado_residencia}
                          onChange={(e) =>
                            setRepFilas((prev) =>
                              prev.map((r) => (r.id === row.id ? { ...r, estado_residencia: e.target.value } : r)),
                            )
                          }
                          className={inputClass}
                          placeholder="Estado donde reside"
                        />
                      </div>
                    </div>
                    <div>
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
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#FFD60A]/80">
                    Documentos
                  </p>
                  <div>
                    <label className={labelClass}>Actas (constitutiva / asambleas)</label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      multiple
                      className="mt-1 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200"
                      onChange={(e) => {
                        const list = e.target.files ? Array.from(e.target.files) : [];
                        if (list.length) {
                          setActaFilesPendientes((prev) => [...prev, ...list]);
                        }
                        e.target.value = '';
                      }}
                    />
                    {rmActas.length > 0 || actaFilesPendientes.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {rmActas.map((a) => (
                          <li
                            key={a.url}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs"
                          >
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 truncate font-semibold text-[#FFD60A] underline hover:text-[#FF9500]"
                            >
                              {a.nombre || 'Acta'}
                            </a>
                            <button
                              type="button"
                              onClick={() => setRmActas((prev) => prev.filter((x) => x.url !== a.url))}
                              className="shrink-0 text-red-300 hover:text-red-200"
                            >
                              Quitar
                            </button>
                          </li>
                        ))}
                        {actaFilesPendientes.map((f, idx) => (
                          <li
                            key={`pend-${f.name}-${idx}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[#FF9500]/35 bg-[#FF9500]/5 px-2.5 py-1.5 text-xs text-zinc-300"
                          >
                            <span className="min-w-0 truncate">{f.name} (pendiente)</span>
                            <button
                              type="button"
                              onClick={() =>
                                setActaFilesPendientes((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="shrink-0 text-red-300 hover:text-red-200"
                            >
                              Quitar
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[11px] text-zinc-500">PDF o imagen. Puede subir varias.</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>RIF (documento)</label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="mt-1 w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200"
                      onChange={(e) => setRifDocFile(e.target.files?.[0] ?? null)}
                    />
                    {rmRifDocUrl ? (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs">
                        <a
                          href={rmRifDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 truncate font-semibold text-[#FFD60A] underline hover:text-[#FF9500]"
                        >
                          Ver RIF cargado
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setRmRifDocUrl('');
                            setRifDocFile(null);
                          }}
                          className="shrink-0 text-red-300 hover:text-red-200"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : null}
                    {rifDocFile ? (
                      <p className="mt-1 text-[11px] text-zinc-400">Nuevo archivo: {rifDocFile.name}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Registro</label>
                  <input
                    value={rmCirc}
                    onChange={(e) => setRmCirc(e.target.value)}
                    className={inputClass}
                    placeholder="Registro Mercantil Segundo de la Circunscripción Judicial del Estado Nueva Esparta"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Tomo</label>
                    <input value={rmTomo} onChange={(e) => setRmTomo(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Número</label>
                    <input
                      value={rmNumero}
                      onChange={(e) => setRmNumero(e.target.value)}
                      className={inputClass}
                      placeholder="Nº asiento / inscripción mercantil"
                    />
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
                <p className="pt-1 text-[11px] font-bold uppercase tracking-wide text-[#FFD60A]/80">
                  Domicilio de la empresa según registro
                </p>
                <div>
                  <label className={labelClass}>Vía / urbanización</label>
                  <textarea
                    value={rmDomicilioEmpresa}
                    onChange={(e) => setRmDomicilioEmpresa(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-y`}
                    placeholder="Calle, avenida o urbanización"
                  />
                </div>
                <div>
                  <label className={labelClass}>Sector</label>
                  <input
                    value={rmSectorRegistro}
                    onChange={(e) => setRmSectorRegistro(e.target.value)}
                    className={inputClass}
                    placeholder="Sector, urbanización o parroquia según asiento"
                  />
                </div>
                <div>
                  <label className={labelClass}>Municipio</label>
                  <input
                    value={rmMunicipioRegistro}
                    onChange={(e) => setRmMunicipioRegistro(e.target.value)}
                    className={inputClass}
                    placeholder="Municipio"
                  />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <input
                    value={rmEstadoRegistro}
                    onChange={(e) => setRmEstadoRegistro(e.target.value)}
                    className={inputClass}
                    placeholder="Estado donde consta el domicilio social"
                  />
                </div>
              </Tabs.Content>

              <Tabs.Content value="permisos" className="space-y-4 outline-none">
                {(
                  [
                    {
                      key: 'ivss',
                      label: 'IVSS — vence',
                      value: permIvss,
                      setValue: setPermIvss,
                      alert: alertIvss,
                      docUrl: permIvssDocUrl,
                      setDocUrl: setPermIvssDocUrl,
                      file: permIvssFile,
                      setFile: setPermIvssFile,
                    },
                    {
                      key: 'inces',
                      label: 'INCES — vence',
                      value: permInces,
                      setValue: setPermInces,
                      alert: alertInces,
                      docUrl: permIncesDocUrl,
                      setDocUrl: setPermIncesDocUrl,
                      file: permIncesFile,
                      setFile: setPermIncesFile,
                    },
                    {
                      key: 'sol',
                      label: 'Solvencia laboral — vence',
                      value: permSol,
                      setValue: setPermSol,
                      alert: alertSol,
                      docUrl: permSolDocUrl,
                      setDocUrl: setPermSolDocUrl,
                      file: permSolFile,
                      setFile: setPermSolFile,
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.key}
                    className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <label className={labelClass}>{row.label}</label>
                    <input
                      type="date"
                      value={row.value}
                      onChange={(e) => row.setValue(e.target.value)}
                      className={inputPermClass(row.alert)}
                      style={{ colorScheme: 'dark' }}
                    />
                    <label className={labelClass}>PDF del permiso</label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200"
                      onChange={(e) => row.setFile(e.target.files?.[0] ?? null)}
                    />
                    {row.docUrl ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs">
                        <a
                          href={row.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 truncate font-semibold text-[#FFD60A] underline hover:text-[#FF9500]"
                        >
                          Ver PDF cargado
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            row.setDocUrl('');
                            row.setFile(null);
                          }}
                          className="shrink-0 text-red-300 hover:text-red-200"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : null}
                    {row.file ? (
                      <p className="text-[11px] text-zinc-400">Nuevo archivo: {row.file.name}</p>
                    ) : null}
                  </div>
                ))}
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

              {esEdicion && entidad?.id ? (
                <Tabs.Content value="equipo" className="outline-none">
                  <EquipoEntidadPanel entidadId={entidad.id} entidadNombre={entidad.nombre} />
                </Tabs.Content>
              ) : null}

              {esEdicion && entidad?.id ? (
                <Tabs.Content value="maquinaria" className="outline-none">
                  <MaquinariaPropiaEntidadPanel entidadId={entidad.id} entidadNombre={entidad.nombre} />
                </Tabs.Content>
              ) : null}
            </div>
          </Tabs.Root>
          )}

          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/10 bg-white/[0.02] px-5 py-4">
            {!enSeccion ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/10"
              >
                Cerrar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEnSeccion(false)}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/10"
                >
                  {tab === 'equipo' || tab === 'maquinaria' ? 'Volver' : 'Menú'}
                </button>
                {tab !== 'equipo' && tab !== 'maquinaria' ? (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => void onSubmit()}
                    className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-900/30 hover:opacity-95 disabled:opacity-50"
                  >
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
