import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente Supabase para el navegador.
 * Si faltan variables en build (p. ej. un proyecto Vercel sin env),
 * usa placeholders para no tumbar el build; en runtime deben existir.
 */
export const createClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

    return createBrowserClient(
        url || 'https://placeholder.supabase.co',
        key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    )
}
