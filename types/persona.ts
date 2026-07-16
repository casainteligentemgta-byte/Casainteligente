/**
 * Tipos para personas (clientes físicos). Coinciden con public.personas en Supabase.
 */
export interface Persona {
  id: string;
  nombre: string;
  apellidos: string | null;
  documento: string | null;
  direccion: string | null;
  ciudad: string | null;
  codigo_postal: string | null;
  telefono: string | null;
  email: string | null;
  creado_en: string;
  actualizado_en: string;
}
