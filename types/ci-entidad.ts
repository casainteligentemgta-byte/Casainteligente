/** Fila de `public.ci_entidades` (entidad de trabajo / patrono). */
export type CiEntidad = {
  id: string;
  nombre: string;
  rif: string | null;
  notas: string | null;
  created_at?: string;
  updated_at?: string;
};
