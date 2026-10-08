'use client';

import type { HojaVidaObreroCompleta } from '@/lib/talento/hojaVidaObreroCompleta';
import {
  HOJA_EMPLEO_SUBTITULO,
  HOJA_EMPLEO_TITULO,
  HOJA_VIDA_GACETA_NUMERO,
  HOJA_VIDA_GACETA_REFERENCIA,
  HOJA_VIDA_SOLO_SUBTITULO,
  HOJA_VIDA_SOLO_TITULO,
} from '@/lib/talento/hojaVidaGacetaLayout';
import {
  HOJA_VIDA_LEGAL_VISTA_FILAS,
  valorVistaLegal,
  type FilaVistaLegal,
} from '@/lib/talento/hojaVidaLegalVistaMeta';
import type { PlanillaPatronoCampos } from '@/lib/talento/planillaPatronoTypes';

function esUrlFoto(v: string): boolean {
  return /^https?:\/\//i.test(v) || v.startsWith('data:image/');
}

function ValorCampoLegal({ id, valor, grande }: { id: string; valor: string; grande: boolean }) {
  if ((id === 'fotoUrl' || id === 'fotoCedulaUrl') && valor && esUrlFoto(valor)) {
    const carnet = id === 'fotoUrl';
    return (
      <img
        src={valor}
        alt={carnet ? 'Fotografía tipo carnet' : 'Fotografía de la cédula'}
        className={
          carnet
            ? grande
              ? 'h-48 w-36 rounded border border-slate-300 object-cover'
              : 'h-28 w-20 rounded border border-slate-300 object-cover'
            : grande
              ? 'max-h-44 w-full max-w-xl rounded border border-slate-300 object-contain bg-white'
              : 'max-h-24 w-full max-w-sm rounded border border-slate-300 object-contain bg-white'
        }
      />
    );
  }
  if (!valor) return <span className="text-slate-400">—</span>;
  return <span className="whitespace-pre-wrap break-words">{valor}</span>;
}

export type HojaVidaObreroVistaProps = {
  /** Datos actuales del formulario o vacío para solo mostrar el esquema. */
  hojaVidaLegal: HojaVidaObreroCompleta;
  className?: string;
  /** Si viene de `ci_empleados.proyecto_modulo_id` + proyecto/entidad en BD. */
  planillaPatrono?: PlanillaPatronoCampos | null;
  /**
   * `hoja_empleo`: I–IV patrono/obra/contratación + datos del trabajador (alineado al PDF hoja de empleo).
   * `hoja_vida`: sin patrono/obra/contratación (PDF hoja de vida).
   */
  documentVariant?: 'hoja_empleo' | 'hoja_vida';
  /** `ampliado`: tipografía y fotos grandes para lectura en banca / RRHH. */
  tamano?: 'compacto' | 'ampliado';
};

/**
 * Vista tipo documento al esquema legal: planilla de empleo (con patrono/obra) o hoja de vida (solo trabajador).
 */
