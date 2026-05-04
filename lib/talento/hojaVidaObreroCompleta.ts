/**
 * Hoja de vida del obrero — esquema legal (I. Identificación del trabajador, etc.).
 * Se persiste en `ci_empleados.hoja_vida_obrero` (jsonb) y se refleja en el PDF.
 */

export type SiNo = '' | 'si' | 'no';

export type FamiliarDependiente = {
  nombre: string;
  apellido: string;
  parentesco: string;
  fechaNacimiento: string;
  /** Marca “No” del formulario físico (no aplica / no informa). */
  noAplica: boolean;
  observaciones: string;
};

export type TrabajoPrevio = {
  empresaPatrono: string;
  lugar: string;
  oficioOCargo: string;
  duracion: string;
  fechaRetiro: string;
  motivoRetiro: string;
};

export type HojaVidaObreroCompleta = {
  datosPersonales: {
    fotoUrl: string;
    fotoCedulaUrl: string;
    primerNombre: string;
    segundoNombre: string;
    primerApellido: string;
    segundoApellido: string;
    cedulaIdentidad: string;
    edad: string;
    estadoCivil: string;
    lugarNacimiento: string;
    paisNacimiento: string;
    fechaNacimiento: string;
    nacionalidad: string;
    celular: string;
    telHabitacion: string;
    correoElectronico: string;
    direccionDomicilio: string;
    inscripcionIvss: SiNo;
    zurdo: SiNo;
    claseVisa: string;
    visaValidezHasta: string;
  };
  contratacion: {
    cargoUOficio: string;
  };
  certificadoAntecedentesPenales: {
    antecedentesPenales: SiNo;
    expedidoPor: string;
    lugar: string;
    fechaExpedicion: string;
  };
  instruccionCapacitacion: {
    sabeLeer: SiNo;
    instruccionPrimaria: boolean;
    instruccionSecundaria: boolean;
    tecnica: boolean;
    superior: boolean;
    profesionUOficioActual: string;
  };
  actividadGremial: {
    federacionSindicatoGremio: string;
    cargoQueEjerce: string;
  };
  antecedentesMedicos: {
    examenMedicoPrevio: SiNo;
    efectuadoPor: string;
    fechaExamenMedico: string;
    tipoSangre: string;
    enfermedadesPadecidas: string;
    incapacidadesFisicasOFuncionales: string;
  };
  pesoMedidas: {
    peso: string;
    estatura: string;
    tallaCamisa: string;
    tallaPantalon: string;
    tallaBragas: string;
    medidaBotas: string;
    observaciones: string;
  };
  familiaresDependientes: FamiliarDependiente[];
  trabajosPrevios: TrabajoPrevio[];
};

export function emptyFamiliar(): FamiliarDependiente {
  return { nombre: '', apellido: '', parentesco: '', fechaNacimiento: '', noAplica: false, observaciones: '' };
}

export function emptyTrabajoPrevio(): TrabajoPrevio {
  return {
    empresaPatrono: '',
    lugar: '',
    oficioOCargo: '',
    duracion: '',
    fechaRetiro: '',
    motivoRetiro: '',
  };
}

