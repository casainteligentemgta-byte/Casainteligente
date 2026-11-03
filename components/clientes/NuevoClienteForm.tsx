'use client';

import { useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiBuscarDuplicadosCliente, apiGuardarCliente } from '@/lib/clientes/apiCliente';
import {
  etiquetaMotivoDuplicado,
  mensajeClienteYaExiste,
} from '@/lib/clientes/clienteEntidades';
import { puedeForzarNuevoPorTelefono } from '@/lib/clientes/altaOVincularCliente';
import { type ClienteParecido } from '@/lib/clientes/duplicadosCliente';
import { normalizarTelegramUsername } from '@/lib/clientes/normalizarIdentidad';
import BotonTema from '@/components/tema/BotonTema';
import { tinta, tintaTexto } from '@/lib/tema/tinta';

type CustomerType = 'natural' | 'juridico';
type GeneroContrato = 'M' | 'F' | '';

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

const paso1Natural = z.object({
  customerType: z.literal('natural'),
  nombre: z.string().min(2, 'El nombre es obligatorio.'),
  telefono: z.string().min(7, 'El teléfono es obligatorio.'),
  email: optionalEmail,
  telegram_username: z.string().optional().or(z.literal('')),
});

const paso1Juridico = z.object({
  customerType: z.literal('juridico'),
  razon_social: z.string().min(2, 'La razón social es obligatoria.'),
  telefono: z.string().min(7, 'El teléfono es obligatorio.'),
  email: optionalEmail,
  telegram_username: z.string().optional().or(z.literal('')),
});

const paso1Schema = z.discriminatedUnion('customerType', [paso1Natural, paso1Juridico]);

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
      <span className="text-sm font-medium" style={{ color: tintaTexto(0.75) }}>
        {label}
        {required ? <span className="ml-1 text-red-400">*</span> : null}
      </span>
      {children}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </label>
  );
}

