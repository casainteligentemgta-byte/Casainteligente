import { z } from 'zod';

const siNo = z.enum(['', 'si', 'no']);

export const familiarRowSchema = z.object({
  nombre: z.string(),
  apellido: z.string(),
  parentesco: z.string(),
  fechaNacimiento: z.string(),
  noAplica: z.boolean(),
});

export const experienciaRowSchema = z.object({
  empresa: z.string(),
  lugar: z.string(),
  cargo: z.string(),
  duracion: z.string(),
  fechaRetiro: z.string(),
  motivoRetiro: z.string(),
});

export const antecedentesSchema = z.object({
  tiene: siNo,
  expedidoPor: z.string(),
  lugar: z.string(),
  fechaExpedicion: z.string(),
});

/** Payload JSON del formulario (sin archivos; las fotos van por URL). */
export const captacionFormJsonSchema = z.object({
  primerNombre: z.string().min(1),
  segundoNombre: z.string(),
  primerApellido: z.string().min(1),
  segundoApellido: z.string(),
  cedula: z.string().min(3),
  edad: z.string(),
  estadoCivil: z.string(),
  lugarNacimiento: z.string(),
  fechaNacimiento: z.string().min(1),
  nacionalidad: z.string(),
  celular: z.string().min(5),
  correo: z.string().min(3).max(200),
  direccion: z.string().min(3),
  zurdo: z.boolean(),
  ivssInscrito: z.boolean(),
  sabeLeer: z.boolean(),
  instruccionPrimaria: z.boolean(),
  instruccionSecundaria: z.boolean(),
  instruccionTecnica: z.boolean(),
  instruccionSuperior: z.boolean(),
  profesionActual: z.string(),
  sindicatoOrganizacion: z.string(),
  sindicatoCargo: z.string(),
  antecedentes: antecedentesSchema,
  examenMedico: z.boolean(),
  tipoSangre: z.string(),
  enfermedades: z.string(),
  incapacidades: z.string(),
  peso: z.string(),
  estatura: z.string(),
  tallaCamisa: z.string(),
  tallaPantalon: z.string(),
  tallaBragas: z.string(),
  tallaBotas: z.string(),
  familiares: z.array(familiarRowSchema).max(12),
  experiencia: z.array(experienciaRowSchema).max(6),
});

export const captacionCompletarBodySchema = z.object({
  token: z.string().min(16),
  form: captacionFormJsonSchema,
  fotoPerfilUrl: z.string().min(8),
  fotoCedulaUrl: z.string().min(8),
  firma: z
    .object({
      dataUrl: z.string(),
      eventId: z.string(),
      capturedAtIso: z.string(),
    })
    .optional(),
});

export type CaptacionFormJson = z.infer<typeof captacionFormJsonSchema>;
export type CaptacionCompletarBody = z.infer<typeof captacionCompletarBodySchema>;

/** Validación por paso (UI stepper 4 pasos). */
export const captacionStep1Schema = captacionFormJsonSchema.pick({
  cedula: true,
  edad: true,
  estadoCivil: true,
  nacionalidad: true,
  direccion: true,
  correo: true,
  ivssInscrito: true,
  zurdo: true,
  antecedentes: true,
  primerNombre: true,
  segundoNombre: true,
  primerApellido: true,
  segundoApellido: true,
  lugarNacimiento: true,
  fechaNacimiento: true,
  celular: true,
});

export const captacionStep2Schema = captacionFormJsonSchema.pick({
  sabeLeer: true,
  instruccionPrimaria: true,
  instruccionSecundaria: true,
  instruccionTecnica: true,
  instruccionSuperior: true,
  profesionActual: true,
  sindicatoOrganizacion: true,
  sindicatoCargo: true,
});

export const captacionStep3Schema = captacionFormJsonSchema.pick({
  peso: true,
  estatura: true,
  tallaCamisa: true,
  tallaPantalon: true,
  tallaBragas: true,
  tallaBotas: true,
  enfermedades: true,
  incapacidades: true,
  examenMedico: true,
  tipoSangre: true,
});

export const captacionStep4Schema = z
  .object({
    familiares: z.array(familiarRowSchema).min(1),
    experiencia: z.array(experienciaRowSchema).min(2).max(6),
  })
  .refine((d) => d.experiencia.filter((r) => r.empresa.trim().length > 0).length >= 2, {
    message: 'Indica al menos dos empleos anteriores (empresa / patrono).',
  });
