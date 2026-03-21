import { defineConfig } from 'drizzle-kit';

/** Requiere DATABASE_URL (PostgreSQL, ej. Supabase → Connection string → URI) */
export default defineConfig({
  schema: './lib/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
});
