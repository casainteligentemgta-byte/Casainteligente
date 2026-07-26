'use client';

import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type CustomerType = 'natural' | 'juridico';
type GeneroContrato = 'M' | 'F';

const ESTADOS_CIVILES = [
  'soltero',
  'soltera',
  'casado',
  'casada',
  'divorciado',
  'divorciada',
  'viudo',
  'viuda',
  'unión estable de hecho',
] as const;

const optionalEmail = z.string().email('Email inválido.').optional().or(z.literal(''));
const optionalRif = z
  .string()
  .trim()
  .refine((v) => v === '' || v.length >= 4, 'RIF inválido.')
  .optional()
  .or(z.literal(''));

const contratoFields = {
  genero: z.enum(['M', 'F'], { required_error: 'Indique Señor o Señora.' }),
  estado_civil: z.string().min(2, 'El estado civil es obligatorio.'),
  profesion: z.string().min(2, 'La profesión es obligatoria.'),
  domicilio: z.string().min(5, 'El domicilio es obligatorio.'),
};

const naturalSchema = z.object({
  customerType: z.literal('natural'),
  cedula: z.string().min(4, 'La cédula es obligatoria.'),
  rif: optionalRif,
  nombre: z.string().min(2, 'El nombre es obligatorio.'),
  apellido: z.string().min(2, 'El apellido es obligatorio.'),
  email: optionalEmail,
  telefono: z.string().min(7, 'El teléfono es obligatorio.'),
  ...contratoFields,
});

const juridicoSchema = z.object({
  customerType: z.literal('juridico'),
  rif: z.string().min(4, 'El RIF es obligatorio.'),
  razon_social: z.string().min(2, 'La razón social es obligatoria.'),
  representante_legal: z.string().min(2, 'El representante legal es obligatorio.'),
  email: optionalEmail,
  telefono: z.string().min(7, 'El teléfono es obligatorio.'),
  ...contratoFields,
});

const customerSchema = z.discriminatedUnion('customerType', [naturalSchema, juridicoSchema]);

type CustomerValidated = z.infer<typeof customerSchema>;

type FormErrors = Record<string, string>;

