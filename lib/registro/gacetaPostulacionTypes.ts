import type { SiNo } from '@/lib/talento/hojaVidaObreroCompleta';

export type FamiliarPostulacionRow = {
  nombre: string;
  apellido: string;
  parentesco: string;
  fechaNacimiento: string;
  noAplica: boolean;
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
  fechaNacimiento: string;
  nacionalidad: string;
  celular: string;
  correo: string;
  direccion: string;
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
  /** Actividad gremial / sindical (planilla Gaceta). */
  sindicatoOrganizacion: string;
  sindicatoCargo: string;
  antecedentes: AntecedentesPenalesPostulacion;
  examenMedico: boolean;
  tipoSangre: string;
  enfermedades: string;
  incapacidades: string;
  peso: string;
  estatura: string;
  tallaCamisa: string;
  tallaPantalon: string;
  tallaBragas: string;
  tallaBotas: string;
  familiares: FamiliarPostulacionRow[];
  experiencia: ExperienciaPostulacionRow[];
};

export function emptyFamiliarPostulacion(): FamiliarPostulacionRow {
  return { nombre: '', apellido: '', parentesco: '', fechaNacimiento: '', noAplica: false };
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
    fechaNacimiento: '',
    nacionalidad: '',
    celular: '',
    correo: '',
    direccion: '',
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
    sindicatoOrganizacion: '',
    sindicatoCargo: '',
    antecedentes: { tiene: '', expedidoPor: '', lugar: '', fechaExpedicion: '' },
    examenMedico: false,
    tipoSangre: '',
    enfermedades: '',
    incapacidades: '',
    peso: '',
    estatura: '',
    tallaCamisa: '',
    tallaPantalon: '',
    tallaBragas: '',
    tallaBotas: '',
    familiares: [emptyFamiliarPostulacion()],
    experiencia: [emptyExperienciaPostulacion(), emptyExperienciaPostulacion()],
  };
}
