/**
 * Tipos para empresas. Coinciden con la tabla public.empresas en Supabase.
 */
export interface Empresa {
  id: string;
  nombre: string;
  cif: string | null;
  direccion: string | null;
  ciudad: string | null;
  codigo_postal: string | null;
  telefono: string | null;
  email: string | null;
  creado_en: string;
  actualizado_en: string;
}

export type EmpresaInsert = Omit<Empresa, 'id' | 'creado_en' | 'actualizado_en'> & {
  nombre: string;
  cif?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  codigo_postal?: string | null;
  telefono?: string | null;
  email?: string | null;
};
