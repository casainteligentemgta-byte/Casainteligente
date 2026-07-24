/** Filas para vista previa (UI) alineadas al formulario legal. */

export type FilaVistaLegal = { seccion: string; id: string; etiqueta: string };

export const HOJA_VIDA_LEGAL_VISTA_FILAS: FilaVistaLegal[] = [
  { seccion: 'I. Datos personales', id: 'fotoUrl', etiqueta: 'Foto' },
  { seccion: 'I. Datos personales', id: 'fotoCedulaUrl', etiqueta: 'Foto cédula' },
  { seccion: 'I. Datos personales', id: 'primerNombre', etiqueta: 'Primer nombre' },
  { seccion: 'I. Datos personales', id: 'segundoNombre', etiqueta: 'Segundo nombre' },
  { seccion: 'I. Datos personales', id: 'primerApellido', etiqueta: 'Primer apellido' },
  { seccion: 'I. Datos personales', id: 'segundoApellido', etiqueta: 'Segundo apellido' },
  { seccion: 'I. Datos personales', id: 'cedulaIdentidad', etiqueta: 'Cédula de identidad' },
  { seccion: 'I. Datos personales', id: 'edad', etiqueta: 'Edad' },
  { seccion: 'I. Datos personales', id: 'estadoCivil', etiqueta: 'Estado civil' },
  { seccion: 'I. Datos personales', id: 'lugarNacimiento', etiqueta: 'Lugar de nacimiento' },
  { seccion: 'I. Datos personales', id: 'paisNacimiento', etiqueta: 'País de nacimiento' },
  { seccion: 'I. Datos personales', id: 'fechaNacimiento', etiqueta: 'Fecha de nacimiento' },
  { seccion: 'I. Datos personales', id: 'nacionalidad', etiqueta: 'Nacionalidad' },
  { seccion: 'I. Datos personales', id: 'celular', etiqueta: 'Celular' },
  { seccion: 'I. Datos personales', id: 'telHabitacion', etiqueta: 'Tel. habitación' },
  { seccion: 'I. Datos personales', id: 'correoElectronico', etiqueta: 'Correo electrónico' },
  { seccion: 'I. Datos personales', id: 'direccionDomicilio', etiqueta: 'Dirección / domicilio' },
  { seccion: 'I. Datos personales', id: 'inscripcionIvss', etiqueta: 'Inscripción IVSS' },
  { seccion: 'I. Datos personales', id: 'zurdo', etiqueta: 'Zurdo' },
  { seccion: 'I. Datos personales', id: 'claseVisa', etiqueta: 'Clase de visa' },
  { seccion: 'I. Datos personales', id: 'visaValidezHasta', etiqueta: 'Validez visa hasta' },
  { seccion: 'Contratación', id: 'cargoUOficio', etiqueta: 'Cargo u oficio a desempeñar' },
  { seccion: 'Antecedentes penales', id: 'antecedentesPenales', etiqueta: 'Antecedentes penales' },
  { seccion: 'Antecedentes penales', id: 'expedidoPor', etiqueta: 'Expedido por' },
  { seccion: 'Antecedentes penales', id: 'lugarCap', etiqueta: 'Lugar' },
  { seccion: 'Antecedentes penales', id: 'fechaExpedicion', etiqueta: 'Fecha de expedición' },
  { seccion: 'Instrucción', id: 'sabeLeer', etiqueta: 'Sabe leer' },
  { seccion: 'Instrucción', id: 'instruccionPrimaria', etiqueta: 'Instrucción primaria' },
  { seccion: 'Instrucción', id: 'instruccionSecundaria', etiqueta: 'Instrucción secundaria' },
  { seccion: 'Instrucción', id: 'tecnica', etiqueta: 'Técnica' },
  { seccion: 'Instrucción', id: 'superior', etiqueta: 'Superior' },
  { seccion: 'Instrucción', id: 'profesionUOficioActual', etiqueta: 'Profesión u oficio actual' },
  { seccion: 'Gremial', id: 'federacionSindicatoGremio', etiqueta: 'Federación / Sindicato / Gremio' },
  { seccion: 'Gremial', id: 'cargoQueEjerce', etiqueta: 'Cargo que ejerce' },
  { seccion: 'Médicos', id: 'examenMedicoPrevio', etiqueta: 'Examen médico previo' },
  { seccion: 'Médicos', id: 'efectuadoPor', etiqueta: 'Efectuado por' },
  { seccion: 'Médicos', id: 'fechaExamenMedico', etiqueta: 'Fecha del examen médico' },
  { seccion: 'Médicos', id: 'tipoSangre', etiqueta: 'Tipo de sangre' },
  { seccion: 'Médicos', id: 'enfermedadesPadecidas', etiqueta: 'Enfermedades padecidas' },
  { seccion: 'Médicos', id: 'incapacidadesFisicasOFuncionales', etiqueta: 'Incapacidades físicas o funcionales' },
  { seccion: 'Peso y medidas', id: 'peso', etiqueta: 'Peso' },
  { seccion: 'Peso y medidas', id: 'estatura', etiqueta: 'Estatura' },
  { seccion: 'Peso y medidas', id: 'tallaCamisa', etiqueta: 'Talla camisa' },
  { seccion: 'Peso y medidas', id: 'tallaPantalon', etiqueta: 'Talla pantalón' },
  { seccion: 'Peso y medidas', id: 'tallaBragas', etiqueta: 'Talla bragas' },
  { seccion: 'Peso y medidas', id: 'medidaBotas', etiqueta: 'Medida botas' },
  { seccion: 'Peso y medidas', id: 'observacionesMedidas', etiqueta: 'Observaciones peso/medidas' },
];

