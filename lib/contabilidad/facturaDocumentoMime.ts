export function esImagenMimeFactura(
  mimeType: string | null | undefined,
  url: string | null,
): boolean {
  return Boolean(mimeType?.startsWith('image/') || (!mimeType && url != null));
}

export function esPdfMimeFactura(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType?.toLowerCase().includes('pdf'));
}
