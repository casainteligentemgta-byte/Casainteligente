/**
 * Modelo de datos del contrato de Administración Delegada.
 * Corresponde a la tabla public.contracts.
 */
export interface ContractData {
    id?: string;

    // A. Datos del Cliente
    client_name: string;
    client_ci: string;
    client_email: string;

    // B. Condiciones Financieras
    project_cost: number;
    discount_amount: number;
    fee_percentage: number;
    monthly_min_fee: number;
    working_capital: number;
    payroll_guarantee_weeks: number;

    // C. Alcance Técnico
    substitution_target: string;
    salvage_target: string;

    // D. Plazos
    contract_deadline_months: number;

    // Persistencia
    pdf_url?: string | null;
    status?: 'borrador' | 'generado' | 'firmado' | 'caducado';
    created_at?: string;
    updated_at?: string;
}

/** Valores derivados para la plantilla legal / PDF. */
export interface ContractTemplateContext extends ContractData {
    empresa: string;
    fecha_firma: string;
    net_project_cost: number;
    estimated_fee: number;
    applicable_fee: number;
}
