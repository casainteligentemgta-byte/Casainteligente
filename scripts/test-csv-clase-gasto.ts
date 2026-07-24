/**
 * npx tsx scripts/test-csv-clase-gasto.ts
 */
import { parseCsvTablaCompras } from '../lib/contabilidad/parseCsvTablaCompras';

const csv = [
  'CLASE,FECHA,PROVEEDOR,TIPO,CAPITULO,SUBCAPITULO,DESCRIPCION,MONEDA,TASA,MONTO BASE (USD),HONORARIOS,ESTADO',
  'GASTO,2024-01-15,ACME,MATERIALES,OBRA,HIERRO,Cabillas,USD,1,100,15,PAGADO',
  'INGRESO,2024-01-16,CLIENTE,,,,Aporte,USD,1,500,0,PAGADO',
  'CONTRATO,2024-01-17,CONTRATISTA,CONTRATISTA,,,Contrato X,USD,1,1000,150,PENDIENTE',
  'GASTO,2024-01-18,BETA,INSUMOS,OBRA,PINTURA,Pintura,USD,1,50,0,PAGADO',
].join('\n');

const filas = parseCsvTablaCompras(csv);
if (filas.length !== 2) throw new Error(`expected 2 gastos, got ${filas.length}`);
if (filas[0]!.cco?.honorarios_usd !== 15) throw new Error('honorarios missing');
if (filas[0]!.cco?.capitulo_cco !== 'OBRA') throw new Error('capitulo missing');
if (filas[1]!.cco?.honorarios_usd !== 0) throw new Error('honorarios 0 lost');
console.log('OK test-csv-clase-gasto');
