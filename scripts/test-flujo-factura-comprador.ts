/**
 * npx tsx scripts/test-flujo-factura-comprador.ts
 */
import { siguientePasoFlujoFacturaComprador } from '../lib/telegram/flujoFacturaCompradorTelegram';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const paso = siguientePasoFlujoFacturaComprador(
    {
      invoice_number: 'F-1',
      moneda: null,
      condicion_pago: null,
      date: '2026-07-01',
      fecha_auditoria_confirmada: true,
    },
    { proyecto_id: null, entidad_id: null, ubicacion_destino_id: null },
  );
  assert(paso === 'moneda', `esperado moneda, got ${paso}`);
}

{
  const paso = siguientePasoFlujoFacturaComprador(
    {
      moneda: 'USD',
      condicion_pago: null,
      fecha_auditoria_confirmada: true,
    },
    null,
  );
  assert(paso === 'condicion', `esperado condicion, got ${paso}`);
}

{
  const paso = siguientePasoFlujoFacturaComprador(
    {
      moneda: 'VES',
      condicion_pago: 'contado',
      fecha_auditoria_confirmada: true,
    },
    { proyecto_id: null, entidad_id: null, ubicacion_destino_id: null },
  );
  assert(paso === 'destino', `esperado destino, got ${paso}`);
}

{
  const paso = siguientePasoFlujoFacturaComprador(
    {
      moneda: 'VES',
      condicion_pago: 'contado',
      fecha_auditoria_confirmada: true,
    },
    {
      proyecto_id: 'p1',
      entidad_id: 'e1',
      ubicacion_destino_id: null,
    },
  );
  assert(paso === 'destino', `con obra sin almacén → destino, got ${paso}`);
}

{
  const paso = siguientePasoFlujoFacturaComprador(
    {
      moneda: 'VES',
      condicion_pago: 'contado',
      fecha_auditoria_confirmada: true,
    },
    {
      proyecto_id: 'p1',
      entidad_id: 'e1',
      ubicacion_destino_id: 'u1',
    },
  );
  assert(paso === 'completo', `completo got ${paso}`);
}

console.log('OK test-flujo-factura-comprador');
