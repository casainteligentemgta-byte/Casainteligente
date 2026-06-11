import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseFetch } from '@/lib/supabase/supabaseFetch';

const RUTAS_PUBLICAS = [
  '/login',
  '/auth',
  '/registro',
  '/reclutamiento',
  '/nexus',
];

const RUTAS_PROTEGIDAS = [
  '/contabilidad',
  '/almacen',
  '/configuracion',
  '/admin',
  '/proyectos',
  '/talento',
  '/rrhh',
  '/procura',
];

function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function esRutaProtegida(pathname: string): boolean {
  return RUTAS_PROTEGIDAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function esHostLocalDev(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const host = request.nextUrl.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function tieneCookieAuthSupabase(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name));
}

async function resolverUsuarioMiddleware(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (user) return user;
    if (esHostLocalDev(request) && (error || tieneCookieAuthSupabase(request))) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.user ?? null;
    }
    return null;
  } catch {
    if (!esHostLocalDev(request)) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user ?? null;
  }
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  let supabaseResponse = NextResponse.next({ request });

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    global: { fetch: supabaseFetch },
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        supabaseResponse = NextResponse.next({ request });
        supabaseResponse.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        supabaseResponse = NextResponse.next({ request });
        supabaseResponse.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const user = await resolverUsuarioMiddleware(supabase, request);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api')) {
    return supabaseResponse;
  }

  if (user && (pathname === '/login' || pathname.startsWith('/login/'))) {
    const dest = request.nextUrl.searchParams.get('next')?.trim() || '/';
    const safe =
      dest.startsWith('/') && !dest.startsWith('//') && !dest.startsWith('/login') ? dest : '/';
    return NextResponse.redirect(new URL(safe, request.url));
  }

  if (!user && esRutaProtegida(pathname) && !esRutaPublica(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
