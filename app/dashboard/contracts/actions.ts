'use server';

import { contractSchema, type ContractFormValues } from '@/lib/legal/schema';

export type CreateContractState = {
    success: boolean;
    message?: string;
    errors?: Record<string, string[] | undefined>;
};

function toNumber(value: FormDataEntryValue | null): number {
    if (value === null || value === '') return Number.NaN;
    return Number(value);
}

/**
 * Server Action inicial: valida y registra los datos en consola.
 * La persistencia / PDF se integrarán en un siguiente paso.
 */
export async function createContract(
    _prev: CreateContractState,
    formData: FormData
): Promise<CreateContractState> {
    const raw = {
        client_name: String(formData.get('client_name') ?? ''),
        client_ci: String(formData.get('client_ci') ?? ''),
        client_email: String(formData.get('client_email') ?? ''),
        project_cost: toNumber(formData.get('project_cost')),
        discount_amount: toNumber(formData.get('discount_amount') ?? '0'),
        fee_percentage: toNumber(formData.get('fee_percentage')),
        monthly_min_fee: toNumber(formData.get('monthly_min_fee')),
        working_capital: toNumber(formData.get('working_capital')),
        payroll_guarantee_weeks: toNumber(formData.get('payroll_guarantee_weeks')),
        contract_deadline_months: toNumber(formData.get('contract_deadline_months')),
    };

    const parsed = contractSchema.safeParse(raw);

    if (!parsed.success) {
        return {
            success: false,
            message: 'Datos inválidos. Revisa el formulario.',
            errors: parsed.error.flatten().fieldErrors,
        };
    }

    const data: ContractFormValues = parsed.data;
    console.log('[createContract] Datos recibidos:', data);

    return {
        success: true,
        message: 'Datos recibidos correctamente (ver consola del servidor).',
    };
}
