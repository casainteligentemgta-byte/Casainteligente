'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, FileText, Calculator } from 'lucide-react';
import { computeContractDerived } from '@/lib/contracts/schema';

type FormState = {
    client_name: string;
    client_ci: string;
    client_email: string;
    project_cost: string;
    discount_amount: string;
    fee_percentage: string;
    monthly_min_fee: string;
    working_capital: string;
    payroll_guarantee_weeks: string;
    substitution_target: string;
    salvage_target: string;
    contract_deadline_months: string;
};

const INITIAL: FormState = {
    client_name: '',
    client_ci: '',
    client_email: '',
    project_cost: '',
    discount_amount: '0',
    fee_percentage: '10',
    monthly_min_fee: '',
    working_capital: '',
    payroll_guarantee_weeks: '2',
    substitution_target: '',
    salvage_target: '',
    contract_deadline_months: '3',
};

function formatUSD(n: number) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Field({
    label,
    name,
    value,
    onChange,
    type = 'text',
    placeholder,
    required,
    step,
    min,
}: {
    label: string;
    name: keyof FormState;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    step?: string;
    min?: string;
}) {
    const inputClass =
        'w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-[#E5E5EA] dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all';

    return (
        <div>
            <label className="block text-sm font-medium text-[#8E8E93] mb-1">
                {label}{required ? ' *' : ''}
            </label>
            {type === 'textarea' ? (
                <textarea
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    rows={3}
                    className={inputClass}
                />
            ) : (
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    step={step}
                    min={min}
                    className={inputClass}
                />
            )}
        </div>
    );
}

