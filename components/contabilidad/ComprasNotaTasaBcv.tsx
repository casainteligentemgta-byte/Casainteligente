/** Nota bajo la tarjeta de tasa BCV en /contabilidad/compras (texto estático). */
export default function ComprasNotaTasaBcv() {
  return (
    <p
      suppressHydrationWarning
      style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '8px', lineHeight: 1.45 }}
    >
      Totales en <strong style={{ color: '#FF3B30' }}>USD</strong> y{' '}
      <strong style={{ color: '#FFD60A' }}>Bs</strong> (tasa de la factura o del día). El P.U. de cada línea
      se muestra en la moneda original de la factura.
    </p>
  );
}
