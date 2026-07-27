'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AccesoEmpleadoPanel from '@/components/empleados/AccesoEmpleadoPanel';
import { createClient } from '@/lib/supabase/client';

type CrmEmployee = {
  id: string;
  nombres?: string | null;
  apellidos?: string | null;
  email?: string | null;
  cargo?: string | null;
  estatus?: string | null;
  auth_user_id?: string | null;
  acceso_habilitado?: boolean | null;
};

type CiEmpleado = {
  id: string;
  nombre_completo?: string | null;
  estado?: string | null;
  semaforo?: string | null;
};

export default function EmpleadoFichaPage() {
  const params = useParams();
  const id = String(params?.id ?? '').trim();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crm, setCrm] = useState<CrmEmployee | null>(null);
  const [ci, setCi] = useState<CiEmpleado | null>(null);

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
      setCrm(null);
      setCi(null);

      const crmRes = await supabase
        .from('employees')
        .select(
          'id,nombres,apellidos,email,cargo,estatus,auth_user_id,acceso_habilitado',
        )
        .eq('id', id)
        .maybeSingle();

      if (!alive) return;

      if (!crmRes.error && crmRes.data) {
        setCrm(crmRes.data as CrmEmployee);
        setLoading(false);
        return;
      }

      const ciRes = await supabase
        .from('ci_empleados')
        .select('id,nombre_completo,estado,semaforo')
        .eq('id', id)
        .maybeSingle();

      if (!alive) return;
      setLoading(false);
      if (ciRes.error) {
        setError(ciRes.error.message);
        return;
      }
      if (!ciRes.data) {
        setError('Empleado no encontrado.');
        return;
      }
      setCi(ciRes.data as CiEmpleado);
    })();
    return () => {
      alive = false;
    };
  }, [id, supabase]);

  const tituloCrm = crm
    ? [crm.nombres, crm.apellidos].filter(Boolean).join(' ').trim()
    : null;

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-4 pb-28 pt-6">
      <div className="mx-auto max-w-lg space-y-4">
        <Link
          href={crm ? '/empleados' : '/rrhh/reclutamiento'}
          className="text-sm font-medium text-sky-400 hover:underline"
        >
          ← {crm ? 'Empleados' : 'Reclutamiento'}
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <h1 className="text-xl font-bold text-white">Ficha de empleado</h1>
          {loading ? <p className="mt-4 text-sm text-zinc-500">Cargando…</p> : null}
          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

          {!loading && !error && crm ? (
            <div className="mt-4 space-y-2 text-sm text-zinc-200">
              <p>
                <span className="font-semibold text-white">{tituloCrm || 'Sin nombre'}</span>
              </p>
              {crm.cargo ? <p className="text-zinc-400">{crm.cargo}</p> : null}
              {crm.email ? <p className="text-zinc-400">{crm.email}</p> : null}
              <div className="pt-3">
                <Link
                  href={`/empleados/${id}/editar`}
                  className="inline-flex rounded-xl bg-[#007AFF] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Editar ficha
                </Link>
              </div>
            </div>
          ) : null}

          {!loading && !error && ci ? (
            <p className="mt-4 text-sm text-zinc-200">
              <span className="font-semibold text-white">
                {ci.nombre_completo ?? 'Sin nombre'}
              </span>
            </p>
          ) : null}
        </div>

        {crm ? (
          <AccesoEmpleadoPanel
            employeeId={crm.id}
            email={crm.email ?? ''}
            nombres={crm.nombres ?? undefined}
            apellidos={crm.apellidos ?? undefined}
            authUserId={crm.auth_user_id}
            accesoHabilitado={Boolean(crm.acceso_habilitado)}
            onChanged={({ authUserId, accesoHabilitado }) => {
              setCrm((prev) =>
                prev
                  ? {
                      ...prev,
                      auth_user_id: authUserId,
                      acceso_habilitado: accesoHabilitado,
                    }
                  : prev,
              );
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
