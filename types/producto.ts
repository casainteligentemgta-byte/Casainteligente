/**
 * Tipos para productos. Coinciden con la tabla public.productos en Supabase.
 */
export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: string; // Supabase devuelve numeric como string
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export type ProductoInsert = Omit<Producto, 'id' | 'creado_en' | 'actualizado_en'> & {
  nombre: string;
  precio: string;
  descripcion?: string | null;
  activo?: boolean;
};

