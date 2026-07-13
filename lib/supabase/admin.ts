import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error('SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL no configurada.');
  }
  return url;
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key || key === 'TU_SERVICE_ROLE_KEY') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.');
  }
  return key;
}

export function createSupabaseAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), getServiceRoleKey());
  }
  return adminClient;
}