export default function HojaVidaObreroVista({
  hojaVidaLegal,
  className = '',
  planillaPatrono,
  documentVariant = 'hoja_empleo',
  tamano = 'compacto',
}: HojaVidaObreroVistaProps) {
  const grande = tamano === 'ampliado';
  const hSec = grande
    ? 'bg-slate-900 px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white'
    : 'bg-slate-900 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white';
  const labelCls = grande
    ? 'w-full shrink-0 text-sm font-bold uppercase text-slate-800 sm:w-[34%] sm:border-r sm:border-black sm:pr-3'
    : 'w-full shrink-0 text-[10px] font-bold uppercase text-slate-800 sm:w-[38%] sm:border-r sm:border-black sm:pr-2';
  const valueCls = grande
    ? 'min-h-[2rem] flex-1 bg-slate-50 px-3 py-2 text-base leading-relaxed text-slate-900'
    : 'min-h-[1.35rem] flex-1 bg-slate-50 px-2 py-0.5 text-xs text-slate-900 sm:text-right';
  const tableCls = grande
    ? 'overflow-x-auto border border-t-0 border-black bg-white text-sm'
    : 'overflow-x-auto border border-t-0 border-black bg-white text-[10px]';
  const td = grande ? 'border border-black px-2 py-2' : 'border border-black px-1 py-1';
  const esHojaEmpleo = documentVariant === 'hoja_empleo';
  const bySec = new Map<string, FilaVistaLegal[]>();
  for (const f of HOJA_VIDA_LEGAL_VISTA_FILAS) {
    if (!esHojaEmpleo && f.seccion === 'Contratación') continue;
    const arr = bySec.get(f.seccion) ?? [];
    arr.push(f);
    bySec.set(f.seccion, arr);
  }

  const c = planillaPatrono ?? {};
  const entNombre = (c.entidadNombre ?? '').trim();
  const entRif = (c.entidadRif ?? '').trim();
  const proyNombre = (c.proyectoNombre ?? '').trim();
  const repNom = (c.representanteNombreApellido ?? '').trim();
  const repCi = (c.representanteCi ?? '').trim();
  const repEdad = (c.representanteEdad ?? '').trim();
  const repEc = (c.representanteEstadoCivil ?? '').trim();
  const repCargo = (c.representanteCargo ?? '').trim();
  const repNac = (c.representanteNacionalidad ?? '').trim();
  const domEmp = (c.empresaDomicilio ?? '').trim();

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#fafafa] text-slate-900 shadow-inner ${grande ? 'p-6 sm:p-10' : 'p-5'} ${className}`}
    >
      <div
        className={`border-b-2 border-black pb-2 mb-3 flex flex-wrap items-start justify-between gap-2 font-bold leading-tight text-black ${grande ? 'text-sm' : 'text-[10px]'}`}
      >
        <span className="shrink-0 max-w-[28%]">{HOJA_VIDA_GACETA_NUMERO}</span>
        <span className="min-w-0 flex-1 text-center uppercase tracking-tight">
          Gaceta Oficial de la República Bolivariana de Venezuela
          <span className={`block font-normal normal-case text-slate-600 mt-0.5 ${grande ? 'text-xs' : 'text-[9px]'}`}>
            (presentación tipo expediente — Casa Inteligente)
          </span>
        </span>
        <span className="shrink-0 text-right max-w-[22%]">Vista previa</span>
      </div>
      <header className={`border-2 border-black text-center ${grande ? 'px-5 py-5' : 'px-3 py-3'}`}>
        <h3 className={`font-black uppercase tracking-wide text-black ${grande ? 'text-2xl' : 'text-sm'}`}>
          {esHojaEmpleo ? HOJA_EMPLEO_TITULO : HOJA_VIDA_SOLO_TITULO}
        </h3>
        <p className={`mt-1 font-medium leading-snug text-slate-800 ${grande ? 'text-sm' : 'text-[10px]'}`}>
          {esHojaEmpleo ? HOJA_EMPLEO_SUBTITULO : HOJA_VIDA_SOLO_SUBTITULO}
        </p>
        <p className={`mt-2 border-t border-slate-300 pt-2 leading-relaxed text-slate-600 ${grande ? 'text-sm' : 'text-[10px]'}`}>
          {HOJA_VIDA_GACETA_REFERENCIA}
        </p>
      </header>

      {esHojaEmpleo ? (
        <div className="mt-3 space-y-3 text-[10px]">
          <div>
            <p className="bg-slate-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
              I. Identificación del patrono
            </p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <div className="border border-black bg-white px-2 py-1.5">
                <p className="font-bold uppercase text-slate-700">Nombre o denominación</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{entNombre || '—'}</p>
              </div>
              <div className="border border-black bg-white px-2 py-1.5">
                <p className="font-bold uppercase text-slate-700">RIF</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{entRif || '—'}</p>
              </div>
            </div>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              <div className="border border-black bg-white px-2 py-1.5 sm:col-span-1">
                <p className="font-bold uppercase text-slate-700">Nombre y apellido del representante</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{repNom || '—'}</p>
              </div>
              <div className="border border-black bg-white px-2 py-1.5">
                <p className="font-bold uppercase text-slate-700">C.I. del representante</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{repCi || '—'}</p>
              </div>
              <div className="border border-black bg-white px-2 py-1.5">
                <p className="font-bold uppercase text-slate-700">Edad del representante</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{repEdad || '—'}</p>
              </div>
            </div>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              <div className="border border-black bg-white px-2 py-1.5">
                <p className="font-bold uppercase text-slate-700">Estado civil del representante</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{repEc || '—'}</p>
              </div>
              <div className="border border-black bg-white px-2 py-1.5">
                <p className="font-bold uppercase text-slate-700">Cargo del representante</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{repCargo || '—'}</p>
              </div>
              <div className="border border-black bg-white px-2 py-1.5">
                <p className="font-bold uppercase text-slate-700">Nacionalidad del representante</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{repNac || '—'}</p>
              </div>
            </div>
            <div className="mt-1 border border-black bg-white px-2 py-1.5">
              <p className="font-bold uppercase text-slate-700">Dirección / domicilio de la empresa</p>
              <p className="mt-1 min-h-[2rem] whitespace-pre-wrap border-b border-dotted border-slate-400 text-slate-900">
                {domEmp || '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="bg-slate-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
              II. Identificación de la obra
            </p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <div className="border border-black bg-white px-2 py-1.5 sm:col-span-1">
                <p className="font-bold uppercase text-slate-700">Proyecto u obra (referencia)</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">{proyNombre || '—'}</p>
              </div>
              <div className="border border-black bg-white px-2 py-1.5">
                <p className="font-bold uppercase text-slate-700">Código / expediente interno</p>
                <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-400">—</p>
              </div>
            </div>
            <div className="mt-1 border border-black bg-white px-2 py-1.5">
              <p className="font-bold uppercase text-slate-700">Ubicación / municipio</p>
              <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-400">—</p>
            </div>
          </div>

          <div>
            <p className="bg-slate-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
              III. Identificación de la contratación
            </p>
            <div className="mt-1 border border-black bg-white px-2 py-1.5">
              <p className="font-bold uppercase text-slate-700">Cargo u oficio a desempeñar</p>
              <p className="mt-1 min-h-[1.75rem] border-b border-dotted border-slate-400 text-slate-900">
                {(hojaVidaLegal.contratacion.cargoUOficio ?? '').trim() || '—'}
              </p>
            </div>
          </div>

          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
            Hoja de vida del trabajador (identificación personal y bloques siguientes)
          </p>
        </div>
      ) : null}

      <div className={`mt-4 ${grande ? 'space-y-8' : 'space-y-5'}`}>
        {Array.from(bySec.entries()).map(([titulo, filas]) => (
          <section key={titulo}>
            <h4 className={hSec}>
              {esHojaEmpleo && titulo === 'I. Datos personales'
                ? 'IV. Identificación del trabajador (datos personales)'
                : titulo}
            </h4>
            <ul className="mt-0 border border-t-0 border-black bg-white">
              {filas.map((campo) => {
                const v = valorVistaLegal(campo.id, hojaVidaLegal);
                return (
                  <li
                    key={campo.id}
                    className={`flex flex-col border-b border-black last:border-b-0 sm:flex-row sm:items-stretch sm:gap-0 ${grande ? 'gap-1 px-3 py-3' : 'gap-0.5 px-2 py-1.5'}`}
                  >
                    <p className={labelCls}>{campo.etiqueta}</p>
                    <div className={valueCls}>
                      <ValorCampoLegal id={campo.id} valor={v} grande={grande} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section>
          <h4 className={hSec}>Familiares dependientes a cargo</h4>
          <div className={tableCls}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-200">
                  <th className={td}>N°</th>
                  <th className={td}>Apellidos y nombres</th>
                  <th className={td}>Parentesco</th>
                  <th className={td}>Fecha nac.</th>
                  <th className={td}>No aplica</th>
                  <th className={td}>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {hojaVidaLegal.familiaresDependientes.map((dep, i) => (
                  <tr key={i}>
                    <td className={td}>{i + 1}</td>
                    <td className={td}>
                      {[dep.apellido, dep.nombre].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className={td}>{dep.parentesco || '—'}</td>
                    <td className={td}>{dep.fechaNacimiento || '—'}</td>
                    <td className={td}>{dep.noAplica ? 'Sí' : '—'}</td>
                    <td className={td}>{(dep.observaciones ?? '').trim() || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h4 className={hSec}>Experiencia laboral (trabajos previos)</h4>
          <div className={tableCls}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-200">
                  <th className={td}>Patrono</th>
                  <th className={td}>Lugar</th>
                  <th className={td}>Cargo</th>
                  <th className={td}>Duración</th>
                  <th className={td}>Retiro</th>
                  <th className={td}>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {hojaVidaLegal.trabajosPrevios.map((t, i) => (
                  <tr key={i}>
                    <td className={td}>{t.empresaPatrono || '—'}</td>
                    <td className={td}>{t.lugar || '—'}</td>
                    <td className={td}>{t.oficioOCargo || '—'}</td>
                    <td className={td}>{t.duracion || '—'}</td>
                    <td className={td}>{t.fechaRetiro || '—'}</td>
                    <td className={td}>{t.motivoRetiro || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
