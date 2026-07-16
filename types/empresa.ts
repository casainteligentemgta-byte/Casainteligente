/**
 * Tipos para empresas (clientes jurídicos). Coinciden con public.empresas en Supabase.
 * Ver: supabase/migrations/008_empresas.sql
 */
export interface Empresa {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  rif: string | null;
  notas: string | null;
  creado_en: string;
  actualizado_en: string;
}
