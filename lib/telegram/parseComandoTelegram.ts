/** Primer token de un mensaje tipo comando (/obra@Bot, /agua, etc.). */
export function primerTokenComando(texto: string): string {
  const t = texto.trim();
  if (!t) return '';
  return (t.split(/\s+/)[0] ?? '').toLowerCase().split('@')[0] ?? '';
}

/** true si el mensaje inicia el flujo de registro de agua (2 fotos). */
export function esComandoAgua(texto: string): boolean {
  const token = primerTokenComando(texto);
  return token === '/agua' || token === 'agua';
}
