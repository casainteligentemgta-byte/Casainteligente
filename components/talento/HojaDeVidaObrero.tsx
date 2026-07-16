'use client';

import {
  AlertCircle,
  CheckCircle2,
  Droplets,
  FileCheck,
  Footprints,
  GraduationCap,
  HardHat,
  Mail,
  MapPin,
  Phone,
  Ruler,
  ShieldAlert,
  Shirt,
  Sparkles,
  Stethoscope,
  User,
  XCircle,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  hojaVidaDesdeRow,
  nombreCompletoDesde,
  type HojaVidaObreroCompleta,
} from '@/lib/talento/hojaVidaObreroCompleta';

const BG = '#0A0A0F';
const ACCENT = '#FF9500';

function str(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? '').trim();
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function waLink(phone: string): string | null {
  const d = onlyDigits(phone);
  if (d.length < 7) return null;
  const n = d.startsWith('0') ? `58${d.slice(1)}` : d.length <= 10 ? `58${d}` : d;
  return `https://wa.me/${n}`;
}

function telLink(phone: string): string | null {
  const d = onlyDigits(phone);
  if (d.length < 7) return null;
  return `tel:+${d.startsWith('58') ? d : `58${d}`}`;
}

type EstadoOp = { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' };

export type SituacionLaboralObrero = 'disponible' | 'en_obra' | 'evaluacion';

function estadoOperativo(
  row: Record<string, unknown>,
  situacionLaboral?: SituacionLaboralObrero,
): EstadoOp {
  if (situacionLaboral === 'en_obra') return { label: 'En obra', tone: 'ok' };
  if (situacionLaboral === 'disponible') return { label: 'Disponible', tone: 'ok' };
  if (situacionLaboral === 'evaluacion') return { label: 'En evaluación', tone: 'warn' };

  const estado = str(row, 'estado');
  const ep = str(row, 'estado_proceso');
  if (estado === 'rechazado') return { label: 'No disponible', tone: 'bad' };
  if (row.en_obra === true || str(row, 'en_obra') === 'true' || str(row, 'en_obra') === '1') {
    return { label: 'En obra', tone: 'ok' };
  }
  if (ep === 'pendiente_cv') return { label: 'Pendiente CV', tone: 'warn' };
  if (estado === 'evaluacion_pendiente' || ep.includes('examen')) {
    return { label: 'En evaluación', tone: 'warn' };
  }
  if (estado === 'aprobado') return { label: 'Disponible', tone: 'ok' };
  if (ep === 'cv_completado') return { label: 'En evaluación', tone: 'warn' };
  return { label: 'En proceso', tone: 'muted' };
}

function nivelOficioText(row: Record<string, unknown>, h: HojaVidaObreroCompleta): string {
  return (
    str(row, 'cargo_nombre') ||
    h.contratacion.cargoUOficio.trim() ||
    str(row, 'rol_buscado') ||
    str(row, 'cargo') ||
    'Oficio no indicado'
  );
}

function codigoNivelBadge(row: Record<string, unknown>): string | null {
  const cod = str(row, 'cargo_codigo');
  if (cod) return cod;
  const n = row.cargo_nivel;
  if (typeof n === 'number' && Number.isFinite(n)) return `Nivel ${n}`;
  return null;
}

function sangreDisplay(row: Record<string, unknown>, h: HojaVidaObreroCompleta): string {
  return (
    h.antecedentesMedicos.tipoSangre.trim() ||
    str(row, 'salud_tipo_sangre') ||
    str(row, 'grupo_sanguineo') ||
    '—'
  );
}

function alergiasDisplay(row: Record<string, unknown>, h: HojaVidaObreroCompleta): string {
  const a =
    h.antecedentesMedicos.enfermedadesPadecidas.trim() ||
    h.antecedentesMedicos.incapacidadesFisicasOFuncionales.trim() ||
    str(row, 'salud_enfermedades') ||
    str(row, 'alergias_notas') ||
    '';
  return a || 'Sin alergias / condiciones declaradas';
}

function tallasDesde(row: Record<string, unknown>, h: HojaVidaObreroCompleta) {
  return {
    camisa: h.pesoMedidas.tallaCamisa.trim() || str(row, 'talla_camisa') || '—',
    pantalon: h.pesoMedidas.tallaPantalon.trim() || str(row, 'talla_pantalon') || '—',
    botas: h.pesoMedidas.medidaBotas.trim() || str(row, 'talla_botas') || '—',
  };
}

function lateralidad(row: Record<string, unknown>, h: HojaVidaObreroCompleta): string {
  if (typeof row.zurdo === 'boolean') return row.zurdo ? 'Zurdo' : 'Diestro';
  if (h.datosPersonales.zurdo === 'si') return 'Zurdo';
  if (h.datosPersonales.zurdo === 'no') return 'Diestro';
  return '—';
}

function gradoInstruccion(h: HojaVidaObreroCompleta): string {
  const i = h.instruccionCapacitacion;
  const parts: string[] = [];
  if (i.superior) parts.push('Superior');
  else if (i.tecnica) parts.push('Técnica');
  if (i.instruccionSecundaria) parts.push('Secundaria');
  if (i.instruccionPrimaria) parts.push('Primaria');
  if (i.sabeLeer === 'si') parts.push('Sabe leer / escribir');
  const prof = i.profesionUOficioActual.trim();
  if (prof) return `${parts.join(' · ') || '—'}${parts.length ? ' — ' : ''}${prof}`;
  return parts.join(' · ') || '—';
}

function especialidadesTags(h: HojaVidaObreroCompleta): string[] {
  const set = new Set<string>();
  for (const t of h.trabajosPrevios) {
    const o = t.oficioOCargo.trim();
    if (o) set.add(o);
  }
  const prof = h.instruccionCapacitacion.profesionUOficioActual.trim();
  if (prof) set.add(prof);
  return Array.from(set).slice(0, 8);
}

function anosExperiencia(row: Record<string, unknown>, h: HojaVidaObreroCompleta): string {
  const col = str(row, 'anos_experiencia_obra');
  if (col) return col;
  const n = h.trabajosPrevios.filter((t) => t.empresaPatrono.trim() || t.oficioOCargo.trim()).length;
  return n ? `${n} registro(s) laboral(es)` : '—';
}

function zonaResidencia(row: Record<string, unknown>, h: HojaVidaObreroCompleta): string {
  return (
    str(row, 'ciudad_estado') ||
    h.datosPersonales.lugarNacimiento.trim() ||
    str(row, 'lugar_nacimiento') ||
    '—'
  );

}

function direccionCorta(h: HojaVidaObreroCompleta, row: Record<string, unknown>): string {
  const d = h.datosPersonales.direccionDomicilio.trim() || str(row, 'domicilio_declarado');
  if (!d) return '—';
  return d.length > 72 ? `${d.slice(0, 72)}…` : d;
}

function docCedulaOk(row: Record<string, unknown>, h: HojaVidaObreroCompleta): boolean {
  return Boolean(str(row, 'cedula_foto_url') || h.datosPersonales.fotoCedulaUrl.trim());
}

function docAntecedentesOk(row: Record<string, unknown>, h: HojaVidaObreroCompleta): boolean {
  if (h.certificadoAntecedentesPenales.antecedentesPenales === 'si') return true;
  if (h.certificadoAntecedentesPenales.fechaExpedicion.trim()) return true;
  const ap = row.antecedentes_penales;
  if (ap && typeof ap === 'object' && !Array.isArray(ap)) {
    const o = ap as Record<string, unknown>;
    if (String(o.tiene ?? '').trim()) return true;
    if (String(o.fechaExpedicion ?? '').trim()) return true;
  }
  return false;
}

function docMedicoOk(row: Record<string, unknown>, h: HojaVidaObreroCompleta): boolean {
  if (row.examen_medico === true) return true;
  return h.antecedentesMedicos.examenMedicoPrevio === 'si';
}

const card =
  'rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/30 backdrop-blur-xl transition duration-200 hover:border-[#FF9500]/40';

export type HojaDeVidaObreroProps = {
  /** Fila o objeto parcial desde `ci_empleados` (PostgREST / Supabase). */
  empleado: Record<string, unknown>;
  /** Prioriza el estado operativo cuando RRHH o obra lo conoce (p. ej. asignación activa). */
  situacionLaboral?: SituacionLaboralObrero;
  className?: string;
};

/**
 * Vista resumida «Elite Black» del obrero para Talento (no sustituye la planilla legal PDF).
 */
export default function HojaDeVidaObrero({ empleado, situacionLaboral, className = '' }: HojaDeVidaObreroProps) {
  const h = useMemo(() => hojaVidaDesdeRow(empleado), [empleado]);
  const nombre = nombreCompletoDesde(h).trim() || str(empleado, 'nombre_completo') || 'Sin nombre';
  const cedula = h.datosPersonales.cedulaIdentidad.trim() || str(empleado, 'cedula') || str(empleado, 'documento') || '—';
  const foto = h.datosPersonales.fotoUrl.trim() || str(empleado, 'foto_perfil_url');
  const nivel = nivelOficioText(empleado, h);
  const badgeCod = codigoNivelBadge(empleado);
  const estado = estadoOperativo(empleado, situacionLaboral);
  const tel = h.datosPersonales.celular.trim() || str(empleado, 'celular') || str(empleado, 'telefono');
  const mail = h.datosPersonales.correoElectronico.trim() || str(empleado, 'email');
  const wa = waLink(tel);
  const telHref = telLink(tel);
  const tallas = tallasDesde(empleado, h);
  const tags = especialidadesTags(h);
  const estadoColors = {
    ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    bad: 'border-red-500/40 bg-red-500/10 text-red-200',
    muted: 'border-white/15 bg-white/5 text-zinc-300',
  };

  return (
    <div
      className={`text-zinc-100 ${className}`}
      style={{ backgroundColor: BG }}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {/* Header identidad */}
        <header className={`${card} mb-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 shadow-md ring-2 ring-[#FF9500]/50"
              style={{ borderColor: ACCENT }}
            >
              {foto ? (
                <img src={foto} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5 text-zinc-500">
                  <User className="h-10 w-10" strokeWidth={1.25} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-white md:text-2xl">{nombre}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                <span className="font-mono text-zinc-200">CI {cedula}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-[#FF9500]/35 bg-[#FF9500]/15 px-3 py-1 text-xs font-bold text-[#FFD60A]"
                  title={nivel}
                >
                  <HardHat className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{nivel}</span>
                </span>
                {badgeCod ? (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                    {badgeCod}
                  </span>
                ) : null}
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${estadoColors[estado.tone]}`}>
                  {estado.label}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Contacto rápido */}
          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF9500]">
              <Phone className="h-4 w-4" />
              Contacto rápido
            </h2>
            <div className="flex flex-wrap gap-2">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600/90 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 min-[360px]:flex-none"
                >
                  WhatsApp
                </a>
              ) : null}
              {telHref ? (
                <a
                  href={telHref}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#FF9500]/40 min-[360px]:flex-none"
                >
                  <Phone className="h-4 w-4" />
                  Llamar
                </a>
              ) : null}
            </div>
            {!wa && !telHref ? <p className="mt-2 text-xs text-zinc-500">Sin teléfono registrado.</p> : null}
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
              <p className="flex items-start gap-2 text-zinc-300">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#FF9500]" />
                <span className="min-w-0 break-all">{mail || '—'}</span>
              </p>
              <p className="flex items-start gap-2 text-zinc-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF9500]" />
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500">Zona</span>
                  {zonaResidencia(empleado, h)}
                </span>
              </p>
              <p className="text-xs leading-relaxed text-zinc-500">
                <span className="font-semibold text-zinc-400">Domicilio: </span>
                {direccionCorta(h, empleado)}
              </p>
            </div>
          </section>

          {/* Físico y logística obra */}
          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF9500]">
              <ShieldAlert className="h-4 w-4" />
              Obra — salud y dotación
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-red-200/90">
                  <Droplets className="h-3.5 w-3.5" />
                  Grupo sanguíneo
                </p>
                <p className="mt-1 text-lg font-bold text-white">{sangreDisplay(empleado, h)}</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-3 sm:col-span-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-amber-100/90">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Alergias / condiciones
                </p>
                <p className="mt-1 text-sm leading-snug text-zinc-200">{alergiasDisplay(empleado, h)}</p>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <li className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3">
                <Shirt className="mx-auto mb-1 h-5 w-5 text-[#FF9500]" />
                <span className="block text-[10px] font-bold uppercase text-zinc-500">Camisa</span>
                <span className="font-mono font-semibold text-white">{tallas.camisa}</span>
              </li>
              <li className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3">
                <Ruler className="mx-auto mb-1 h-5 w-5 text-[#FF9500]" />
                <span className="block text-[10px] font-bold uppercase text-zinc-500">Pantalón</span>
                <span className="font-mono font-semibold text-white">{tallas.pantalon}</span>
              </li>
              <li className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3">
                <Footprints className="mx-auto mb-1 h-5 w-5 text-[#FF9500]" />
                <span className="block text-[10px] font-bold uppercase text-zinc-500">Botas</span>
                <span className="font-mono font-semibold text-white">{tallas.botas}</span>
              </li>
            </ul>
            <p className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="text-zinc-500">Lateralidad</span>
              <span className="font-semibold text-[#FFD60A]">{lateralidad(empleado, h)}</span>
            </p>
          </section>

          {/* Competencias */}
          <section className={card}>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF9500]">
              <Sparkles className="h-4 w-4" />
              Competencias
            </h2>
            <p className="text-xs text-zinc-500">
              Experiencia declarada
              <span className="ml-2 font-mono text-sm font-bold text-white">{anosExperiencia(empleado, h)}</span>
            </p>
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-bold uppercase text-zinc-500">Especialidades / oficios</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.length ? (
                  tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-200"
                    >
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">—</span>
                )}
              </div>
            </div>
            <p className="mt-4 flex items-start gap-2 border-t border-white/10 pt-4 text-sm text-zinc-300">
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-[#FF9500]" />
              <span>
                <span className="block text-[10px] font-bold uppercase text-zinc-500">Instrucción</span>
                {gradoInstruccion(h)}
              </span>
            </p>
          </section>

          {/* Documentación semáforo */}
          <section className={`${card} md:col-span-2 xl:col-span-3`}>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF9500]">
              <FileCheck className="h-4 w-4" />
              Documentación
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DocPill ok={docCedulaOk(empleado, h)} label="Cédula / foto ID" />
              <DocPill ok={docAntecedentesOk(empleado, h)} label="Antecedentes" />
              <DocPill ok={docMedicoOk(empleado, h)} label="Certificado médico" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DocPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        ok ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-400" />
      ) : (
        <XCircle className="h-8 w-8 shrink-0 text-zinc-600" />
      )}
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-xs text-zinc-500">{ok ? 'Completo / cargado' : 'Pendiente o no informado'}</p>
      </div>
      {!ok ? <AlertCircle className="ml-auto h-5 w-5 text-amber-500/80" /> : null}
    </div>
  );
}
