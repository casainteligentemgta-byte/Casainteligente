import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { procesarComandoTelegram } from '@/lib/telegram/commands';
import {
  MENSAJE_CARGAR_FACTURA_O_NOTA,
  PREFIX_CARGA,
  TECLADO_CARGAR_FACTURA_O_NOTA,
} from '@/lib/telegram/menuCargaTelegram';
import { mensajeModoFacturasActivado } from '@/lib/telegram/mensajesFactura';

const TEXTO_ELIMINADO_MENU = [
  'Lo que cargue queda',
  'precargado',
  'pendiente de ingreso en el almacén',
  'Con foto (IA)',
  'solo se piden los datos que falten',
  'se escriben todos los datos',
];

const TEXTO_ELIMINADO_COMPRADOR = [
  'Tras leerla',
  'montos están en',
  'contado',
  'crédito',
  'Luego elija destino',
  'Obra (AD)',
  'Gasto de entidad (OpEx)',
  'Contabilidad y precarga',
  'sin almacén',
];

describe('menú /facturas: Cargar factura o nota', () => {
  it('deja solo el título', () => {
    assert.equal(MENSAJE_CARGAR_FACTURA_O_NOTA, '🧾 <b>Cargar factura o nota</b>');
    for (const fragmento of TEXTO_ELIMINADO_MENU) {
      assert.doesNotMatch(MENSAJE_CARGAR_FACTURA_O_NOTA, new RegExp(fragmento.replace(/[()]/g, '\\$&')));
    }
  });

  it('conserva los tres botones y sus callbacks', () => {
    assert.deepEqual(TECLADO_CARGAR_FACTURA_O_NOTA, {
      inline_keyboard: [
        [{ text: '📷 Factura con foto (IA)', callback_data: `${PREFIX_CARGA}factura_ia` }],
        [{ text: '✍️ Factura manual', callback_data: `${PREFIX_CARGA}factura_manual` }],
        [{ text: '📄 Nota de entrega (foto)', callback_data: `${PREFIX_CARGA}nota` }],
      ],
    });
  });
});

describe('mensaje COMPRADOR: cargar factura', () => {
  it('conserva título, foto y /cancelar', () => {
    const texto = mensajeModoFacturasActivado();
    assert.match(texto, /✅ <b>COMPRADOR: cargar factura\.<\/b>/);
    assert.match(texto, /Envía una <b>foto<\/b> de la factura de compra\./);
    assert.match(texto, /<code>\/cancelar<\/code> para salir de este modo\./);
    for (const fragmento of TEXTO_ELIMINADO_COMPRADOR) {
      assert.doesNotMatch(texto, new RegExp(fragmento.replace(/[()]/g, '\\$&')));
    }
  });

  it('sigue mostrando la procura vinculada cuando hay ticket', () => {
    const texto = mensajeModoFacturasActivado({ ticket: 'PR-12' });
    assert.match(texto, /Procura vinculada: <b>PR-12<\/b>/);
    assert.match(texto, /Envía una <b>foto<\/b> de la factura de compra\./);
    assert.doesNotMatch(texto, /Luego elija destino/);
  });

  it('/facturas y /factura reutilizan el mismo texto corto', () => {
    const esperado = mensajeModoFacturasActivado();
    assert.equal(procesarComandoTelegram('/facturas').mensaje, esperado);
    assert.equal(procesarComandoTelegram('/factura').mensaje, esperado);
  });
});
