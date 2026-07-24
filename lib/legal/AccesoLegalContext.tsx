'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiUrl } from '@/lib/http/apiUrl';
import type { LegalModoProducto, LegalPlan } from '@/lib/legal/accesoLegal';

export type AccesoLegalCliente = {
  loading: boolean;
  ok: boolean;
  deny: boolean;
  unauthorized: boolean;
  motivo: string | null;
  orgId: string | null;
  rolLegal: string | null;
  plan: LegalPlan | null;
  orgNombre: string | null;
  modoProducto: LegalModoProducto;
  /** true = producto solo abogado (sin CRM). */
  standalone: boolean;
  refrescar: () => void;
};

const AccesoLegalContext = createContext<AccesoLegalCliente | null>(null);

export function AccesoLegalProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  const [deny, setDeny] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rolLegal, setRolLegal] = useState<string | null>(null);
  const [plan, setPlan] = useState<LegalPlan | null>(null);
  const [orgNombre, setOrgNombre] = useState<string | null>(null);
  const [modoProducto, setModoProducto] = useState<LegalModoProducto>('integrado');
  const [tick, setTick] = useState(0);

  const refrescar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl('/api/legal/acceso'), {
          credentials: 'include',
          cache: 'no-store',
        });
        if (cancel) return;
        if (res.status === 401) {
          setUnauthorized(true);
          setOk(false);
          setDeny(true);
          return;
        }
        const data = (await res.json()) as {
          acceso?: boolean;
          motivo?: string;
          org_id?: string | null;
          rol_legal?: string | null;
          plan?: LegalPlan | null;
          org_nombre?: string | null;
          modo_producto?: LegalModoProducto;
        };
        const has = Boolean(data.acceso);
        setOk(has);
        setDeny(!has);
        setUnauthorized(false);
        setMotivo(data.motivo ?? null);
        setOrgId(data.org_id ?? null);
        setRolLegal(data.rol_legal ?? null);
        setPlan(data.plan ?? null);
        setOrgNombre(data.org_nombre ?? null);
        setModoProducto(data.modo_producto === 'standalone' ? 'standalone' : 'integrado');
      } catch {
        if (!cancel) {
          setOk(false);
          setDeny(true);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tick]);

  const value = useMemo<AccesoLegalCliente>(
    () => ({
      loading,
      ok,
      deny,
      unauthorized,
      motivo,
      orgId,
      rolLegal,
      plan,
      orgNombre,
      modoProducto,
      standalone: modoProducto === 'standalone',
      refrescar,
    }),
    [
      loading,
      ok,
      deny,
      unauthorized,
      motivo,
      orgId,
      rolLegal,
      plan,
      orgNombre,
      modoProducto,
      refrescar,
    ],
  );

  return (
    <AccesoLegalContext.Provider value={value}>{children}</AccesoLegalContext.Provider>
  );
}

export function useAccesoLegal(): AccesoLegalCliente {
  const ctx = useContext(AccesoLegalContext);
  if (!ctx) {
    throw new Error('useAccesoLegal debe usarse dentro de AccesoLegalProvider');
  }
  return ctx;
}
