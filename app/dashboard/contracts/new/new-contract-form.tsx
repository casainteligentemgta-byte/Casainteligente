'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormState } from 'react-dom';
import { contractSchema, type ContractFormValues } from '@/lib/legal/schema';
import {
    createContract,
    type CreateContractState,
} from '@/app/dashboard/contracts/actions';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

const initialState: CreateContractState = { success: false };

const defaultValues: ContractFormValues = {
    client_name: '',
    client_ci: '',
    client_email: '',
    project_cost: 0,
    discount_amount: 0,
    fee_percentage: 10,
    monthly_min_fee: 0,
    working_capital: 0,
    payroll_guarantee_weeks: 2,
    contract_deadline_months: 3,
};

function numberFromInput(value: string): number {
    if (value === '' || value === undefined) return Number.NaN;
    return Number(value);
}

export function NewContractForm() {
    const [state, formAction] = useFormState(createContract, initialState);
    const [isPending, startTransition] = useTransition();

    const form = useForm<ContractFormValues>({
        resolver: zodResolver(contractSchema),
        defaultValues,
        mode: 'onBlur',
    });

    const onSubmit = (values: ContractFormValues) => {
        const fd = new FormData();
        (Object.keys(values) as Array<keyof ContractFormValues>).forEach((key) => {
            fd.set(key, String(values[key]));
        });
        startTransition(() => {
            formAction(fd);
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
                <Card>
                    <CardHeader>
                        <CardTitle>Datos del Cliente</CardTitle>
                        <CardDescription>
                            Identificación del contratante para el contrato de Administración
                            Delegada.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="client_name"
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Nombre completo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="María González" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="client_ci"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cédula de identidad</FormLabel>
                                    <FormControl>
                                        <Input placeholder="V-12.345.678" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="client_email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Correo electrónico</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            placeholder="cliente@email.com"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Condiciones Financieras</CardTitle>
                        <CardDescription>
                            Costos, honorarios, caja chica y fondo de garantía.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="project_cost"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Costo del proyecto (USD)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            name={field.name}
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            value={Number.isNaN(field.value) ? '' : field.value}
                                            onChange={(e) =>
                                                field.onChange(numberFromInput(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="discount_amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rebaja comercial (USD)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            name={field.name}
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            value={Number.isNaN(field.value) ? '' : field.value}
                                            onChange={(e) =>
                                                field.onChange(numberFromInput(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="fee_percentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>% honorarios de administración</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            name={field.name}
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            value={Number.isNaN(field.value) ? '' : field.value}
                                            onChange={(e) =>
                                                field.onChange(numberFromInput(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="monthly_min_fee"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mínimo mensual garantizado (USD)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            name={field.name}
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            value={Number.isNaN(field.value) ? '' : field.value}
                                            onChange={(e) =>
                                                field.onChange(numberFromInput(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="working_capital"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Caja chica / capital de trabajo (USD)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            name={field.name}
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            value={Number.isNaN(field.value) ? '' : field.value}
                                            onChange={(e) =>
                                                field.onChange(numberFromInput(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="payroll_guarantee_weeks"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Semanas de nómina (Fondo de Garantía)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="1"
                                            min="0"
                                            name={field.name}
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            value={Number.isNaN(field.value) ? '' : field.value}
                                            onChange={(e) =>
                                                field.onChange(numberFromInput(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Plazos</CardTitle>
                        <CardDescription>
                            Vigencia del beneficio contractual.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="contract_deadline_months"
                            render={({ field }) => (
                                <FormItem className="max-w-sm">
                                    <FormLabel>Plazo de caducidad (meses)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="1"
                                            min="1"
                                            name={field.name}
                                            ref={field.ref}
                                            onBlur={field.onBlur}
                                            value={Number.isNaN(field.value) ? '' : field.value}
                                            onChange={(e) =>
                                                field.onChange(numberFromInput(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                {state.message && (
                    <div
                        className={`rounded-md border px-4 py-3 text-sm ${
                            state.success
                                ? 'border-[#34C759]/30 bg-[#34C759]/10 text-[#248A3D]'
                                : 'border-[#FF3B30]/30 bg-[#FF3B30]/10 text-[#FF3B30]'
                        }`}
                    >
                        {state.message}
                    </div>
                )}

                <div className="flex justify-end">
                    <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isPending}>
                        {isPending ? 'Enviando…' : 'Crear contrato'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