export function valorVistaLegal(
  id: string,
  h: import('@/lib/talento/hojaVidaObreroCompleta').HojaVidaObreroCompleta,
): string {
  const d = h.datosPersonales;
  const map: Record<string, string> = {
    fotoUrl: d.fotoUrl,
    fotoCedulaUrl: d.fotoCedulaUrl,
    primerNombre: d.primerNombre,
    segundoNombre: d.segundoNombre,
    primerApellido: d.primerApellido,
    segundoApellido: d.segundoApellido,
    cedulaIdentidad: d.cedulaIdentidad,
    edad: d.edad,
    estadoCivil: d.estadoCivil,
    lugarNacimiento: d.lugarNacimiento,
    paisNacimiento: d.paisNacimiento,
    fechaNacimiento: d.fechaNacimiento,
    nacionalidad: d.nacionalidad,
    celular: d.celular,
    telHabitacion: d.telHabitacion,
    correoElectronico: d.correoElectronico,
    direccionDomicilio: d.direccionDomicilio,
    inscripcionIvss: d.inscripcionIvss === 'si' ? 'Sí' : d.inscripcionIvss === 'no' ? 'No' : '',
    zurdo: d.zurdo === 'si' ? 'Sí' : d.zurdo === 'no' ? 'No' : '',
    claseVisa: d.claseVisa,
    visaValidezHasta: d.visaValidezHasta,
    cargoUOficio: h.contratacion.cargoUOficio,
    antecedentesPenales:
      h.certificadoAntecedentesPenales.antecedentesPenales === 'si'
        ? 'Sí'
        : h.certificadoAntecedentesPenales.antecedentesPenales === 'no'
          ? 'No'
          : '',
    expedidoPor: h.certificadoAntecedentesPenales.expedidoPor,
    lugarCap: h.certificadoAntecedentesPenales.lugar,
    fechaExpedicion: h.certificadoAntecedentesPenales.fechaExpedicion,
    sabeLeer:
      h.instruccionCapacitacion.sabeLeer === 'si' ? 'Sí' : h.instruccionCapacitacion.sabeLeer === 'no' ? 'No' : '',
    instruccionPrimaria: h.instruccionCapacitacion.instruccionPrimaria ? 'Sí' : 'No',
    instruccionSecundaria: h.instruccionCapacitacion.instruccionSecundaria ? 'Sí' : 'No',
    tecnica: h.instruccionCapacitacion.tecnica ? 'Sí' : 'No',
    superior: h.instruccionCapacitacion.superior ? 'Sí' : 'No',
    profesionUOficioActual: h.instruccionCapacitacion.profesionUOficioActual,
    federacionSindicatoGremio: h.actividadGremial.federacionSindicatoGremio,
    cargoQueEjerce: h.actividadGremial.cargoQueEjerce,
    examenMedicoPrevio:
      h.antecedentesMedicos.examenMedicoPrevio === 'si'
        ? 'Sí'
        : h.antecedentesMedicos.examenMedicoPrevio === 'no'
          ? 'No'
          : '',
    efectuadoPor: h.antecedentesMedicos.efectuadoPor,
    fechaExamenMedico: h.antecedentesMedicos.fechaExamenMedico,
    tipoSangre: h.antecedentesMedicos.tipoSangre,
    enfermedadesPadecidas: h.antecedentesMedicos.enfermedadesPadecidas,
    incapacidadesFisicasOFuncionales: h.antecedentesMedicos.incapacidadesFisicasOFuncionales,
    peso: h.pesoMedidas.peso,
    estatura: h.pesoMedidas.estatura,
    tallaCamisa: h.pesoMedidas.tallaCamisa,
    tallaPantalon: h.pesoMedidas.tallaPantalon,
    tallaBragas: h.pesoMedidas.tallaBragas,
    medidaBotas: h.pesoMedidas.medidaBotas,
    observacionesMedidas: h.pesoMedidas.observaciones,
  };
  return (map[id] ?? '').trim();
}
