'use client';

import type { HojaVidaObreroCompleta, SiNo } from '@/lib/talento/hojaVidaObreroCompleta';

type Props = {
  value: HojaVidaObreroCompleta;
  onChange: (next: HojaVidaObreroCompleta) => void;
};

function inpCls() {
  return 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900';
}

function lab() {
  return 'block text-[11px] font-semibold text-slate-600';
}

function SiNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SiNo;
  onChange: (v: SiNo) => void;
}) {
  return (
    <label className="block">
      <span className={lab()}>{label}</span>
      <select className={inpCls()} value={value} onChange={(e) => onChange(e.target.value as SiNo)}>
        <option value="">—</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <summary className="cursor-pointer text-sm font-bold text-slate-900">{title}</summary>
      <div className="mt-3 grid gap-2 pb-2 sm:grid-cols-2">{children}</div>
    </details>
  );
}

export default function OnboardingHojaVidaLegalForm({ value, onChange }: Props) {
  const d = value.datosPersonales;
  const setDp = (patch: Partial<typeof d>) =>
    onChange({ ...value, datosPersonales: { ...value.datosPersonales, ...patch } });

  const setCon = (cargoUOficio: string) => onChange({ ...value, contratacion: { cargoUOficio } });

  const setCap = (patch: Partial<(typeof value)['certificadoAntecedentesPenales']>) =>
    onChange({
      ...value,
      certificadoAntecedentesPenales: { ...value.certificadoAntecedentesPenales, ...patch },
    });

  const setIns = (patch: Partial<(typeof value)['instruccionCapacitacion']>) =>
    onChange({ ...value, instruccionCapacitacion: { ...value.instruccionCapacitacion, ...patch } });

  const setGre = (patch: Partial<(typeof value)['actividadGremial']>) =>
    onChange({ ...value, actividadGremial: { ...value.actividadGremial, ...patch } });

  const setMed = (patch: Partial<(typeof value)['antecedentesMedicos']>) =>
    onChange({ ...value, antecedentesMedicos: { ...value.antecedentesMedicos, ...patch } });

  const setPm = (patch: Partial<(typeof value)['pesoMedidas']>) =>
    onChange({ ...value, pesoMedidas: { ...value.pesoMedidas, ...patch } });

  const setDep = (i: number, patch: Partial<(typeof value.familiaresDependientes)[0]>) => {
    const fam = [...value.familiaresDependientes];
    fam[i] = { ...fam[i], ...patch };
    onChange({ ...value, familiaresDependientes: fam });
  };

  const setTp = (i: number, patch: Partial<(typeof value.trabajosPrevios)[0]>) => {
    const tp = [...value.trabajosPrevios];
    tp[i] = { ...tp[i], ...patch };
    onChange({ ...value, trabajosPrevios: tp });
  };

  return (
    <div className="space-y-3 text-slate-900">
      <p className="text-xs text-slate-600">
        Planilla de empleo / identificación del trabajador (formato tipo expediente de la rama construcción, alineado a la
        convención colectiva 2023). Completa lo que puedas; los vacíos salen como «—» en el PDF.
      </p>

      <Sec title="Datos personales del trabajador">
        <label className="block sm:col-span-2">
          <span className={lab()}>Foto (opcional — URL si ya subiste archivo, o déjalo en blanco)</span>
          <input className={inpCls()} value={d.fotoUrl} onChange={(e) => setDp({ fotoUrl: e.target.value })} />
        </label>
        <label className="block">
          <span className={lab()}>Primer nombre</span>
          <input className={inpCls()} value={d.primerNombre} onChange={(e) => setDp({ primerNombre: e.target.value })} />
        </label>
        <label className="block">
          <span className={lab()}>Segundo nombre</span>
          <input
            className={inpCls()}
            value={d.segundoNombre}
            onChange={(e) => setDp({ segundoNombre: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Primer apellido</span>
          <input
            className={inpCls()}
            value={d.primerApellido}
            onChange={(e) => setDp({ primerApellido: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Segundo apellido</span>
          <input
            className={inpCls()}
            value={d.segundoApellido}
            onChange={(e) => setDp({ segundoApellido: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Cédula de identidad</span>
          <input
            className={inpCls()}
            value={d.cedulaIdentidad}
            onChange={(e) => setDp({ cedulaIdentidad: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Edad</span>
          <input className={inpCls()} value={d.edad} onChange={(e) => setDp({ edad: e.target.value })} />
        </label>
        <label className="block">
          <span className={lab()}>Estado civil</span>
          <input className={inpCls()} value={d.estadoCivil} onChange={(e) => setDp({ estadoCivil: e.target.value })} />
        </label>
        <label className="block">
          <span className={lab()}>Lugar de nacimiento</span>
          <input
            className={inpCls()}
            value={d.lugarNacimiento}
            onChange={(e) => setDp({ lugarNacimiento: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>País de nacimiento</span>
          <input
            className={inpCls()}
            value={d.paisNacimiento}
            onChange={(e) => setDp({ paisNacimiento: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Fecha de nacimiento</span>
          <input
            className={inpCls()}
            value={d.fechaNacimiento}
            onChange={(e) => setDp({ fechaNacimiento: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Nacionalidad</span>
          <input
            className={inpCls()}
            value={d.nacionalidad}
            onChange={(e) => setDp({ nacionalidad: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Celular</span>
          <input className={inpCls()} value={d.celular} onChange={(e) => setDp({ celular: e.target.value })} />
        </label>
        <label className="block">
          <span className={lab()}>Tel. habitación</span>
          <input
            className={inpCls()}
            value={d.telHabitacion}
            onChange={(e) => setDp({ telHabitacion: e.target.value })}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={lab()}>Correo electrónico</span>
          <input
            className={inpCls()}
            type="email"
            value={d.correoElectronico}
            onChange={(e) => setDp({ correoElectronico: e.target.value })}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={lab()}>Dirección / domicilio</span>
          <textarea
            rows={2}
            className={inpCls()}
            value={d.direccionDomicilio}
            onChange={(e) => setDp({ direccionDomicilio: e.target.value })}
          />
        </label>
        <SiNoField label="Inscripción IVSS" value={d.inscripcionIvss} onChange={(v) => setDp({ inscripcionIvss: v })} />
        <SiNoField label="Zurdo" value={d.zurdo} onChange={(v) => setDp({ zurdo: v })} />
      </Sec>

      <Sec title="Datos de la contratación">
        <label className="block sm:col-span-2">
          <span className={lab()}>Cargo u oficio a desempeñar</span>
          <input
            className={inpCls()}
            value={value.contratacion.cargoUOficio}
            onChange={(e) => setCon(e.target.value)}
          />
        </label>
      </Sec>

      <Sec title="Certificado de antecedentes penales">
        <SiNoField
          label="Antecedentes penales"
          value={value.certificadoAntecedentesPenales.antecedentesPenales}
          onChange={(v) => setCap({ antecedentesPenales: v })}
        />
        <label className="block sm:col-span-2">
          <span className={lab()}>Expedido por</span>
          <input
            className={inpCls()}
            value={value.certificadoAntecedentesPenales.expedidoPor}
            onChange={(e) => setCap({ expedidoPor: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Lugar</span>
          <input className={inpCls()} value={value.certificadoAntecedentesPenales.lugar} onChange={(e) => setCap({ lugar: e.target.value })} />
        </label>
        <label className="block">
          <span className={lab()}>Fecha de expedición</span>
          <input
            className={inpCls()}
            value={value.certificadoAntecedentesPenales.fechaExpedicion}
            onChange={(e) => setCap({ fechaExpedicion: e.target.value })}
          />
        </label>
      </Sec>

      <Sec title="Instrucción y capacitación">
        <SiNoField label="Sabe leer" value={value.instruccionCapacitacion.sabeLeer} onChange={(v) => setIns({ sabeLeer: v })} />
        {(
          [
            ['instruccionPrimaria', 'Instrucción primaria'],
            ['instruccionSecundaria', 'Instrucción secundaria'],
            ['tecnica', 'Técnica'],
            ['superior', 'Superior'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.instruccionCapacitacion[key]}
              onChange={(e) => setIns({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <label className="block sm:col-span-2">
          <span className={lab()}>Profesión u oficio actual</span>
          <input
            className={inpCls()}
            value={value.instruccionCapacitacion.profesionUOficioActual}
            onChange={(e) => setIns({ profesionUOficioActual: e.target.value })}
          />
        </label>
      </Sec>

      <Sec title="Actividad gremial o sindical">
        <label className="block sm:col-span-2">
          <span className={lab()}>Federación / Sindicato / Gremio</span>
          <input
            className={inpCls()}
            value={value.actividadGremial.federacionSindicatoGremio}
            onChange={(e) => setGre({ federacionSindicatoGremio: e.target.value })}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={lab()}>Cargo que ejerce</span>
          <input
            className={inpCls()}
            value={value.actividadGremial.cargoQueEjerce}
            onChange={(e) => setGre({ cargoQueEjerce: e.target.value })}
          />
        </label>
      </Sec>

      <Sec title="Antecedentes médicos">
        <SiNoField
          label="Examen médico previo"
          value={value.antecedentesMedicos.examenMedicoPrevio}
          onChange={(v) => setMed({ examenMedicoPrevio: v })}
        />
        <label className="block sm:col-span-2">
          <span className={lab()}>Efectuado por</span>
          <input
            className={inpCls()}
            value={value.antecedentesMedicos.efectuadoPor}
            onChange={(e) => setMed({ efectuadoPor: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={lab()}>Tipo de sangre</span>
          <input className={inpCls()} value={value.antecedentesMedicos.tipoSangre} onChange={(e) => setMed({ tipoSangre: e.target.value })} />
        </label>
        <label className="block sm:col-span-2">
          <span className={lab()}>Enfermedades padecidas</span>
          <textarea
            rows={2}
            className={inpCls()}
            value={value.antecedentesMedicos.enfermedadesPadecidas}
            onChange={(e) => setMed({ enfermedadesPadecidas: e.target.value })}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={lab()}>Incapacidades físicas o funcionales</span>
          <textarea
            rows={2}
            className={inpCls()}
            value={value.antecedentesMedicos.incapacidadesFisicasOFuncionales}
            onChange={(e) => setMed({ incapacidadesFisicasOFuncionales: e.target.value })}
          />
        </label>
      </Sec>

      <Sec title="Peso y medidas">
        {(
          [
            ['peso', 'Peso'],
            ['estatura', 'Estatura'],
            ['tallaCamisa', 'Talla camisa'],
            ['tallaPantalon', 'Talla pantalón'],
            ['tallaBragas', 'Talla bragas'],
            ['medidaBotas', 'Medida botas'],
          ] as const
        ).map(([k, labl]) => (
          <label key={k} className="block">
            <span className={lab()}>{labl}</span>
            <input
              className={inpCls()}
              value={value.pesoMedidas[k]}
              onChange={(e) => setPm({ [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="block sm:col-span-2">
          <span className={lab()}>Observaciones peso/medidas</span>
          <textarea
            rows={2}
            className={inpCls()}
            value={value.pesoMedidas.observaciones}
            onChange={(e) => setPm({ observaciones: e.target.value })}
          />
        </label>
      </Sec>

      <Sec title="Familiares dependientes (5)">
        {value.familiaresDependientes.map((dep, i) => (
          <div key={i} className="sm:col-span-2 rounded-lg border border-slate-100 p-2 space-y-2">
            <p className="text-xs font-bold text-slate-800">Dependiente {i + 1}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                placeholder="Nombre"
                className={inpCls()}
                value={dep.nombre}
                onChange={(e) => setDep(i, { nombre: e.target.value })}
              />
              <input
                placeholder="Apellido"
                className={inpCls()}
                value={dep.apellido}
                onChange={(e) => setDep(i, { apellido: e.target.value })}
              />
              <input
                placeholder="Parentesco"
                className={inpCls()}
                value={dep.parentesco}
                onChange={(e) => setDep(i, { parentesco: e.target.value })}
              />
              <input
                placeholder="Fecha nac."
                className={inpCls()}
                value={dep.fechaNacimiento}
                onChange={(e) => setDep(i, { fechaNacimiento: e.target.value })}
              />
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  checked={dep.noAplica}
                  onChange={(e) => setDep(i, { noAplica: e.target.checked })}
                />
                No (no aplica / no informa)
              </label>
            </div>
          </div>
        ))}
      </Sec>

      <Sec title="Datos de trabajos previos (2)">
        {value.trabajosPrevios.map((t, i) => (
          <div key={i} className="sm:col-span-2 rounded-lg border border-slate-100 p-2 space-y-2">
            <p className="text-xs font-bold text-slate-800">Experiencia {i + 1}</p>
            <input
              placeholder="Empresa o patrono"
              className={inpCls()}
              value={t.empresaPatrono}
              onChange={(e) => setTp(i, { empresaPatrono: e.target.value })}
            />
            <input
              placeholder="Lugar"
              className={inpCls()}
              value={t.lugar}
              onChange={(e) => setTp(i, { lugar: e.target.value })}
            />
            <input
              placeholder="Oficio o cargo"
              className={inpCls()}
              value={t.oficioOCargo}
              onChange={(e) => setTp(i, { oficioOCargo: e.target.value })}
            />
            <input
              placeholder="Duración"
              className={inpCls()}
              value={t.duracion}
              onChange={(e) => setTp(i, { duracion: e.target.value })}
            />
            <input
              placeholder="Fecha de retiro"
              className={inpCls()}
              value={t.fechaRetiro}
              onChange={(e) => setTp(i, { fechaRetiro: e.target.value })}
            />
            <textarea
              placeholder="Motivo del retiro"
              rows={2}
              className={inpCls()}
              value={t.motivoRetiro}
              onChange={(e) => setTp(i, { motivoRetiro: e.target.value })}
            />
          </div>
        ))}
      </Sec>
    </div>
  );
}
