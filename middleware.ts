import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { debeCambiarPassword } from '@/lib/auth/passwordPolicy'

export async function middleware(request: NextRequest) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    let response = NextResponse.next({ request })

    if (!url || !key || url.includes('placeholder')) {
        return response
    }

    const supabase = createServerClient(url, key, {
        cookies: {
            get(name: string) {
                return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: CookieOptions) {
                request.cookies.set({ name, value, ...options })
                response = NextResponse.next({ request })
                response.cookies.set({ name, value, ...options })
            },
            remove(name: string, options: CookieOptions) {
                request.cookies.set({ name, value: '', ...options })
                response = NextResponse.next({ request })
                response.cookies.set({ name, value: '', ...options })
            },
        },
    })

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Usuario autenticado con clave temporal → forzar cambio
    if (user && debeCambiarPassword(user.app_metadata as Record<string, unknown>)) {
        const allow =
            pathname.startsWith('/cambiar-password') ||
            pathname.startsWith('/api/auth/me') ||
            pathname.startsWith('/login') ||
            pathname.startsWith('/auth')
        if (!allow) {
            const dest = request.nextUrl.clone()
            dest.pathname = '/cambiar-password'
            dest.search = ''
            return NextResponse.redirect(dest)
        }
    }

    // Ya cambió clave y visita /cambiar-password → inicio
    if (
        user &&
        !debeCambiarPassword(user.app_metadata as Record<string, unknown>) &&
        pathname.startsWith('/cambiar-password')
    ) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    // Sesión activa en /login → redirigir
    if (user && (pathname === '/login' || pathname.startsWith('/login/'))) {
        if (debeCambiarPassword(user.app_metadata as Record<string, unknown>)) {
            return NextResponse.redirect(new URL('/cambiar-password', request.url))
        }
        const next = request.nextUrl.searchParams.get('next')?.trim() || '/'
        const safe =
            next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')
                ? next
                : '/'
        return NextResponse.redirect(new URL(safe, request.url))
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
}
