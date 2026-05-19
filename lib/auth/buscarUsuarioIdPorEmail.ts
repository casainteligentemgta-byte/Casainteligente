import type { SupabaseClient } from '@supabase/supabase-js';

/** Busca el UUID de auth.users por correo (requiere cliente con service role). */
export async function buscarUsuarioIdPorEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ userId: string } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: 'email vacío' };

  const authAdmin = admin.auth.admin as {
    getUserByEmail?: (e: string) => Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }>;
    listUsers?: (opts: { page?: number; perPage?: number }) => Promise<{
      data: { users: { id: string; email?: string | null }[] };
      error: { message: string } | null;
    }>;
  };

  if (typeof authAdmin.getUserByEmail === 'function') {
    const { data, error } = await authAdmin.getUserByEmail(normalized);
    if (error) return { error: error.message };
    if (!data?.user?.id) return { error: 'Usuario no encontrado en Auth' };
    return { userId: data.user.id };
  }

  if (typeof authAdmin.listUsers === 'function') {
    const { data, error } = await authAdmin.listUsers({ page: 1, perPage: 1000 });
    if (error) return { error: error.message };
    const found = data.users.find((u) => (u.email ?? '').trim().toLowerCase() === normalized);
    if (!found) return { error: 'Usuario no encontrado en Auth' };
    return { userId: found.id };
  }

  return { error: 'Auth Admin API no disponible en este cliente' };
}
