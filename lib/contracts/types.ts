/**
 * Interfaz alineada con la tabla public.ci_contratos (contracts).
 */
export interface ContractData {
    id?: string;
    empleado_id: string;
    cargo_acordado: string;
    salario_base: number;
    bonificaciones: number;
    fecha_ingreso: string;
    estado: 'activo' | 'finalizado' | 'suspendido';
    pdf_url?: string | null;
    created_at?: string;
    updated_at?: string;
}

/** Datos del trabajador necesarios para renderizar la plantilla legal. */
export interface ContractWorkerData {
    nombre: string;
    cedula: string;
    telefono: string;
    direccion: string;
}

export interface ContractTemplateContext extends ContractWorkerData {
    cargo: string;
    salario_base: number;
    bonificaciones: number;
    fecha_ingreso: string;
    fecha_firma: string;
    digital_signature?: string;
    empresa: string;
}