export default function AdministracionDelegadaPage() {
    const [form, setForm] = useState<FormState>(INITIAL);
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<{ contract_id: string; pdf_url: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setError(null);
    };

    const derived = useMemo(() => {
        const project_cost = Number(form.project_cost) || 0;
        const discount_amount = Number(form.discount_amount) || 0;
        const fee_percentage = Number(form.fee_percentage) || 0;
        const monthly_min_fee = Number(form.monthly_min_fee) || 0;

        if (project_cost <= 0) {
            return { net_project_cost: 0, estimated_fee: 0, applicable_fee: 0 };
        }

        return computeContractDerived({
            client_name: form.client_name || 'x',
            client_ci: form.client_ci || 'x',
            client_email: form.client_email.includes('@') ? form.client_email : 'preview@example.com',
            project_cost,
            discount_amount,
            fee_percentage,
            monthly_min_fee,
            working_capital: Number(form.working_capital) || 0,
            payroll_guarantee_weeks: Number(form.payroll_guarantee_weeks) || 0,
            substitution_target: form.substitution_target || 'x',
            salvage_target: form.salvage_target || 'x',
            contract_deadline_months: Number(form.contract_deadline_months) || 1,
        });
    }, [form]);

    const canSubmit =
        form.client_name &&
        form.client_ci &&
        form.client_email &&
        Number(form.project_cost) > 0 &&
        form.fee_percentage !== '' &&
        form.monthly_min_fee !== '' &&
        form.working_capital !== '' &&
        form.payroll_guarantee_weeks !== '' &&
        form.substitution_target &&
        form.salvage_target &&
        Number(form.contract_deadline_months) >= 1;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || isGenerating) return;

        setIsGenerating(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/generate-contract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_name: form.client_name.trim(),
                    client_ci: form.client_ci.trim(),
                    client_email: form.client_email.trim(),
                    project_cost: Number(form.project_cost),
                    discount_amount: Number(form.discount_amount) || 0,
                    fee_percentage: Number(form.fee_percentage),
                    monthly_min_fee: Number(form.monthly_min_fee),
                    working_capital: Number(form.working_capital),
                    payroll_guarantee_weeks: Number(form.payroll_guarantee_weeks),
                    substitution_target: form.substitution_target.trim(),
                    salvage_target: form.salvage_target.trim(),
                    contract_deadline_months: Number(form.contract_deadline_months),
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Error al generar el contrato');
            }

            setResult({
                contract_id: payload.contract_id,
                pdf_url: payload.pdf_url,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al generar el contrato');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-[#F2F2F7] p-6 md:p-8 font-sans">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/ventas">
                        <button
                            type="button"
                            className="p-3 rounded-full bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 hover:bg-white dark:hover:bg-[#2C2C2E] transition-colors shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Administración Delegada</h1>
                        <p className="text-[#8E8E93]">Cuestionario para generar el contrato PDF</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* A. Cliente */}
                        <motion.section
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4"
                        >
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-[#007AFF]" />
                                A. Datos del Cliente
                            </h2>
                            <Field label="Nombre completo" name="client_name" value={form.client_name} onChange={handleChange} placeholder="Ej. María González" required />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Cédula de identidad" name="client_ci" value={form.client_ci} onChange={handleChange} placeholder="V-12.345.678" required />
                                <Field label="Correo electrónico" name="client_email" value={form.client_email} onChange={handleChange} type="email" placeholder="cliente@email.com" required />
                            </div>
                        </motion.section>

                        {/* B. Finanzas */}
                        <motion.section
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                            className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4"
                        >
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Calculator className="w-5 h-5 text-[#34C759]" />
                                B. Condiciones Financieras
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Costo del proyecto (USD)" name="project_cost" value={form.project_cost} onChange={handleChange} type="number" step="0.01" min="0" placeholder="15000" required />
                                <Field label="Rebaja comercial (USD)" name="discount_amount" value={form.discount_amount} onChange={handleChange} type="number" step="0.01" min="0" placeholder="0" />
                                <Field label="% honorarios de administración" name="fee_percentage" value={form.fee_percentage} onChange={handleChange} type="number" step="0.01" min="0" placeholder="10" required />
                                <Field label="Mínimo mensual garantizado (USD)" name="monthly_min_fee" value={form.monthly_min_fee} onChange={handleChange} type="number" step="0.01" min="0" placeholder="500" required />
                                <Field label="Caja chica / capital de trabajo (USD)" name="working_capital" value={form.working_capital} onChange={handleChange} type="number" step="0.01" min="0" placeholder="2000" required />
                                <Field label="Semanas de nómina (Fondo de Garantía)" name="payroll_guarantee_weeks" value={form.payroll_guarantee_weeks} onChange={handleChange} type="number" step="1" min="0" placeholder="2" required />
                            </div>
                        </motion.section>

                        {/* C. Alcance */}
                        <motion.section
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4"
                        >
                            <h2 className="text-lg font-semibold">C. Alcance Técnico</h2>
                            <Field label="Elementos a sustituir" name="substitution_target" value={form.substitution_target} onChange={handleChange} type="textarea" placeholder="Ej: Columnas de carga, entrepisos dañados..." required />
                            <Field label="Elementos a salvar" name="salvage_target" value={form.salvage_target} onChange={handleChange} type="textarea" placeholder="Ej: Techo existente, fachada principal..." required />
                        </motion.section>

                        {/* D. Plazos */}
                        <motion.section
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-4"
                        >
                            <h2 className="text-lg font-semibold">D. Plazos</h2>
                            <Field
                                label="Plazo de caducidad del beneficio (meses)"
                                name="contract_deadline_months"
                                value={form.contract_deadline_months}
                                onChange={handleChange}
                                type="number"
                                step="1"
                                min="1"
                                placeholder="3"
                                required
                            />
                        </motion.section>
                    </div>

                    {/* Resumen + CTA */}
                    <motion.aside
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:sticky lg:top-6 h-fit bg-white/60 dark:bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/20 dark:border-gray-800 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] space-y-5"
                    >
                        <h2 className="text-lg font-semibold">Resumen calculado</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-[#8E8E93]">Costo neto</span>
                                <span className="font-semibold">$ {formatUSD(derived.net_project_cost)}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-[#8E8E93]">Honorario estimado</span>
                                <span className="font-semibold">$ {formatUSD(derived.estimated_fee)}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-[#8E8E93]">Honorario aplicable</span>
                                <span className="font-semibold text-[#007AFF]">$ {formatUSD(derived.applicable_fee)}</span>
                            </div>
                            <p className="text-xs text-[#8E8E93] pt-1">
                                El honorario aplicable es el mayor entre el % sobre costo neto y el mínimo mensual.
                            </p>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-[#FF3B30]/30 bg-[#FF3B30]/10 text-[#FF3B30] text-sm px-4 py-3">
                                {error}
                            </div>
                        )}

                        {result ? (
                            <div className="space-y-3">
                                <div className="w-full py-4 rounded-xl bg-[#34C759]/10 text-[#34C759] font-semibold flex items-center justify-center gap-2 border border-[#34C759]/20">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Contrato generado
                                </div>
                                <a
                                    href={result.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full text-center py-3 rounded-xl bg-[#007AFF] text-white font-semibold hover:bg-[#0056b3] transition-colors"
                                >
                                    Abrir PDF
                                </a>
                                <p className="text-xs text-[#8E8E93] text-center break-all">ID: {result.contract_id}</p>
                            </div>
                        ) : (
                            <button
                                type="submit"
                                disabled={!canSubmit || isGenerating}
                                className="w-full py-4 rounded-xl bg-[#007AFF] text-white font-semibold hover:bg-[#0056b3] transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    'Generar contrato PDF'
                                )}
                            </button>
                        )}
                    </motion.aside>
                </form>
            </div>
        </div>
    );
}
