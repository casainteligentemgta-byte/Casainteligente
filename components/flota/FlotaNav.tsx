'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Fuel,
  LayoutDashboard,
  MessageSquareText,
  UserRound,
  Wrench,
} from 'lucide-react';
import type { TipoVehiculo } from '@/lib/flota/utils';

export const FLOTA_NAV = [
  { id: 'resumen', href: '/flota', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { id: 'conductores', href: '/flota/conductores', label: 'Conductores', icon: UserRound, exact: false },
  { id: 'gasolina', href: '/flota/gasolina', label: 'Gasolina', icon: Fuel, exact: false },
  { id: 'taller', href: '/flota/mantenimiento', label: 'Taller', icon: Wrench, exact: false },
  { id: 'alertas', href: '/flota/alertas', label: 'Alertas', icon: Bell, exact: false },
  { id: 'mecanico', href: '/flota/chatbot', label: 'Mecánico', icon: MessageSquareText, exact: false },
] as const;

export type FlotaTabId = (typeof FLOTA_NAV)[number]['id'];

export function tabFromPath(pathname: string): FlotaTabId {
  const hit = [...FLOTA_NAV]
    .reverse()
    .find((n) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`)));
  return hit?.id ?? 'resumen';
}

export function hrefFromTab(tab: FlotaTabId): string {
  return FLOTA_NAV.find((n) => n.id === tab)?.href ?? '/flota';
}

type FlotaNavState = {
  embedded: boolean;
  entidadId: string | null;
  defaultTipo: TipoVehiculo;
  api: (path: string) => string;
  go: (href: string) => void;
  loginNext: string;
};

const FlotaNavContext = createContext<FlotaNavState | null>(null);

export function FlotaNavProvider({
  children,
  embedded,
  entidadId,
  defaultTipo = 'camioneta',
  go: goOverride,
}: {
  children: ReactNode;
  embedded?: boolean;
  entidadId?: string | null;
  defaultTipo?: TipoVehiculo;
  go?: (href: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/flota';
  const go = useCallback(
    (href: string) => {
      if (goOverride) {
        goOverride(href);
        return;
      }
      router.push(href);
    },
    [goOverride, router],
  );

  const value = useMemo<FlotaNavState>(
    () => ({
      embedded: Boolean(embedded),
      entidadId: entidadId ?? null,
      defaultTipo,
      api: (path: string) => {
        if (!entidadId) return path;
        const join = path.includes('?') ? '&' : '?';
        return `${path}${join}entidad_id=${encodeURIComponent(entidadId)}`;
      },
      go,
      loginNext: embedded ? '/configuracion/entidades' : pathname,
    }),
    [embedded, entidadId, defaultTipo, go, pathname],
  );

  return <FlotaNavContext.Provider value={value}>{children}</FlotaNavContext.Provider>;
}

export function useFlotaNav(): FlotaNavState {
  const ctx = useContext(FlotaNavContext);
  const router = useRouter();
  const pathname = usePathname() ?? '/flota';
  if (ctx) return ctx;
  return {
    embedded: false,
    entidadId: null,
    defaultTipo: 'camioneta',
    api: (path) => path,
    go: (href) => router.push(href),
    loginNext: pathname,
  };
}

export function FlotaLink({
  href,
  className,
  children,
  ...rest
}: { href: string; className?: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { embedded, go } = useFlotaNav();
  if (embedded) {
    return (
      <button type="button" className={className} onClick={() => go(href)}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
