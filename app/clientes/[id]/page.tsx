'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import CustomerLoyaltyCard from '@/components/clientes/CustomerLoyaltyCard';
import { useCustomerLoyaltyScore } from '@/hooks/useCustomerLoyaltyScore';
import { createClient } from '@/lib/supabase/client';

type CustomerDetail = {
  id: string;
  nombre: string | null;
  customer_type: 'natural' | 'juridico' | null;
  cedula: string | null;
  rif: string | null;
  razon_social: string | null;
  representante_legal: string | null;
  email: string | null;
  telefono: string | null;
  created_at: string | null;
};

export default function ClienteDetallePage() {
  const params = useParams();
  const id = String(params?.id ?? '').trim();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<CustomerDetail | null>(null);
  const loyalty = useCustomerLoyaltyScore(id);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Identificador no válido.');
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('customers')
        .select('id,nombre,customer_type,cedula,rif,razon_social,representante_legal,email,telefono,created_at')
        .eq('id', id)
        .maybeSingle();
      if (!alive) return;
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      setCliente((data as CustomerDetail | null) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 pb-28 pt-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/clientes" className="text-sm font-medium text-[#7cb9ff] hover:underline">
          ← Volver a clientes
        </Link>

        {loading ? <p className="text-sm text-zinc-500">Cargando ficha del cliente...</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        {!loading && !error && !cliente ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-500">Cliente no encontrado.</p>
        ) : null}

        {cliente ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h1 className="text-xl font-bold text-white">{cliente.razon_social ?? cliente.nombre ?? 'Cliente'}</h1>
              <p className="mt-1 text-sm text-zinc-400">
                {cliente.customer_type === 'juridico' ? 'Persona Jurídica' : 'Persona Natural'}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                <p>Cédula: {cliente.cedula ?? '—'}</p>
                <p>RIF: {cliente.rif ?? '—'}</p>
                <p>Email: {cliente.email ?? '—'}</p>
                <p>Teléfono: {cliente.telefono ?? '—'}</p>
                <p>Representante legal: {cliente.representante_legal ?? '—'}</p>
                <p>
                  Alta:{' '}
                  {cliente.created_at ? new Date(cliente.created_at).toLocaleDateString('es-VE', { dateStyle: 'medium' }) : '—'}
                </p>
              </div>
            </div>

            {loyalty.isLoading ? <p className="text-sm text-zinc-500">Calculando score de fidelidad...</p> : null}
            {loyalty.error ? (
              <p className="rounded-xl border border-red-500/20 bg-red-950/20 p-3 text-sm text-red-200">
                No se pudo calcular el score: {loyalty.error.message}
              </p>
            ) : null}
            {loyalty.data ? <CustomerLoyaltyCard model={loyalty.data} /> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