const controlClass =
  'w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 focus:ring-[#007AFF]/20';

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${controlClass} ${props.className ?? ''}`}
      style={{
        background: 'var(--superficie)',
        borderColor: tinta(0.12),
        color: 'var(--label-primary)',
        fontSize: 16,
        ...((props.style as React.CSSProperties) ?? {}),
      }}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${controlClass} ${props.className ?? ''}`}
      style={{
        background: 'var(--superficie)',
        borderColor: tinta(0.12),
        color: 'var(--label-primary)',
        fontSize: 16,
      }}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${controlClass} resize-y ${props.className ?? ''}`}
      style={{
        background: 'var(--superficie)',
        borderColor: tinta(0.12),
        color: 'var(--label-primary)',
        fontSize: 16,
      }}
    />
  );
}

function normalizarGenero(value: unknown): GeneroContrato {
  const t = String(value ?? '')
    .trim()
    .toUpperCase();
  if (t === 'F' || t === 'FEMENINO' || t === 'FEMENINA' || t === 'SRA' || t === 'SRA.') return 'F';
  if (t === 'M' || t === 'MASCULINO' || t === 'SR' || t === 'SR.') return 'M';
  return '';
}

type InitialCliente = Record<string, unknown> & { id?: string };

export default function NuevoClienteForm({
  initialData,
  isEditing,
}: {
  initialData?: InitialCliente;
  isEditing?: boolean;
}) {
  const router = useRouter();
  const yaExiste = Boolean(isEditing && initialData?.id);
  const [paso, setPaso] = useState<1 | 2>(yaExiste ? 2 : 1);
  const [clienteId, setClienteId] = useState<string | null>(
    typeof initialData?.id === 'string' ? initialData.id : null,
  );
  const [customerType, setCustomerType] = useState<CustomerType>(
    initialData?.customer_type === 'juridico' ? 'juridico' : 'natural',
  );

  const [nombre, setNombre] = useState(String(initialData?.nombre ?? ''));
  const [apellido, setApellido] = useState(String(initialData?.apellido ?? ''));
  const [cedula, setCedula] = useState(String(initialData?.cedula ?? ''));
  const [rif, setRif] = useState(String(initialData?.rif ?? ''));
  const [razonSocial, setRazonSocial] = useState(String(initialData?.razon_social ?? ''));
  const [representanteLegal, setRepresentanteLegal] = useState(
    String(initialData?.representante_legal ?? ''),
  );
  const [email, setEmail] = useState(String(initialData?.email ?? ''));
  const [telefono, setTelefono] = useState(
    String(initialData?.telefono ?? initialData?.movil ?? (yaExiste ? '' : '+58 ')),
  );
  const [telegramUsername, setTelegramUsername] = useState(
    String(initialData?.telegram_username ?? ''),
  );
  const [genero, setGenero] = useState<GeneroContrato>(normalizarGenero(initialData?.genero));
  const [estadoCivil, setEstadoCivil] = useState(String(initialData?.estado_civil ?? ''));
  const [profesion, setProfesion] = useState(String(initialData?.profesion ?? ''));
  const [domicilio, setDomicilio] = useState(String(initialData?.direccion ?? ''));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [parecidos, setParecidos] = useState<ClienteParecido[]>([]);
  const [ignorarDup, setIgnorarDup] = useState(false);
  const [dupDe, setDupDe] = useState<1 | 2>(1);

  async function guardarFila(payload: Record<string, unknown>, id: string | null) {
    const result = await apiGuardarCliente(payload, id);
    if (result.yaExistia && result.id) {
      toast.success(
        mensajeClienteYaExiste(result.nombre || 'Este cliente', result.motivo ?? 'telefono'),
      );
    }
    return {
      error: result.error ? { message: result.error } : null,
      data: result.id ? { id: result.id } : null,
      yaExistia: result.yaExistia,
    };
  }

  const submitPaso1 = async (opts?: { ignorar?: boolean; usarExistente?: boolean }) => {
    const payload =
      customerType === 'natural'
        ? {
            customerType,
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            email: email.trim(),
            telegram_username: telegramUsername.trim(),
          }
        : {
            customerType,
            razon_social: razonSocial.trim(),
            telefono: telefono.trim(),
            email: email.trim(),
            telegram_username: telegramUsername.trim(),
          };

    const parsed = paso1Schema.safeParse(payload);
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

    const dup = await apiBuscarDuplicadosCliente({
      telefono: parsed.data.telefono,
      excludeId: clienteId,
    });
    if (dup.error) {
      toast.error('No se pudo comprobar si ya existe un cliente parecido. ' + dup.error);
      return;
    }
    if (
      dup.parecidos.length &&
      !(opts?.ignorar || opts?.usarExistente || ignorarDup) &&
      !clienteId
    ) {
      setDupDe(1);
      setParecidos(dup.parecidos);
      return;
    }

    setSaving(true);
    try {
      const tg = normalizarTelegramUsername(parsed.data.telegram_username) || null;
      const statusAlta = clienteId ? {} : { status: 'activo' };
      const insertData: Record<string, unknown> =
        parsed.data.customerType === 'natural'
          ? {
              customer_type: 'natural',
              tipo: 'Natural',
              nombre: parsed.data.nombre,
              email: parsed.data.email || null,
              telefono: parsed.data.telefono,
              movil: parsed.data.telefono,
              telegram_username: tg,
              ...statusAlta,
            }
          : {
              customer_type: 'juridico',
              tipo: 'Juridico',
              nombre: parsed.data.razon_social,
              razon_social: parsed.data.razon_social,
              email: parsed.data.email || null,
              telefono: parsed.data.telefono,
              movil: parsed.data.telefono,
              telegram_username: tg,
              ...statusAlta,
            };
      if (opts?.ignorar) insertData.forzar_nuevo = true;

      const result = await guardarFila(insertData, clienteId);
      if (result.error) {
        toast.error(`Error al guardar: ${result.error.message}`);
        return;
      }
      const id = String((result.data as { id?: string } | null)?.id ?? clienteId ?? '');
      if (!id) {
        toast.error('Se guardó el cliente pero no se obtuvo el identificador.');
        router.push('/clientes');
        return;
      }
      setClienteId(id);
      setParecidos([]);
      setIgnorarDup(false);
      toast.success(clienteId ? 'Contacto actualizado' : 'Cliente guardado');
      setPaso(2);
      if (!isEditing) router.replace(`/clientes/${id}/editar?paso=2`);
    } finally {
      setSaving(false);
    }
  };

  const submitPaso2 = async (opts?: { ignorar?: boolean; usarExistente?: boolean }) => {
    if (!clienteId) {
      toast.error('Primero guarda el contacto (paso 1).');
      return;
    }
    if (rif.trim() && rif.trim().length < 4) {
      setErrors({ rif: 'RIF inválido.' });
      return;
    }
    setErrors({});

    const dup = await apiBuscarDuplicadosCliente({
      rif: rif.trim() || null,
      cedula: cedula.trim() || null,
      excludeId: clienteId,
    });
    if (dup.error) {
      toast.error('No se pudo comprobar duplicados. ' + dup.error);
      return;
    }
    if (dup.parecidos.length && !(opts?.ignorar || opts?.usarExistente || ignorarDup)) {
      setDupDe(2);
      setParecidos(dup.parecidos);
      return;
    }

    setSaving(true);
    try {
      const contrato: Record<string, unknown> = {
        apellido: apellido.trim() || null,
        cedula: cedula.trim() || null,
        rif: rif.trim() || null,
        representante_legal: representanteLegal.trim() || null,
        genero: genero || null,
        estado_civil: estadoCivil.trim() || null,
        profesion: profesion.trim() || null,
        direccion: domicilio.trim() || null,
      };
      if (customerType === 'juridico' && razonSocial.trim()) {
        contrato.razon_social = razonSocial.trim();
        contrato.nombre = razonSocial.trim();
      }
      const result = await guardarFila(contrato, clienteId);
      if (result.error) {
        toast.error(`Error al guardar: ${result.error.message}`);
        return;
      }
      toast.success('Datos de contrato guardados');
      router.push('/clientes');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const avisoDup =
    parecidos.length > 0 ? (
      <div
        className="rounded-2xl border p-4 text-sm"
        style={{
          borderColor: 'rgba(255,149,0,0.35)',
          background: 'rgba(255,149,0,0.12)',
          color: 'var(--label-primary)',
        }}
      >
        <p className="font-semibold">Este cliente ya está en el sistema</p>
        <p className="mt-1 text-xs" style={{ color: tintaTexto(0.6) }}>
          Lo vincularemos a su empresa para no crear un duplicado. Un mismo cliente puede ser de
          varias empresas (Casa Inteligente, DIMAQUINAS, etc.).
        </p>
        <ul className="mt-2 space-y-1">
          {parecidos.slice(0, 3).map((p) => (
            <li key={p.id}>
              <Link href={`/clientes/${p.id}`} className="font-semibold" style={{ color: 'var(--tono-azul)' }}>
                {p.nombre}
              </Link>
              <span style={{ color: tintaTexto(0.5) }}> ({etiquetaMotivoDuplicado(p.motivo)})</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const primero = parecidos[0];
              setParecidos([]);
              if (dupDe === 2 && primero) {
                void (async () => {
                  await apiGuardarCliente({
                    nombre: primero.nombre,
                    cedula: cedula.trim() || null,
                    rif: rif.trim() || null,
                  });
                  router.push(`/clientes/${primero.id}`);
                  router.refresh();
                })();
                return;
              }
              void submitPaso1({ usarExistente: true });
            }}
            className="rounded-xl px-4 py-2.5 text-[13px] font-semibold"
            style={{
              background: 'rgba(0,122,255,0.2)',
              color: 'var(--tono-azul)',
              border: '1px solid rgba(0,122,255,0.35)',
            }}
          >
            Usar este cliente
          </button>
          {parecidos.every((p) => puedeForzarNuevoPorTelefono(p.motivo)) ? (
            <button
              type="button"
              onClick={() => {
                setIgnorarDup(true);
                setParecidos([]);
                void (dupDe === 1 ? submitPaso1({ ignorar: true }) : submitPaso2({ ignorar: true }));
              }}
              className="rounded-xl px-4 py-2.5 text-[13px] font-semibold"
              style={{
                background: 'rgba(255,149,0,0.2)',
                color: 'var(--tono-naranja)',
                border: '1px solid rgba(255,149,0,0.35)',
              }}
            >
              Crear uno nuevo (otro cliente, mismo teléfono)
            </button>
          ) : null}
        </div>
      </div>
    ) : null;

  const botonClass =
    'w-full rounded-2xl border px-4 py-3.5 text-[15px] font-bold transition disabled:opacity-60';

  return (
    <div className="min-h-screen px-4 pb-24 pt-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="mx-auto max-w-2xl space-y-5">
        {!isEditing ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <Link href="/clientes" className="text-[13px] font-medium" style={{ color: 'var(--tono-azul)' }}>
                ← Volver a clientes
              </Link>
              <h1 className="mt-1 text-xl font-bold" style={{ color: 'var(--label-primary)' }}>
                Nuevo cliente
              </h1>
            </div>
            <BotonTema />
          </div>
        ) : null}
        <div
          className="rounded-2xl border p-1"
          style={{ borderColor: tinta(0.1), background: 'var(--superficie)' }}
        >
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setCustomerType('natural')}
              className="rounded-xl px-3 py-3 text-[13px] font-semibold transition"
              style={{
                background: customerType === 'natural' ? 'rgba(0,122,255,0.18)' : 'transparent',
                color: customerType === 'natural' ? 'var(--tono-azul)' : tintaTexto(0.5),
                border: customerType === 'natural' ? '1px solid rgba(0,122,255,0.4)' : '1px solid transparent',
              }}
            >
              Persona Natural
            </button>
            <button
              type="button"
              onClick={() => setCustomerType('juridico')}
              className="rounded-xl px-3 py-3 text-[13px] font-semibold transition"
              style={{
                background: customerType === 'juridico' ? 'rgba(0,122,255,0.18)' : 'transparent',
                color: customerType === 'juridico' ? 'var(--tono-azul)' : tintaTexto(0.5),
                border: customerType === 'juridico' ? '1px solid rgba(0,122,255,0.4)' : '1px solid transparent',
              }}
            >
              Persona Jurídica
            </button>
          </div>
        </div>

        {avisoDup}

        {(paso === 1 || yaExiste) && (
          <div
            className="space-y-4 rounded-2xl border p-5"
            style={{ borderColor: tinta(0.1), background: 'var(--superficie)' }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: tintaTexto(0.45) }}>
                Paso 1 · Contacto
              </p>
              <p className="mt-1 text-sm" style={{ color: tintaTexto(0.55) }}>
                Nombre y teléfono bastan para crear el cliente. El email y Telegram son opcionales.
              </p>
            </div>

            {customerType === 'natural' ? (
              <Field label="Nombre" required error={errors.nombre}>
                <Input placeholder="Ej: Carlos Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </Field>
            ) : (
              <Field label="Razón social" required error={errors.razon_social}>
                <Input
                  placeholder="Ej: Casa Inteligente C.A."
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                />
              </Field>
            )}

            <Field label="Teléfono" required error={errors.telefono}>
              <Input
                placeholder="+58 414-1234567"
                inputMode="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" error={errors.email}>
                <Input
                  placeholder="correo@dominio.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Usuario de Telegram" error={errors.telegram_username}>
                <Input
                  placeholder="@usuario"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={() => void submitPaso1()}
              disabled={saving}
              className={botonClass}
              style={{
                borderColor: 'rgba(0,122,255,0.4)',
                background: 'rgba(0,122,255,0.2)',
                color: 'var(--tono-azul)',
              }}
            >
              {saving ? 'Guardando…' : clienteId ? 'Actualizar contacto' : 'Guardar y continuar'}
            </button>
          </div>
        )}

        {(paso === 2 || yaExiste) && (
          <div
            className="space-y-4 rounded-2xl border p-5"
            style={{ borderColor: tinta(0.1), background: 'var(--superficie)' }}
          >
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--label-primary)' }}>
                Paso 2 · Datos para contrato
              </h2>
              <p className="mt-1 text-xs" style={{ color: tintaTexto(0.45) }}>
                Opcional. Cédula o RIF, domicilio, estado civil y profesión para firmar contratos. Puedes
                dejarlo para después.
              </p>
            </div>

            {customerType === 'natural' ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Apellido" error={errors.apellido}>
                    <Input placeholder="Ej: Pérez" value={apellido} onChange={(e) => setApellido(e.target.value)} />
                  </Field>
                  <Field label="C.I." error={errors.cedula}>
                    <Input
                      placeholder="V-12345678"
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="RIF" error={errors.rif}>
                  <Input placeholder="V-12345678-9 (si aplica)" value={rif} onChange={(e) => setRif(e.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <Field label="RIF" error={errors.rif}>
                  <Input placeholder="J-12345678-9" value={rif} onChange={(e) => setRif(e.target.value)} />
                </Field>
                <div className="flex gap-3">
                  <div className="w-[5.5rem] shrink-0">
                    <Field label="Tratamiento" error={errors.genero}>
                      <Select value={genero} onChange={(e) => setGenero((e.target.value as GeneroContrato) || '')}>
                        <option value="">—</option>
                        <option value="M">Sr.</option>
                        <option value="F">Sra.</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Field label="Representante legal" error={errors.representante_legal}>
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

            {customerType === 'natural' ? (
              <div className="flex gap-3">
                <div className="w-[5.5rem] shrink-0">
                  <Field label="Tratamiento" error={errors.genero}>
                    <Select value={genero} onChange={(e) => setGenero((e.target.value as GeneroContrato) || '')}>
                      <option value="">—</option>
                      <option value="M">Sr.</option>
                      <option value="F">Sra.</option>
                    </Select>
                  </Field>
                </div>
                <div className="min-w-0 flex-1">
                  <Field label="Estado civil" error={errors.estado_civil}>
                    <Input
                      list="estados-civiles-cliente"
                      placeholder="Ej: casado"
                      value={estadoCivil}
                      onChange={(e) => setEstadoCivil(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <Field label="Estado civil del representante" error={errors.estado_civil}>
                <Input
                  list="estados-civiles-cliente"
                  placeholder="Ej: casado"
                  value={estadoCivil}
                  onChange={(e) => setEstadoCivil(e.target.value)}
                />
              </Field>
            )}
            <datalist id="estados-civiles-cliente">
              {ESTADOS_CIVILES.map((ec) => (
                <option key={ec} value={ec} />
              ))}
            </datalist>

            <Field label="Profesión" error={errors.profesion}>
              <Input
                placeholder="Ej: ingeniero, comerciante"
                value={profesion}
                onChange={(e) => setProfesion(e.target.value)}
              />
            </Field>
            <Field label="Domicilio" error={errors.domicilio}>
              <Textarea
                rows={2}
                placeholder="Urbanización, calle, ciudad, estado"
                value={domicilio}
                onChange={(e) => setDomicilio(e.target.value)}
              />
            </Field>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void submitPaso2()}
                disabled={saving || !clienteId}
                className={botonClass}
                style={{
                  borderColor: 'rgba(0,122,255,0.4)',
                  background: 'rgba(0,122,255,0.2)',
                  color: 'var(--tono-azul)',
                }}
              >
                {saving ? 'Guardando…' : 'Guardar datos de contrato'}
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push('/clientes');
                  router.refresh();
                }}
                className={botonClass}
                style={{
                  borderColor: tinta(0.15),
                  background: tinta(0.06),
                  color: tintaTexto(0.8),
                }}
              >
                Ahora no
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
