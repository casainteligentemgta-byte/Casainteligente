/**
 * Tipos mínimos de tablas usadas por servicios tipados.
 * Ampliar cuando se regenere el schema completo de Supabase.
 */

export type CiFlotaConductoresRow = {
  id: string;
  empleado_id: string | null;
  entidad_id: string | null;
  proyecto_id: string | null;
  vehiculo_asignado_id: string | null;
  nombre_completo: string | null;
  nombres: string;
  apellidos: string;
  cedula: string | null;
  numero_cedula: string | null;
  telefono: string | null;
  email: string | null;
  tipo_licencia: string | null;
  licencia_numero: string | null;
  fecha_vencimiento_licencia: string | null;
  fecha_vencimiento_salud: string | null;
  licencia_vence: string | null;
  certificado_medico_vence: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export type CiFlotaConductoresInsert = {
  id?: string;
  empleado_id?: string | null;
  entidad_id?: string | null;
  proyecto_id?: string | null;
  vehiculo_asignado_id?: string | null;
  nombre_completo?: string | null;
  nombres?: string;
  apellidos?: string;
  cedula?: string | null;
  numero_cedula?: string | null;
  telefono?: string | null;
  email?: string | null;
  tipo_licencia?: string | null;
  licencia_numero?: string | null;
  fecha_vencimiento_licencia?: string | null;
  fecha_vencimiento_salud?: string | null;
  licencia_vence?: string | null;
  certificado_medico_vence?: string | null;
  activo?: boolean;
  notas?: string | null;
};

export type CiFlotaConductoresUpdate = Partial<CiFlotaConductoresInsert>;

export type Database = {
  public: {
    Tables: {
      ci_flota_conductores: {
        Row: CiFlotaConductoresRow;
        Insert: CiFlotaConductoresInsert;
        Update: CiFlotaConductoresUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
