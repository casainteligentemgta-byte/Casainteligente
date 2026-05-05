'use client';

import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type CustomerType = 'natural' | 'juridico';

const naturalSchema = z.object({
  customerType: z.literal('natural'),
  cedula: z.string().min(4, 'La cédula es obligatoria.'),
  nombre: z.string().min(2, 'El nombre es obligatorio.'),
  apellido: z.string().min(2, 'El apellido es obligatorio.'),
  email: z.string().email('Email inválido.').optional().or(z.literal('')),
  telefono: z.string().min(7, 'El teléfono es obligatorio.'),
});

const juridicoSchema = z.object({
  customerType: z.literal('juridico'),
  rif: z.string().min(4, 'El RIF es obligatorio.'),
  razon_social: z.string().min(2, 'La razón social es obligatoria.'),
  representante_legal: z.string().min(2, 'El representante legal es obligatorio.'),
  email: z.string().email('Email inválido.').optional().or(z.literal('')),
  telefono: z.string().min(7, 'El teléfono es obligatorio.'),
});

const customerSchema = z.discriminatedUnion('customerType', [naturalSchema, juridicoSchema]);

type FormErrors = Record<string, string>;

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-zinc-300">
        {label}
        {required ? <span className="ml-1 text-red-400">*</span> : null}
      </span>
      {children}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#007AFF]/70 focus:ring-2 focus:ring-[#007AFF]/20 ${props.className ?? ''}`}
    />
  );
}

export default function NuevoClienteForm({ initialData, isEditing }: { initialData?: any; isEditing?: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [customerType, setCustomerType] = useState<CustomerType>(
    initialData?.customer_type === 'juridico' ? 'juridico' : 'natural',
  );

  const [nombre, setNombre] = useState(initialData?.nombre ?? '');
  const [apellido, setApellido] = useState(initialData?.apellido ?? '');
  const [cedula, setCedula] = useState(initialData?.cedula ?? '');
  const [rif, setRif] = useState(initialData?.rif ?? '');
  const [razonSocial, setRazonSocial] = useState(initialData?.razon_social ?? '');
  const [representanteLegal, setRepresentanteLegal] = useState(initialData?.representante_legal ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [telefono, setTelefono] = useState(initialData?.telefono ?? initialData?.movil ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const submit = async () => {
    const payload =
      customerType === 'natural'
        ? {
            customerType,
            cedula: cedula.trim(),
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            email: email.trim(),
            telefono: telefono.trim(),
          }
        : {
            customerType,
            rif: rif.trim(),
            razon_social: razonSocial.trim(),
            representante_legal: representanteLegal.trim(),
            email: email.trim(),
            telefono: telefono.trim(),
          };

    const parsed = customerSchema.safeParse(payload);
    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSaving(true);

    const validated = parsed.data;
    const insertData =
      validated.customerType === 'natural'
        ? {
            customer_type: 'natural',
            tipo: 'Natural',
            nombre: validated.nombre,
            apellido: validated.apellido,
            cedula: validated.cedula,
            rif: null,
            razon_social: null,
            representante_legal: null,
            email: validated.email || null,
            telefono: validated.telefono,
            movil: validated.telefono,
          }
        : {
            customer_type: 'juridico',
            tipo: 'Juridico',
            nombre: validated.razon_social,
            apellido: null,
            cedula: null,
            rif: validated.rif,
            razon_social: validated.razon_social,
            representante_legal: validated.representante_legal,
            email: validated.email || null,
            telefono: validated.telefono,
            movil: validated.telefono,
          };

    const result =
      isEditing && initialData?.id
        ? await supabase.from('customers').update(insertData).eq('id', initialData.id)
        : await supabase.from('customers').insert(insertData);

    setSaving(false);
    if (result.error) {
      alert(`Error al guardar: ${result.error.message}`);
      return;
    }
    router.push('/clientes');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 pb-24 pt-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setCustomerType('natural')}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                customerType === 'natural'
                  ? 'bg-[#007AFF]/20 text-[#7cb9ff] border border-[#007AFF]/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Persona Natural
            </button>
            <button
              type="button"
              onClick={() => setCustomerType('juridico')}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                customerType === 'juridico'
                  ? 'bg-[#007AFF]/20 text-[#7cb9ff] border border-[#007AFF]/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Persona Jurídica
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          {customerType === 'natural' ? (
            <>
              <Field label="C.I." required error={errors.cedula}>
                <Input placeholder="V-12345678 o 12345678" value={cedula} onChange={(e) => setCedula(e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nombre" required error={errors.nombre}>
                  <Input placeholder="Ej: Carlos" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </Field>
                <Field label="Apellido" required error={errors.apellido}>
                  <Input placeholder="Ej: Pérez" value={apellido} onChange={(e) => setApellido(e.target.value)} />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="RIF" required error={errors.rif}>
                <Input placeholder="J-12345678-9" value={rif} onChange={(e) => setRif(e.target.value)} />
              </Field>
              <Field label="Razón Social" required error={errors.razon_social}>
                <Input
                  placeholder="Ej: Casa Inteligente C.A."
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                />
              </Field>
              <Field label="Representante Legal" required error={errors.representante_legal}>
                <Input
                  placeholder="Ej: Luis Mata"
                  value={representanteLegal}
                  onChange={(e) => setRepresentanteLegal(e.target.value)}
                />
              </Field>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.email}>
              <Input placeholder="correo@dominio.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Teléfono" required error={errors.telefono}>
              <Input placeholder="+58 412..." value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </Field>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full rounded-2xl border border-[#007AFF]/40 bg-[#007AFF]/20 px-4 py-3.5 text-sm font-bold text-[#9fcbff] transition hover:bg-[#007AFF]/30 disabled:opacity-60"
        >
          {saving ? 'Guardando...' : isEditing ? 'Actualizar Cliente' : 'Guardar Cliente'}
        </button>
      </div>
    </div>
  );
}
