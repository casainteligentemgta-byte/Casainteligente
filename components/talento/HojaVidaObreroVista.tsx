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
};

/**
 * Vista tipo documento al esquema legal: planilla de empleo (con patrono/obra) o hoja de vida (solo trabajador).
 */
export default function HojaVidaObreroVista({
  hojaVidaLegal,
  className = '',
  planillaPatrono,
  documentVariant = 'hoja_empleo',
}: HojaVidaObreroVistaProps) {
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
      className={`rounded-2xl border border-white/10 bg-[#fafafa] p-5 text-slate-900 shadow-inner ${className}`}
    >
      <div className="border-b-2 border-black pb-2 mb-3 flex flex-wrap items-start justify-between gap-2 text-[10px] font-bold leading-tight text-black">
        <span className="shrink-0 max-w-[28%]">{HOJA_VIDA_GACETA_NUMERO}</span>
        <span className="min-w-0 flex-1 text-center uppercase tracking-tight">
          Gaceta Oficial de la República Bolivariana de Venezuela
          <span className="block font-normal normal-case text-[9px] text-slate-600 mt-0.5">
            (presentación tipo expediente — Casa Inteligente)
          </span>
        </span>
        <span className="shrink-0 text-right max-w-[22%]">Vista previa</span>
      </div>
      <header className="border-2 border-black px-3 py-3 text-center">
        <h3 className="text-sm font-black uppercase tracking-wide text-black">
          {esHojaEmpleo ? HOJA_EMPLEO_TITULO : HOJA_VIDA_SOLO_TITULO}
        </h3>
        <p className="mt-1 text-[10px] font-medium leading-snug text-slate-800">
          {esHojaEmpleo ? HOJA_EMPLEO_SUBTITULO : HOJA_VIDA_SOLO_SUBTITULO}
        </p>
        <p className="mt-2 border-t border-slate-300 pt-2 text-[10px] leading-relaxed text-slate-600">{HOJA_VIDA_GACETA_REFERENCIA}</p>
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

      <div className="mt-4 space-y-5">
        {Array.from(bySec.entries()).map(([titulo, filas]) => (
          <section key={titulo}>
            <h4 className="bg-slate-900 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
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
                    className="flex flex-col gap-0.5 border-b border-black px-2 py-1.5 last:border-b-0 sm:flex-row sm:items-stretch sm:gap-0"
                  >
                    <p className="w-full shrink-0 text-[10px] font-bold uppercase text-slate-800 sm:w-[38%] sm:border-r sm:border-black sm:pr-2">
                      {campo.etiqueta}
                    </p>
                    <div className="min-h-[1.35rem] flex-1 bg-slate-50 px-2 py-0.5 text-xs text-slate-900 sm:text-right">
                      {v ? <span>{v}</span> : <span className="text-slate-400">—</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section>
          <h4 className="bg-slate-900 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Familiares dependientes a cargo
          </h4>
          <div className="overflow-x-auto border border-t-0 border-black bg-white text-[10px]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-200">
                  <th className="border border-black px-1 py-1 font-bold">N°</th>
                  <th className="border border-black px-1 py-1 font-bold">Apellidos y nombres</th>
                  <th className="border border-black px-1 py-1 font-bold">Parentesco</th>
                  <th className="border border-black px-1 py-1 font-bold">Fecha nac.</th>
                  <th className="border border-black px-1 py-1 font-bold">No aplica</th>
                  <th className="border border-black px-1 py-1 font-bold">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {hojaVidaLegal.familiaresDependientes.map((dep, i) => (
                  <tr key={i}>
                    <td className="border border-black px-1 py-1">{i + 1}</td>
                    <td className="border border-black px-1 py-1">
                      {[dep.apellido, dep.nombre].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="border border-black px-1 py-1">{dep.parentesco || '—'}</td>
                    <td className="border border-black px-1 py-1">{dep.fechaNacimiento || '—'}</td>
                    <td className="border border-black px-1 py-1">{dep.noAplica ? 'Sí' : '—'}</td>
                    <td className="border border-black px-1 py-1">{(dep.observaciones ?? '').trim() || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h4 className="bg-slate-900 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Experiencia laboral (trabajos previos)
          </h4>
          <div className="overflow-x-auto border border-t-0 border-black bg-white text-[10px]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-200">
                  <th className="border border-black px-1 py-1 font-bold">Patrono</th>
                  <th className="border border-black px-1 py-1 font-bold">Lugar</th>
                  <th className="border border-black px-1 py-1 font-bold">Cargo</th>
                  <th className="border border-black px-1 py-1 font-bold">Duración</th>
                  <th className="border border-black px-1 py-1 font-bold">Retiro</th>
                  <th className="border border-black px-1 py-1 font-bold">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {hojaVidaLegal.trabajosPrevios.map((t, i) => (
                  <tr key={i}>
                    <td className="border border-black px-1 py-1">{t.empresaPatrono || '—'}</td>
                    <td className="border border-black px-1 py-1">{t.lugar || '—'}</td>
                    <td className="border border-black px-1 py-1">{t.oficioOCargo || '—'}</td>
                    <td className="border border-black px-1 py-1">{t.duracion || '—'}</td>
                    <td className="border border-black px-1 py-1">{t.fechaRetiro || '—'}</td>
                    <td className="border border-black px-1 py-1">{t.motivoRetiro || '—'}</td>
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
