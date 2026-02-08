/**
 * Tipos para dispositivos de la casa inteligente.
 * Deben coincidir con la tabla public.dispositivos en Supabase.
 */
export type TipoDispositivo =
  | 'luz'
  | 'termostato'
  | 'sensor'
  | 'enchufe'
  | 'cortina'
  | 'otro';

export interface Dispositivo {
  id: string;
  nombre: string;
  tipo: TipoDispositivo;
  habitacion: string | null;
  encendido: boolean;
  creado_en: string;
  actualizado_en: string;
}
