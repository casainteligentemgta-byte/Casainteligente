import { z } from 'zod';

/** Esquema Zod del cuestionario de Administración Delegada (tabla contracts). */
export const generateContractRequestSchema = z.object({
    // A. Datos del Cliente
    client_name: z.string().min(1, 'Nombre del cliente es requerido').max(200),
    client_ci: z.string().min(1, 'Cédula es requerida').max(30),
    client_email: z.string().email('Correo electrónico inválido').max(200),

    // B. Condiciones Financieras
    project_cost: z.coerce.number().positive('project_cost debe ser mayor a 0'),
    discount_amount: z.coerce.number().min(0).default(0),
    fee_percentage: z.coerce.number().min(0).max(100, 'fee_percentage debe estar entre 0 y 100'),
    monthly_min_fee: z.coerce.number().min(0),
    working_capital: z.coerce.number().min(0),
    payroll_guarantee_weeks: z.coerce.number().int().min(0),

    // C. Alcance Técnico
    substitution_target: z.string().min(1, 'Elementos a sustituir son requeridos').max(1000),
    salvage_target: z.string().min(1, 'Elementos a salvar son requeridos').max(1000),

    // D. Plazos
    contract_deadline_months: z.coerce
        .number()
        .int()
        .positive('contract_deadline_months debe ser al menos 1'),
}).superRefine((data, ctx) => {
    if (data.discount_amount > data.project_cost) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'discount_amount no puede superar project_cost',
            path: ['discount_amount'],
        });
    }
});

export type GenerateContractRequest = z.infer<typeof generateContractRequestSchema>;

export function computeContractDerived(data: GenerateContractRequest) {
    const net_project_cost = Math.max(0, data.project_cost - data.discount_amount);
    const estimated_fee = (net_project_cost * data.fee_percentage) / 100;
    const applicable_fee = Math.max(estimated_fee, data.monthly_min_fee);

    return { net_project_cost, estimated_fee, applicable_fee };
}
