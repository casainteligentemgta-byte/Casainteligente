import { z } from 'zod';

const contractEstadoSchema = z.enum(['activo', 'finalizado', 'suspendido']);

/** Esquema Zod basado en las columnas de public.ci_contratos. */
export const contractDataSchema = z.object({
    empleado_id: z.string().uuid('empleado_id debe ser un UUID válido'),
    cargo_acordado: z.string().min(1, 'cargo_acordado es requerido').max(200),
    salario_base: z.coerce.number().positive('salario_base debe ser mayor a 0'),
    bonificaciones: z.coerce.number().min(0).default(0),
    fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_ingreso debe ser YYYY-MM-DD'),
    estado: contractEstadoSchema.default('activo'),
});

export const contractWorkerSchema = z.object({
    nombre: z.string().min(1, 'nombre es requerido').max(200),
    cedula: z.string().min(1, 'cedula es requerida').max(30),
    telefono: z.string().min(1, 'telefono es requerido').max(30),
    direccion: z.string().min(1, 'direccion es requerida').max(500),
});

export const generateContractRequestSchema = contractDataSchema.merge(contractWorkerSchema).extend({
    digital_signature: z.string().max(500).optional(),
});

export type GenerateContractRequest = z.infer<typeof generateContractRequestSchema>;
