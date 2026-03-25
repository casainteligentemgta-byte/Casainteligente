import { Mail, MapPin, Phone } from 'lucide-react';
import { PRESUPUESTO_BRAND } from '@/lib/presupuesto/brand';

/** Línea de detalle del presupuesto (P-49 y otros). */
export interface PresupuestoItem {
  descripcion: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

const MONEDA = 'USD';

/** Datos hardcodeados alineados con presupuesto P-49: total $9.961, 17 ítems, 94 artículos. */
const ITEMS_P49: PresupuestoItem[] = [
  { descripcion: 'UNIFI DREAM MACHINE PRO', precioUnitario: 1300, cantidad: 1, subtotal: 1300 },
  {
    descripcion: 'MANO DE OBRA, INSTALACIÓN, CONFIGURACIÓN',
    precioUnitario: 4000,
    cantidad: 1,
    subtotal: 4000,
  },
  { descripcion: 'UNIFI SWITCH PRO 24 POE', precioUnitario: 425, cantidad: 2, subtotal: 850 },
  { descripcion: 'Cámara IP 4MP Bullet', precioUnitario: 72, cantidad: 10, subtotal: 720 },
  { descripcion: 'Cámara IP 4MP Domo', precioUnitario: 78, cantidad: 8, subtotal: 624 },
  { descripcion: 'Disco duro vigilancia 4TB', precioUnitario: 115, cantidad: 4, subtotal: 460 },
  { descripcion: 'Rack / gabinete 12U', precioUnitario: 290, cantidad: 1, subtotal: 290 },
  { descripcion: 'Cable UTP Cat6 (bobina 305m)', precioUnitario: 88, cantidad: 6, subtotal: 528 },
  { descripcion: 'Conectores RJ45 (caja)', precioUnitario: 42, cantidad: 3, subtotal: 126 },
  { descripcion: 'Canal / ducto PVC', precioUnitario: 4.5, cantidad: 24, subtotal: 108 },
  { descripcion: 'Patch panel 24 puertos', precioUnitario: 65, cantidad: 1, subtotal: 65 },
  { descripcion: 'Organizador / bridas y canalización', precioUnitario: 12, cantidad: 8, subtotal: 96 },
  { descripcion: 'Inyectores / adaptadores PoE', precioUnitario: 38, cantidad: 4, subtotal: 152 },
  { descripcion: 'Gabinete de exterior estanco', precioUnitario: 142, cantidad: 2, subtotal: 284 },
  { descripcion: 'Router de gestión / enlace', precioUnitario: 198, cantidad: 1, subtotal: 198 },
  { descripcion: 'UPS 1000–1500 VA', precioUnitario: 160, cantidad: 1, subtotal: 160 },
  {
    descripcion: 'Tornillería, tacos, clips y consumibles de montaje',
    precioUnitario: 0,
    cantidad: 17,
    subtotal: 0,
  },
];

const SUBTOTAL = ITEMS_P49.reduce((acc, i) => acc + i.subtotal, 0);
const DESCUENTO = 0;
const TOTAL_ITEMS = ITEMS_P49.length;
const TOTAL_ARTICULOS = ITEMS_P49.reduce((acc, i) => acc + i.cantidad, 0);

function fmt(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: MONEDA,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function PresupuestoDetalle() {
  return (
    <article
      className={[
        'mx-auto w-full max-w-[210mm] bg-white text-slate-900 shadow-lg print:shadow-none',
        'rounded-lg border border-slate-200/80 print:rounded-none print:border-0',
        'font-sans text-sm antialiased',
      ].join(' ')}
    >
      {/* Cabecera */}
      <header className="flex flex-col gap-6 border-b border-slate-200 px-6 py-8 sm:flex-row sm:items-start sm:justify-between print:px-8 print:py-10">
        <div className="flex items-start gap-4">
          <div
            className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-[#12121a] shadow-sm print:h-12 print:w-12 print:border-slate-300 print:bg-[#2a2a2e]"
            style={{ isolation: 'isolate' }}
          >
            <img
              src="/logo-casa-inteligente.png"
              alt=""
              width={56}
              height={56}
              className="h-full w-full object-cover mix-blend-multiply"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              CASA INTELIGENTE, C.A.
            </h1>
            <p className="mt-1 text-xs font-medium leading-snug text-slate-500">
              RIF {PRESUPUESTO_BRAND.rifEmpresa}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Presupuesto</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">P-49</p>
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-500">Fecha: </span>
            25 enero 2024
          </p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-emerald-700 print:text-black">
            {fmt(9961)}
          </p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
      </header>

      {/* Cliente (opcional genérico) */}
      <section className="border-b border-slate-100 px-6 py-5 print:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente</p>
        <p className="mt-1 font-medium text-slate-900">A la orden — referencia P-49</p>
      </section>

      {/* Tabla */}
      <div className="overflow-x-auto px-2 py-4 sm:px-6 print:px-8 print:py-6">
        <table className="w-full min-w-[600px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600 print:bg-transparent">
              <th className="px-3 py-3 sm:px-4">Descripción</th>
              <th className="px-3 py-3 text-right tabular-nums sm:px-4">Precio unitario</th>
              <th className="px-3 py-3 text-right tabular-nums sm:px-4">Cantidad</th>
              <th className="px-3 py-3 text-right tabular-nums sm:px-4">Sub total</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS_P49.map((item, idx) => (
              <tr
                key={`${item.descripcion}-${idx}`}
                className={[
                  'border-b border-slate-100 transition-colors',
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60',
                  'print:bg-transparent',
                  idx % 2 === 1 ? 'print:bg-slate-50' : '',
                ].join(' ')}
              >
                <td className="max-w-[280px] px-3 py-2.5 align-top text-slate-800 sm:max-w-none sm:px-4 sm:py-3">
                  {item.descripcion}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700 sm:px-4 sm:py-3">
                  {fmt(item.precioUnitario)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700 sm:px-4 sm:py-3">
                  {item.cantidad}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-slate-900 sm:px-4 sm:py-3">
                  {fmt(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pie: totales + condiciones + contacto */}
      <footer className="border-t border-slate-200 px-6 py-8 print:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 print:border-slate-300 print:bg-transparent">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Resumen</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4 tabular-nums">
                <dt className="text-slate-600">Sub-total</dt>
                <dd className="font-semibold text-slate-900">{fmt(SUBTOTAL)}</dd>
              </div>
              <div className="flex justify-between gap-4 tabular-nums">
                <dt className="text-slate-600">Descuento</dt>
                <dd className="font-semibold text-slate-900">{fmt(DESCUENTO)}</dd>
              </div>
              <div className="flex justify-between gap-4 tabular-nums">
                <dt className="text-slate-600">Total de ítems</dt>
                <dd className="font-semibold text-slate-900">{TOTAL_ITEMS}</dd>
              </div>
              <div className="flex justify-between gap-4 tabular-nums">
                <dt className="text-slate-600">Total de artículos</dt>
                <dd className="font-semibold text-slate-900">{TOTAL_ARTICULOS}</dd>
              </div>
              <div className="mt-3 flex justify-between gap-4 border-t border-slate-200 pt-3 text-base tabular-nums">
                <dt className="font-bold text-slate-900">Total</dt>
                <dd className="font-bold text-emerald-700 print:text-black">{fmt(9961)}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Condiciones comerciales</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-700">
                <li>
                  <span className="font-medium text-slate-800">Vigencia:</span> 3 días hábiles.
                </li>
                <li>
                  <span className="font-medium text-slate-800">Pago:</span> 80% de abono inicial; el saldo al finalizar
                  el trabajo.
                </li>
                <li>
                  <span className="font-medium text-slate-800">Zelle:</span>{' '}
                  <span className="break-all font-mono text-xs text-slate-800">casainteligentemgta@gmail.com</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
              <p className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                <span>0412-2117270 · 0414-7937270</span>
              </p>
              <p className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                <span className="break-all">casainteligentemgta@gmail.com</span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                <span>CASA INTELIGENTE, C.A. — Venezuela</span>
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Ajuste A4 al imprimir (sin styled-jsx) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print { @page { size: A4; margin: 12mm; } }`,
        }}
      />
    </article>
  );
}

export default PresupuestoDetalle;
