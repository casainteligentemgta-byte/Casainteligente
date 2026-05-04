import type { HojaVidaObreroCompleta, SiNo } from '@/lib/talento/hojaVidaObreroCompleta';
import type { GacetaPostulacionFormState } from '@/lib/registro/gacetaPostulacionTypes';

function siNo(v: boolean | SiNo): SiNo {
  if (v === true) return 'si';
  if (v === false) return 'no';
  return v || '';
}

export function buildHojaVidaFromGacetaForm(
  f: GacetaPostulacionFormState,
  urls: { fotoPerfil: string; fotoCedula: string },
  cargoLabel: string,
): HojaVidaObreroCompleta {
  return {
    datosPersonales: {
      fotoUrl: urls.fotoPerfil,
      fotoCedulaUrl: urls.fotoCedula,
      primerNombre: f.primerNombre.trim(),
      segundoNombre: f.segundoNombre.trim(),
      primerApellido: f.primerApellido.trim(),
      segundoApellido: f.segundoApellido.trim(),
      cedulaIdentidad: f.cedula.trim(),
      edad: f.edad.trim(),
      estadoCivil: f.estadoCivil.trim(),
      lugarNacimiento: f.lugarNacimiento.trim(),
      paisNacimiento: '',
      fechaNacimiento: f.fechaNacimiento.trim(),
      nacionalidad: f.nacionalidad.trim(),
      celular: f.celular.trim(),
      telHabitacion: '',
      correoElectronico: f.correo.trim(),
      direccionDomicilio: f.direccion.trim(),
      inscripcionIvss: siNo(f.ivssInscrito),
      zurdo: siNo(f.zurdo),
    },
    contratacion: {
      cargoUOficio: cargoLabel.trim(),
    },
    certificadoAntecedentesPenales: {
      antecedentesPenales: f.antecedentes.tiene || '',
      expedidoPor: f.antecedentes.expedidoPor.trim(),
      lugar: f.antecedentes.lugar.trim(),
      fechaExpedicion: f.antecedentes.fechaExpedicion.trim(),
    },
    instruccionCapacitacion: {
      sabeLeer: f.sabeLeer ? 'si' : 'no',
      instruccionPrimaria: f.instruccionPrimaria,
      instruccionSecundaria: f.instruccionSecundaria,
      tecnica: f.instruccionTecnica,
      superior: f.instruccionSuperior,
      profesionUOficioActual: f.profesionActual.trim(),
    },
    actividadGremial: {
      federacionSindicatoGremio: f.sindicatoOrganizacion.trim(),
      cargoQueEjerce: f.sindicatoCargo.trim(),
    },
    antecedentesMedicos: {
      examenMedicoPrevio: f.examenMedico ? 'si' : 'no',
      efectuadoPor: '',
      tipoSangre: f.tipoSangre.trim(),
      enfermedadesPadecidas: f.enfermedades.trim(),
      incapacidadesFisicasOFuncionales: f.incapacidades.trim(),
    },
    pesoMedidas: {
      peso: f.peso.trim(),
      estatura: f.estatura.trim(),
      tallaCamisa: f.tallaCamisa.trim(),
      tallaPantalon: f.tallaPantalon.trim(),
      tallaBragas: f.tallaBragas.trim(),
      medidaBotas: f.tallaBotas.trim(),
      observaciones: '',
    },
    familiaresDependientes: f.familiares.map((r) => ({
      nombre: r.nombre.trim(),
      apellido: r.apellido.trim(),
      parentesco: r.parentesco.trim(),
      fechaNacimiento: r.fechaNacimiento.trim(),
      noAplica: r.noAplica,
    })),
    trabajosPrevios: f.experiencia.map((r) => ({
      empresaPatrono: r.empresa.trim(),
      lugar: r.lugar.trim(),
      oficioOCargo: r.cargo.trim(),
      duracion: r.duracion.trim(),
      fechaRetiro: r.fechaRetiro.trim(),
      motivoRetiro: r.motivoRetiro.trim(),
    })),
  };
}

export function antecedentesPenalesJson(f: GacetaPostulacionFormState): Record<string, unknown> {
  return {
    tiene: f.antecedentes.tiene || null,
    expedidoPor: f.antecedentes.expedidoPor.trim() || null,
    lugar: f.antecedentes.lugar.trim() || null,
    fechaExpedicion: f.antecedentes.fechaExpedicion.trim() || null,
  };
}
