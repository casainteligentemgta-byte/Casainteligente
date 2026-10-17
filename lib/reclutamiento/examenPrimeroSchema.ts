import { z } from 'zod';
import { parseCedulaHv, parseCelularVe } from '@/lib/registro/catalogosHojaVidaVe';

/** Datos mínimos para abrir el expediente y la evaluación (vacantes con examen primero). */
export const datosBasicosExamenPrimeroSchema = z.object({
  token: z.string().min(16),
  primerNombre: z.string().trim().min(1, 'Indica tu primer nombre.').max(60),
  primerApellido: z.string().trim().min(1, 'Indica tu primer apellido.').max(60),
  cedula: z
    .string()
    .trim()
    .refine((v) => parseCedulaHv(v).numero.length >= 6, 'Indica la cédula (V o E y el número).'),
  celular: z
    .string()
    .trim()
    .refine((v) => parseCelularVe(v).numero.length === 7, 'Indica el celular con prefijo y 7 dígitos.'),
  correo: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'El correo no es válido.')
    .optional()
    .default(''),
});