export function emptyHojaVidaObreroCompleta(): HojaVidaObreroCompleta {
  return {
    datosPersonales: {
      fotoUrl: '',
      fotoCedulaUrl: '',
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      cedulaIdentidad: '',
      edad: '',
      estadoCivil: '',
      lugarNacimiento: '',
      paisNacimiento: '',
      fechaNacimiento: '',
      nacionalidad: '',
      celular: '',
      telHabitacion: '',
      correoElectronico: '',
      direccionDomicilio: '',
      inscripcionIvss: '',
      zurdo: '',
      claseVisa: '',
      visaValidezHasta: '',
    },
    contratacion: { cargoUOficio: '' },
    certificadoAntecedentesPenales: {
      antecedentesPenales: '',
      expedidoPor: '',
      lugar: '',
      fechaExpedicion: '',
    },
    instruccionCapacitacion: {
      sabeLeer: '',
      instruccionPrimaria: false,
      instruccionSecundaria: false,
      tecnica: false,
      superior: false,
      profesionUOficioActual: '',
    },
    actividadGremial: { federacionSindicatoGremio: '', cargoQueEjerce: '' },
    antecedentesMedicos: {
      examenMedicoPrevio: '',
      efectuadoPor: '',
      fechaExamenMedico: '',
      tipoSangre: '',
      enfermedadesPadecidas: '',
      incapacidadesFisicasOFuncionales: '',
    },
    pesoMedidas: {
      peso: '',
      estatura: '',
      tallaCamisa: '',
      tallaPantalon: '',
      tallaBragas: '',
      medidaBotas: '',
      observaciones: '',
    },
    familiaresDependientes: Array.from({ length: 5 }, () => emptyFamiliar()),
    trabajosPrevios: Array.from({ length: 2 }, () => emptyTrabajoPrevio()),
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

function mergeSiNo(x: unknown): SiNo {
  if (x === 'si' || x === 'no') return x;
  return '';
}

/** Combina json guardado con plantilla vacía (campos nuevos sin undefined). */
export function parseHojaVidaObreroJson(raw: unknown): HojaVidaObreroCompleta {
  const base = emptyHojaVidaObreroCompleta();
  if (!isRecord(raw)) return base;

  const dp = isRecord(raw.datosPersonales) ? raw.datosPersonales : {};
  const datosPersonales = {
    ...base.datosPersonales,
    fotoUrl: String(dp.fotoUrl ?? base.datosPersonales.fotoUrl),
    fotoCedulaUrl: String(dp.fotoCedulaUrl ?? base.datosPersonales.fotoCedulaUrl),
    primerNombre: String(dp.primerNombre ?? ''),
    segundoNombre: String(dp.segundoNombre ?? ''),
    primerApellido: String(dp.primerApellido ?? ''),
    segundoApellido: String(dp.segundoApellido ?? ''),
    cedulaIdentidad: String(dp.cedulaIdentidad ?? ''),
    edad: String(dp.edad ?? ''),
    estadoCivil: String(dp.estadoCivil ?? ''),
    lugarNacimiento: String(dp.lugarNacimiento ?? ''),
    paisNacimiento: String(dp.paisNacimiento ?? ''),
    fechaNacimiento: String(dp.fechaNacimiento ?? ''),
    nacionalidad: String(dp.nacionalidad ?? ''),
    celular: String(dp.celular ?? ''),
    telHabitacion: String(dp.telHabitacion ?? ''),
    correoElectronico: String(dp.correoElectronico ?? ''),
    direccionDomicilio: String(dp.direccionDomicilio ?? ''),
    inscripcionIvss: mergeSiNo(dp.inscripcionIvss),
    zurdo: mergeSiNo(dp.zurdo),
    claseVisa: String(dp.claseVisa ?? ''),
    visaValidezHasta: String(dp.visaValidezHasta ?? ''),
  };

  const con = isRecord(raw.contratacion) ? raw.contratacion : {};
  const contratacion = {
    cargoUOficio: String(con.cargoUOficio ?? base.contratacion.cargoUOficio),
  };

  const cap = isRecord(raw.certificadoAntecedentesPenales) ? raw.certificadoAntecedentesPenales : {};
  const certificadoAntecedentesPenales = {
    antecedentesPenales: mergeSiNo(cap.antecedentesPenales),
    expedidoPor: String(cap.expedidoPor ?? ''),
    lugar: String(cap.lugar ?? ''),
    fechaExpedicion: String(cap.fechaExpedicion ?? ''),
  };

  const ins = isRecord(raw.instruccionCapacitacion) ? raw.instruccionCapacitacion : {};
  const instruccionCapacitacion = {
    sabeLeer: mergeSiNo(ins.sabeLeer),
    instruccionPrimaria: Boolean(ins.instruccionPrimaria),
    instruccionSecundaria: Boolean(ins.instruccionSecundaria),
    tecnica: Boolean(ins.tecnica),
    superior: Boolean(ins.superior),
    profesionUOficioActual: String(ins.profesionUOficioActual ?? ''),
  };

  const ag = isRecord(raw.actividadGremial) ? raw.actividadGremial : {};
  const actividadGremial = {
    federacionSindicatoGremio: String(ag.federacionSindicatoGremio ?? ''),
    cargoQueEjerce: String(ag.cargoQueEjerce ?? ''),
  };

  const am = isRecord(raw.antecedentesMedicos) ? raw.antecedentesMedicos : {};
  const antecedentesMedicos = {
    examenMedicoPrevio: mergeSiNo(am.examenMedicoPrevio),
    efectuadoPor: String(am.efectuadoPor ?? ''),
    fechaExamenMedico: String(am.fechaExamenMedico ?? ''),
    tipoSangre: String(am.tipoSangre ?? ''),
    enfermedadesPadecidas: String(am.enfermedadesPadecidas ?? ''),
    incapacidadesFisicasOFuncionales: String(am.incapacidadesFisicasOFuncionales ?? ''),
  };

  const pm = isRecord(raw.pesoMedidas) ? raw.pesoMedidas : {};
  const pesoMedidas = {
    peso: String(pm.peso ?? ''),
    estatura: String(pm.estatura ?? ''),
    tallaCamisa: String(pm.tallaCamisa ?? ''),
    tallaPantalon: String(pm.tallaPantalon ?? ''),
    tallaBragas: String(pm.tallaBragas ?? ''),
    medidaBotas: String(pm.medidaBotas ?? ''),
    observaciones: String(pm.observaciones ?? ''),
  };

  const famRaw = Array.isArray(raw.familiaresDependientes) ? raw.familiaresDependientes : [];
  const familiaresDependientes = base.familiaresDependientes.map((slot, i) => {
    const fr = isRecord(famRaw[i]) ? famRaw[i] : {};
    return {
      nombre: String(fr.nombre ?? ''),
      apellido: String(fr.apellido ?? ''),
      parentesco: String(fr.parentesco ?? ''),
      fechaNacimiento: String(fr.fechaNacimiento ?? ''),
      noAplica: Boolean(fr.noAplica),
      observaciones: String(fr.observaciones ?? ''),
    };
  });

  const tpRaw = Array.isArray(raw.trabajosPrevios) ? raw.trabajosPrevios : [];
  const trabajosPrevios = base.trabajosPrevios.map((slot, i) => {
    const tr = isRecord(tpRaw[i]) ? tpRaw[i] : {};
    return {
      empresaPatrono: String(tr.empresaPatrono ?? ''),
      lugar: String(tr.lugar ?? ''),
      oficioOCargo: String(tr.oficioOCargo ?? ''),
      duracion: String(tr.duracion ?? ''),
      fechaRetiro: String(tr.fechaRetiro ?? ''),
      motivoRetiro: String(tr.motivoRetiro ?? ''),
    };
  });

  return {
    datosPersonales,
    contratacion,
    certificadoAntecedentesPenales,
    instruccionCapacitacion,
    actividadGremial,
    antecedentesMedicos,
    pesoMedidas,
    familiaresDependientes,
    trabajosPrevios,
  };
}

export function nombreCompletoDesde(h: HojaVidaObreroCompleta): string {
  const p = [
    h.datosPersonales.primerNombre,
    h.datosPersonales.segundoNombre,
    h.datosPersonales.primerApellido,
    h.datosPersonales.segundoApellido,
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return p.join(' ').trim();
}

/** Une fila `ci_empleados` (columnas legacy + jsonb) al modelo completo. */
export function hojaVidaDesdeRow(row: Record<string, unknown>): HojaVidaObreroCompleta {
  const fromJson = parseHojaVidaObreroJson(row.hoja_vida_obrero);
  const str = (k: string) => String(row[k] ?? '').trim();

  if (!fromJson.datosPersonales.cedulaIdentidad && str('cedula')) {
    fromJson.datosPersonales.cedulaIdentidad = str('cedula');
  }
  if (!fromJson.datosPersonales.cedulaIdentidad && str('documento')) {
    fromJson.datosPersonales.cedulaIdentidad = str('documento');
  }
  if (!fromJson.datosPersonales.correoElectronico && str('email')) {
    fromJson.datosPersonales.correoElectronico = str('email');
  }
  if (!fromJson.datosPersonales.celular && str('telefono')) {
    fromJson.datosPersonales.celular = str('telefono');
  }
  if (!fromJson.datosPersonales.fechaNacimiento && str('fecha_nacimiento')) {
    fromJson.datosPersonales.fechaNacimiento = str('fecha_nacimiento');
  }
  if (!fromJson.datosPersonales.direccionDomicilio && str('direccion_habitacion')) {
    fromJson.datosPersonales.direccionDomicilio = str('direccion_habitacion');
  }
  const ciudad = str('ciudad_estado');
  if (ciudad && !fromJson.datosPersonales.lugarNacimiento) {
    fromJson.datosPersonales.lugarNacimiento = ciudad;
  }
  if (!fromJson.datosPersonales.fotoCedulaUrl && str('cedula_foto_url')) {
    fromJson.datosPersonales.fotoCedulaUrl = str('cedula_foto_url');
  }
  if (!fromJson.pesoMedidas.tallaCamisa && str('talla_camisa')) {
    fromJson.pesoMedidas.tallaCamisa = str('talla_camisa');
  }
  if (!fromJson.pesoMedidas.medidaBotas && str('talla_botas')) {
    fromJson.pesoMedidas.medidaBotas = str('talla_botas');
  }
  if (!fromJson.antecedentesMedicos.tipoSangre && str('grupo_sanguineo')) {
    fromJson.antecedentesMedicos.tipoSangre = str('grupo_sanguineo');
  }
  if (!fromJson.antecedentesMedicos.enfermedadesPadecidas && str('alergias_notas')) {
    fromJson.antecedentesMedicos.enfermedadesPadecidas = str('alergias_notas');
  }
  if (!fromJson.contratacion.cargoUOficio && str('rol_buscado')) {
    fromJson.contratacion.cargoUOficio = str('rol_buscado');
  }

  const nom = str('nombre_completo');
  if (nom && !fromJson.datosPersonales.primerNombre) {
    const parts = nom.split(/\s+/).filter(Boolean);
    if (parts.length >= 1) fromJson.datosPersonales.primerNombre = parts[0] ?? '';
    if (parts.length >= 2) fromJson.datosPersonales.primerApellido = parts[parts.length - 1] ?? '';
    if (parts.length >= 3) {
      fromJson.datosPersonales.segundoNombre = parts.slice(1, -1).join(' ') || '';
    }
  }

  const fp = str('foto_perfil_url');
  if (fp && !fromJson.datosPersonales.fotoUrl.trim()) {
    fromJson.datosPersonales.fotoUrl = fp;
  }

  const famCol = row.familiares;
  if (Array.isArray(famCol) && famCol.length > 0) {
    const mapped: FamiliarDependiente[] = [];
    for (const item of famCol) {
      if (!isRecord(item)) continue;
      const nombre = String(item.nombre ?? '').trim();
      const apellido = String(item.apellido ?? '').trim();
      const parentesco = String(item.parentesco ?? '').trim();
      const fechaNacimiento = String(item.fecha_nacimiento ?? item.fechaNacimiento ?? '').trim();
      const noAplica = Boolean(item.no_aplica ?? item.noAplica);
      if (!nombre && !apellido && !parentesco) continue;
      const observaciones = String(item.observaciones ?? '').trim();
      mapped.push({ nombre, apellido, parentesco, fechaNacimiento, noAplica, observaciones });
    }
    if (mapped.length) {
      fromJson.familiaresDependientes = mapped;
    }
  }

  const expCol = row.experiencia_previa;
  if (Array.isArray(expCol) && expCol.length > 0) {
    const mapped: TrabajoPrevio[] = [];
    for (const item of expCol) {
      if (!isRecord(item)) continue;
      const empresaPatrono = String(item.empresa ?? item.empresaPatrono ?? '').trim();
      const lugar = String(item.lugar ?? '').trim();
      const oficioOCargo = String(item.cargo ?? item.oficioOCargo ?? '').trim();
      const duracion = String(item.duracion ?? '').trim();
      const fechaRetiro = String(item.fecha_retiro ?? item.fechaRetiro ?? '').trim();
      const motivoRetiro = String(item.motivo_retiro ?? item.motivoRetiro ?? '').trim();
      if (!empresaPatrono && !oficioOCargo) continue;
      mapped.push({ empresaPatrono, lugar, oficioOCargo, duracion, fechaRetiro, motivoRetiro });
    }
    if (mapped.length) {
      fromJson.trabajosPrevios = mapped;
    }
  }

  return fromJson;
}

export function etiquetaSiNo(v: SiNo): string {
  if (v === 'si') return 'Sí';
  if (v === 'no') return 'No';
  return '—';
}
