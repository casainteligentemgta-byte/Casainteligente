import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const conn = process.env.DATABASE_URL;

/** Cliente SQL (singleton en dev para evitar demasiadas conexiones) */
const globalForDb = globalThis as unknown as {
  nexusSql?: ReturnType<typeof postgres>;
};

function createClient() {
  if (!conn) return null;
  if (!globalForDb.nexusSql) {
    try {
      globalForDb.nexusSql = postgres(conn, { max: 5, prepare: false });
    } catch (e) {
      console.error('[lib/db] postgres() no pudo inicializarse (revisa DATABASE_URL)', e);
      return null;
    }
  }
  return globalForDb.nexusSql;
}

const sql = createClient();

/** Instancia Drizzle; null si falta DATABASE_URL (UI puede mostrar aviso). */
export const db = sql ? drizzle(sql, { schema }) : null;

export type NexusDb = NonNullable<typeof db>;

export function requireDb(): NexusDb {
  if (!db) {
    throw new Error(
      'DATABASE_URL no configurada. Añádela en .env.local para usar Nexus Home con Drizzle.',
    );
  }
  return db;
}

export { schema };
