/** ¿Hay URL y llave pública reales para hablar con Supabase desde el middleware? */
export function supabasePublicoConfigurado(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): boolean {
  const u = url?.trim() ?? '';
  const k = key?.trim() ?? '';
  if (!u || !k) return false;
  if (/example\.supabase\.co/i.test(u) || u.includes('your-project-url')) return false;
  return true;
}
