/** Parsea respuesta de API; evita "Unexpected token '<'" cuando Next devuelve HTML de error. */
export async function parseFetchJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      res.ok
        ? 'El servidor respondió vacío.'
        : `Error del servidor (${res.status}). Reinicia con npm run dev:fresh e intenta de nuevo.`,
    );
  }
  if (trimmed.startsWith('<')) {
    throw new Error(
      `Error del servidor (${res.status}): la API no respondió JSON (¿compilación fallida?). ` +
        'Reinicia npm run dev:fresh. Si persiste, revisa la consola del terminal.',
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error('Respuesta del servidor no es JSON válido.');
  }
}
