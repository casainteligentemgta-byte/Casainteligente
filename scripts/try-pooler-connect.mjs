import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const url = env.DATABASE_URL;
const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@/);
if (!m) {
  console.error('No parse DATABASE_URL');
  process.exit(1);
}
const pass = decodeURIComponent(m[2]);
const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] ?? 'mibxmhiruhrbbwcjdvks';

const regions = [
  'us-east-1',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'sa-east-1',
  'ap-southeast-1',
];
const tries = [];
for (const r of regions) {
  tries.push([`aws-0-${r}.pooler.supabase.com`, 6543, `postgres.${ref}`]);
  tries.push([`aws-1-${r}.pooler.supabase.com`, 6543, `postgres.${ref}`]);
}

for (const [host, port, user] of tries) {
  try {
    const sql = postgres({
      host,
      port,
      user,
      password: pass,
      database: 'postgres',
      ssl: 'require',
      max: 1,
      connect_timeout: 15,
    });
    await sql`select 1`;
    await sql.end({ timeout: 2 });
    console.log('OK', user, host, port);
    process.exit(0);
  } catch (e) {
    console.log('FAIL', user, host, port, (e instanceof Error ? e.message : e).slice(0, 80));
  }
}
process.exit(1);
