import type { SiNo } from '@/lib/talento/hojaVidaObreroCompleta';

export type FamiliarPostulacionRow = {
  nombre: string;
  apellido: string;
  parentesco: string;
  fechaNacimiento: string;
  noAplica: boolean;
  observaciones: string;
};

export type ExperienciaPostulacionRow = {
  empresa: string;
  lugar: string;
  cargo: string;
  duracion: string;
  fechaRetiro: string;
  motivoRetiro: string;
};

export type AntecedentesPenalesPostulacion = {
  tiene: SiNo;
  expedidoPor: string;
  lugar: string;
  fechaExpedicion: string;
};

export type GacetaPostulacionFormState = {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  cedula: string;
  edad: string;
  estadoCivil: string;
  lugarNacimiento: string;
  paisNacimiento: string;
  fechaNacimiento: string;
  nacionalidad: string;
  celular: string;
  correo: string;
  direccion: string;
  /** Clase de visa (si aplica). */
  visaClase: string;
  /** Validez de visa hasta (fecha o texto). */
  visaValidezHasta: string;
  zurdo: boolean;
  ivssInscrito: boolean;
  fotoPerfilFile: File | null;
  fotoCedulaFile: File | null;
  sabeLeer: boolean;
  instruccionPrimaria: boolean;
  instruccionSecundaria: boolean;
  instruccionTecnica: boolean;
  instruccionSuperior: boolean;
  profesionActual: string;
  /** Federación sindical (apartado sindicato). */
  sindicatoFederacion: string;
  /** Gremio o asociación a la que pertenece. */
  sindicatoOrganizacion: string;
  sindicatoCargo: string;
  antecedentes: AntecedentesPenalesPostulacion;
  examenMedico: boolean;
  examenMedicoEfectuadoPor: string;
  examenMedicoFecha: string;
  tipoSangre: string;
  enfermedades: string;
  incapacidades: string;
  peso: string;
  estatura: string;
  tallaCamisa: string;
  tallaPantalon: string;
  tallaBragas: string;
  tallaBotas: string;
  medidasObservaciones: string;
  familiares: FamiliarPostulacionRow[];
  experiencia: ExperienciaPostulacionRow[];
};

export function emptyFamiliarPostulacion(): FamiliarPostulacionRow {
  return { nombre: '', apellido: '', parentesco: '', fechaNacimiento: '', noAplica: false, observaciones: '' };
}

export function emptyExperienciaPostulacion(): ExperienciaPostulacionRow {
  return { empresa: '', lugar: '', cargo: '', duracion: '', fechaRetiro: '', motivoRetiro: '' };
}

export function initialGacetaPostulacionForm(): GacetaPostulacionFormState {
  return {
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    cedula: '',
    edad: '',
    estadoCivil: '',
    lugarNacimiento: '',
    paisNacimiento: '',
    fechaNacimiento: '',
    nacionalidad: '',
    celular: '',
    correo: '',
    direccion: '',
    visaClase: '',
    visaValidezHasta: '',
    zurdo: false,
    ivssInscrito: false,
    fotoPerfilFile: null,
    fotoCedulaFile: null,
    sabeLeer: true,
    instruccionPrimaria: false,
    instruccionSecundaria: false,
    instruccionTecnica: false,
    instruccionSuperior: false,
    profesionActual: '',
    sindicatoFederacion: '',
    sindicatoOrganizacion: '',
    sindicatoCargo: '',
    antecedentes: { tiene: '', expedidoPor: '', lugar: '', fechaExpedicion: '' },
    examenMedico: false,
    examenMedicoEfectuadoPor: '',
    examenMedicoFecha: '',
    tipoSangre: '',
    enfermedades: '',
    incapacidades: '',
    peso: '',
    estatura: '',
    tallaCamisa: '',
    tallaPantalon: '',
    tallaBragas: '',
    tallaBotas: '',
    medidasObservaciones: '',
    familiares: Array.from({ length: 5 }, () => emptyFamiliarPostulacion()),
    experiencia: [emptyExperienciaPostulacion(), emptyExperienciaPostulacion()],
  };
}
