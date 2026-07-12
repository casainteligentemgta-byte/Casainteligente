import postgres from 'postgres';

function parsePgUrl(url: string) {
  const m = url.match(
    /^postgresql:\/\/([^:]+):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/,
  );
  if (!m) return null;
  const [, user, password, host, port, database, query] = m;
  const ssl =
    query && /sslmode=require/i.test(query) ? { rejectUnauthorized: false } : undefined;
  return {
    user: decodeURIComponent(user),
    password: decodeURIComponent(password),
    host,
    port: port ? Number(port) : 5432,
    database,
    ssl,
  };
}

async function tryPooler(
  parsed: NonNullable<ReturnType<typeof parsePgUrl>>,
  opts: Record<string, unknown>,
  projectRef: string,
) {
  const ssl = { rejectUnauthorized: false };
  const user = parsed.user.includes('.') ? parsed.user : `postgres.${projectRef}`;
  const hosts: Array<[string, number]> = [
    ['aws-1-us-east-1.pooler.supabase.com', 6543],
    ['aws-0-us-east-1.pooler.supabase.com', 6543],
  ];
  const regions = ['us-east-1', 'us-west-1', 'eu-west-1', 'eu-central-1', 'sa-east-1'];
  for (const region of regions) {
    hosts.push([`aws-0-${region}.pooler.supabase.com`, 6543]);
    hosts.push([`aws-1-${region}.pooler.supabase.com`, 6543]);
  }

  for (const [host, port] of hosts) {
    try {
      const sql = postgres({ ...parsed, ...opts, host, port, user, ssl });
      await sql`select 1`;
      return sql;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

/** Conexión Postgres admin (pooler Supabase) desde variables de entorno del servidor. */
export async function connectPostgresFromEnv(): Promise<ReturnType<typeof postgres>> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL no configurada en el servidor.');

  const poolerUrl = process.env.DATABASE_POOLER_URL?.trim();
  const opts = { max: 1, prepare: false, connect_timeout: 25 };
  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';

  if (poolerUrl) {
    const parsed = parsePgUrl(poolerUrl);
    if (parsed) {
      const sql = postgres({ ...parsed, ...opts, ssl: { rejectUnauthorized: false } });
      await sql`select 1`;
      return sql;
    }
  }

  const parsed = parsePgUrl(url);
  if (parsed && projectRef) {
    const pooled = await tryPooler(parsed, opts, projectRef);
    if (pooled) return pooled;
  }

  if (parsed) {
    const sql = postgres({ ...parsed, ...opts, ssl: { rejectUnauthorized: false } });
    await sql`select 1`;
    return sql;
  }

  const sql = postgres(url, opts);
  await sql`select 1`;
  return sql;
}

export async function columnExists(
  sql: ReturnType<typeof postgres>,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await sql`
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = ${table}
      and column_name = ${column}
    limit 1
  `;
  return rows.length > 0;
}