/** PostgREST / Supabase: columna desconocida en `customers`. */
function columnaCustomersFaltante(message: string): string | null {
  const m1 = /Could not find the '(\w+)' column of 'customers'/i.exec(message);
  if (m1?.[1]) return m1[1];
  const m2 = /column ['"](\w+)['"] of relation ['"]customers['"]/i.exec(message);
  if (m2?.[1]) return m2[1];
  const m3 = /['"](\w+)['"].*customers.*does not exist/i.exec(message);
  return m3?.[1] ?? null;
}

function esErrorSchemaColumnaCustomers(message: string): boolean {
  if (/Could not find the '\w+' column of 'customers'/i.test(message)) return true;
  return (
    /customers/i.test(message) &&
    (/schema cache/i.test(message) || /column/i.test(message) || /does not exist/i.test(message))
  );
}

/** Último recurso: solo columnas del modelo original 009 (sin cedula/apellido/customer_type). */
function payloadSoloEsquema009(validated: CustomerValidated): Record<string, unknown> {
  const domicilioNote = validated.domicilio.trim();
  if (validated.customerType === 'natural') {
    const extras = [
      `CI ${validated.cedula}`,
      validated.rif ? `RIF ${validated.rif}` : null,
      validated.genero === 'F' ? 'Sra.' : 'Sr.',
      validated.estado_civil,
      validated.profesion,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      nombre: `${validated.nombre} ${validated.apellido} — ${extras}`.trim(),
      rif: validated.rif || null,
      movil: validated.telefono,
      email: validated.email || null,
      direccion: domicilioNote || null,
      tipo: 'Natural',
      status: 'activo',
    };
  }
  return {
    nombre: `${validated.razon_social} — Rep.: ${validated.representante_legal}`.trim(),
    rif: validated.rif,
    movil: validated.telefono,
    email: validated.email || null,
    direccion: domicilioNote || null,
    tipo: 'Juridico',
    status: 'activo',
  };
}

/**
 * Quita una columna que la BD aún no tiene y conserva el dato en columnas base (009) cuando es posible.
 */
function payloadSinColumnaCustomers(
  data: Record<string, unknown>,
  validated: CustomerValidated,
  columna: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };
  delete next[columna];

  if (columna === 'direccion') {
    return next;
  }

  if (columna === 'genero' || columna === 'estado_civil' || columna === 'profesion') {
    const notas: string[] = [];
    if (columna === 'genero') notas.push(validated.genero === 'F' ? 'Sra.' : 'Sr.');
    if (columna === 'estado_civil') notas.push(`Estado civil: ${validated.estado_civil}`);
    if (columna === 'profesion') notas.push(`Profesión: ${validated.profesion}`);
    const note = notas.join(' | ');
    const prev = String(next.direccion ?? validated.domicilio ?? '').trim();
    next.direccion = prev ? `${prev} | ${note}` : note;
    return next;
  }

  if (validated.customerType === 'natural') {
    if (columna === 'apellido') {
      next.nombre = `${validated.nombre} ${validated.apellido}`.trim();
    }
    if (columna === 'cedula') {
      const note = `Cédula: ${validated.cedula}`;
      const prev = String(next.direccion ?? '').trim();
      next.direccion = prev ? `${prev} | ${note}` : note;
    }
    return next;
  }

  if (validated.customerType === 'juridico') {
    if (columna === 'representante_legal') {
      const note = `Representante legal: ${validated.representante_legal}`;
      const prev = String(next.direccion ?? '').trim();
      next.direccion = prev ? `${prev} | ${note}` : note;
    }
  }

  return next;
}

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

const controlClass =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-[#007AFF]/70 focus:ring-2 focus:ring-[#007AFF]/20';

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ''}`} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${props.className ?? ''}`} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} resize-y ${props.className ?? ''}`} />;
}

function normalizarGenero(value: unknown): GeneroContrato {
  const t = String(value ?? '')
    .trim()
    .toUpperCase();
  if (t === 'F' || t === 'FEMENINO' || t === 'FEMENINA' || t === 'SRA' || t === 'SRA.') return 'F';
  return 'M';
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
  const [genero, setGenero] = useState<GeneroContrato>(normalizarGenero(initialData?.genero));
  const [estadoCivil, setEstadoCivil] = useState(initialData?.estado_civil ?? '');
  const [profesion, setProfesion] = useState(initialData?.profesion ?? '');
  const [domicilio, setDomicilio] = useState(initialData?.direccion ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const submit = async () => {
    const payload =
      customerType === 'natural'
        ? {
            customerType,
            cedula: cedula.trim(),
            rif: rif.trim(),
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            email: email.trim(),
            telefono: telefono.trim(),
            genero,
            estado_civil: estadoCivil.trim(),
            profesion: profesion.trim(),
            domicilio: domicilio.trim(),
          }
        : {
            customerType,
            rif: rif.trim(),
            razon_social: razonSocial.trim(),
            representante_legal: representanteLegal.trim(),
            email: email.trim(),
            telefono: telefono.trim(),
            genero,
            estado_civil: estadoCivil.trim(),
            profesion: profesion.trim(),
            domicilio: domicilio.trim(),
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

    try {
      const validated = parsed.data;
      const contratoPayload = {
        genero: validated.genero,
        estado_civil: validated.estado_civil,
        profesion: validated.profesion,
        direccion: validated.domicilio,
      };
      const insertData =
        validated.customerType === 'natural'
          ? {
              customer_type: 'natural',
              tipo: 'Natural',
              nombre: validated.nombre,
              apellido: validated.apellido,
              cedula: validated.cedula,
              rif: validated.rif?.trim() ? validated.rif.trim() : null,
              razon_social: null,
              representante_legal: null,
              email: validated.email || null,
              telefono: validated.telefono,
              movil: validated.telefono,
              ...contratoPayload,
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
              ...contratoPayload,
            };

      const runSave = async (payload: Record<string, unknown>) =>
        isEditing && initialData?.id
          ? supabase.from('customers').update(payload).eq('id', initialData.id)
          : supabase.from('customers').insert(payload);

      let payloadActual: Record<string, unknown> = { ...insertData };
      let result = await runSave(payloadActual as never);

      for (let i = 0; i < 12 && result.error && esErrorSchemaColumnaCustomers(result.error.message); i++) {
        const col = columnaCustomersFaltante(result.error.message);
        if (!col) break;
        if (!(col in payloadActual)) break;
        payloadActual = payloadSinColumnaCustomers(payloadActual, validated, col);
        result = await runSave(payloadActual as never);
      }

      if (result.error && esErrorSchemaColumnaCustomers(result.error.message)) {
        result = await runSave(payloadSoloEsquema009(validated) as never);
      }

      if (result.error) {
        alert(`Error al guardar: ${result.error.message}`);
        return;
      }
      router.push('/clientes');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const etiquetaContrato =
    customerType === 'juridico'
      ? 'Datos del representante para contrato'
      : 'Datos para contrato';

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
              <div className="flex gap-3">
                <div className="w-[5.5rem] shrink-0">
                  <Field label="Tratamiento" required error={errors.genero}>
                    <Select
                      value={genero}
                      aria-label="Señor o Señora"
                      onChange={(e) => setGenero(e.target.value === 'F' ? 'F' : 'M')}
                    >
                      <option value="M">Sr.</option>
                      <option value="F">Sra.</option>
                    </Select>
                  </Field>
                </div>
                <div className="min-w-0 flex-1">
                  <Field label="C.I." required error={errors.cedula}>
                    <Input
                      placeholder="V-12345678 o 12345678"
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nombre" required error={errors.nombre}>
                  <Input placeholder="Ej: Carlos" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </Field>
                <Field label="Apellido" required error={errors.apellido}>
                  <Input placeholder="Ej: Pérez" value={apellido} onChange={(e) => setApellido(e.target.value)} />
                </Field>
              </div>
              <Field label="RIF" error={errors.rif}>
                <Input
                  placeholder="V-12345678-9 (si aplica)"
                  value={rif}
                  onChange={(e) => setRif(e.target.value)}
                />
              </Field>
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
              <div className="flex gap-3">
                <div className="w-[5.5rem] shrink-0">
                  <Field label="Tratamiento" required error={errors.genero}>
                    <Select
                      value={genero}
                      aria-label="Señor o Señora del representante"
                      onChange={(e) => setGenero(e.target.value === 'F' ? 'F' : 'M')}
                    >
                      <option value="M">Sr.</option>
                      <option value="F">Sra.</option>
                    </Select>
                  </Field>
                </div>
                <div className="min-w-0 flex-1">
                  <Field label="Representante Legal" required error={errors.representante_legal}>
                    <Input
                      placeholder="Ej: Luis Mata"
                      value={representanteLegal}
                      onChange={(e) => setRepresentanteLegal(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.email}>
              <Input
                placeholder="correo@dominio.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Teléfono" required error={errors.telefono}>
              <Input placeholder="+58 412..." value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{etiquetaContrato}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Datos de comparecencia para firmar contratos (cédula/RIF, tratamiento, profesión, domicilio y estado
              civil).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Estado civil" required error={errors.estado_civil}>
              <Input
                list="estados-civiles-cliente"
                placeholder="Ej: casado"
                value={estadoCivil}
                onChange={(e) => setEstadoCivil(e.target.value)}
              />
              <datalist id="estados-civiles-cliente">
                {ESTADOS_CIVILES.map((ec) => (
                  <option key={ec} value={ec} />
                ))}
              </datalist>
            </Field>
            <Field label="Profesión" required error={errors.profesion}>
              <Input
                placeholder="Ej: ingeniero, comerciante"
                value={profesion}
                onChange={(e) => setProfesion(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Domicilio" required error={errors.domicilio}>
            <Textarea
              rows={2}
              placeholder="Urbanización, calle, ciudad, estado"
              value={domicilio}
              onChange={(e) => setDomicilio(e.target.value)}
            />
          </Field>
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
