export function requireWorkerAuth(req: Request): Response | null {
  const expected = process.env.OBRA_TOURS_WORKER_TOKEN?.trim();
  if (!expected) return null; // auth opcional si no hay token configurado

  const header =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
    req.headers.get('x-obra-tours-token')?.trim() ||
    '';

  if (!header || header !== expected) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }
  return null;
}
