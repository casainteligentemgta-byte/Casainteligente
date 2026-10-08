import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * La aceptación del contrato por enlace se retiró: el contrato de trabajo se imprime,
 * se firma en físico y RRHH carga el ejemplar firmado.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'La aceptación por enlace ya no está disponible. El contrato se firma en físico con la empresa.' },
    { status: 410 },
  );
}
