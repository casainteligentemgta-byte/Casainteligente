import { z } from 'zod';

/** Esquema de validación del formulario de contratos. */
export const contractSchema = z
    .object({
        // Cliente
        client_name: z.string().min(1, 'El nombre del cliente es obligatorio').max(200),
        client_ci: z.string().min(1, 'La cédula es obligatoria').max(30),
        client_email: z.string().email('Correo electrónico inválido').max(200),

        // Financieros
        project_cost: z
            .number({
                required_error: 'El costo del proyecto es obligatorio',
                invalid_type_error: 'El costo del proyecto debe ser un número',
            })
            .positive('El costo del proyecto debe ser mayor a 0'),
        discount_amount: z
            .number({
                required_error: 'La rebaja es obligatoria',
                invalid_type_error: 'La rebaja debe ser un número',
            })
            .min(0, 'La rebaja no puede ser negativa'),
        fee_percentage: z
            .number({
                required_error: 'El porcentaje es obligatorio',
                invalid_type_error: 'El porcentaje debe ser un número',
            })
            .min(0, 'El porcentaje no puede ser negativo')
            .max(100, 'El porcentaje no puede superar 100'),
        monthly_min_fee: z
            .number({
                required_error: 'El mínimo mensual es obligatorio',
                invalid_type_error: 'El mínimo mensual debe ser un número',
            })
            .min(0, 'El mínimo mensual no puede ser negativo'),
        working_capital: z
            .number({
                required_error: 'La caja chica es obligatoria',
                invalid_type_error: 'La caja chica debe ser un número',
            })
            .min(0, 'La caja chica no puede ser negativa'),
        payroll_guarantee_weeks: z
            .number({
                required_error: 'Las semanas de garantía son obligatorias',
                invalid_type_error: 'Las semanas deben ser un número',
            })
            .int('Debe ser un número entero')
            .min(0, 'Las semanas no pueden ser negativas'),

        // Plazos
        contract_deadline_months: z
            .number({
                required_error: 'El plazo es obligatorio',
                invalid_type_error: 'El plazo debe ser un número',
            })
            .int('Debe ser un número entero')
            .positive('El plazo debe ser al menos 1 mes'),
    })
    .superRefine((data, ctx) => {
        if (data.discount_amount > data.project_cost) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'La rebaja no puede superar el costo del proyecto',
                path: ['discount_amount'],
            });
        }
    });

export type ContractFormValues = z.infer<typeof contractSchema>;
