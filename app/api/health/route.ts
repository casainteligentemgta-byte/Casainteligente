import { NextResponse } from 'next/server';

/** Comprueba que Next responde: abre http://127.0.0.1:3000/api/health */
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
