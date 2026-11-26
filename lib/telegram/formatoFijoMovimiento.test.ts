import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esNumeroDocumentoPlaceholder,
  esRespuestaSiNoComoDocumento,
  numeroDocumentoContabilidad,
  sanitizarNumeroDocumentoMovimiento,
} from '@/lib/almacen/documentoRecepcionCampo';
import { procesarComandoTelegram } from '@/lib/telegram/commands';
import {
  emparejarMaterialFormatoFijo,
  validarStockSalidaFormatoFijo,
  type MaterialFormatoFijo,
} from '@/lib/telegram/formatoFijoMatching';
import {
  MENSAJE_FORMATO_FIJO_AYUDA,
  claveIdempotenciaFormatoFijo,
  esMensajeFormatoFijo,
  fechaMovimientoDesdeMensajeTelegram,
  formatearFechaMensajeCaracas,
  generarNumeroDocumentoIngreso,
  parsearFormatoFijoMovimiento,
  resolverDocIngresoFormatoFijo,
  shortIdDesdeMensajeTelegram,
} from '@/lib/telegram/formatoFijoMovimiento';

const CEMENTO: MaterialFormatoFijo = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Cemento gris',
  sap_code: 'CEM',
  unit: 'SACO',
  cantidadDisponible: 100,
  enAlmacen: true,
};
const TUBO: MaterialFormatoFijo = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Tubo PVC 1/2',
  sap_code: null,
  unit: 'UND',
  cantidadDisponible: 10,
  enAlmacen: true,
};
const TUBO2: MaterialFormatoFijo = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Tubo PVC 3/4',
  sap_code: null,
  unit: 'UND',
  cantidadDisponible: 10,
  enAlmacen: true,
};

describe('parser formato fijo Telegram', () => {
  it('reconoce INGRESO con tildes, mayúsculas y espacios de más', () => {
    const texto = '  Ingreso  \n  doc:  421  \n  proveedor: Cemex  \n  20   cemento  \n  5 tubo pvc 1/2  ';
    assert.equal(esMensajeFormatoFijo(texto), true);
    const r = parsearFormatoFijoMovimiento(texto);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.movimiento.tipo, 'ingreso');
    assert.equal(r.movimiento.doc, '421');
    assert.equal(r.movimiento.proveedor, 'Cemex');
    assert.equal(r.movimiento.lineas.length, 2);
    assert.equal(r.movimiento.lineas[0]?.cantidad, 20);
    assert.equal(r.movimiento.lineas[0]?.descripcion, 'cemento');
    assert.equal(r.movimiento.lineas[1]?.cantidad, 5);
    assert.equal(r.movimiento.lineas[1]?.descripcion, 'tubo pvc 1/2');
  });

  it('acepta SALIDA e INVENTARIO y cantidad decimal con coma', () => {
    const sal = parsearFormatoFijoMovimiento('SALIDA\ndestino/uso: colado losa\n72,5 cemento');
    assert.equal(sal.ok, true);
    if (sal.ok) {
      assert.equal(sal.movimiento.tipo, 'salida');
      assert.equal(sal.movimiento.destinoUso, 'colado losa');
      assert.equal(sal.movimiento.lineas[0]?.cantidad, 72.5);
    }
    const inv = parsearFormatoFijoMovimiento('inventário\n120 cemento');
    assert.equal(inv.ok, true);
    if (inv.ok) assert.equal(inv.movimiento.tipo, 'inventario');
  });

  it('un mensaje suelto INGRESO no interrumpe el wizard', () => {
    assert.equal(esMensajeFormatoFijo('INGRESO'), false);
    assert.equal(esMensajeFormatoFijo('/ingreso'), false);
    assert.equal(parsearFormatoFijoMovimiento('hola cemento').ok, false);
  });

  it('rechaza dos tipos en el mismo mensaje', () => {
    const r = parsearFormatoFijoMovimiento('INGRESO\n20 cemento\nSALIDA\n1 tubo');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, 'varios_tipos');
  });
});

describe('guardia Si/Sí/No como número de documento', () => {
  it('nunca trata Si, Sí, No como factura real', () => {
    for (const n of ['Si', 'Sí', 'sí', 'SI', 'No', 'NO', 'ok', 'yes', 'EMG-Si', 'NE-Si', '  Sí  ']) {
      assert.equal(esRespuestaSiNoComoDocumento(n), true, n);
      assert.equal(esNumeroDocumentoPlaceholder(n), true, n);
      assert.equal(sanitizarNumeroDocumentoMovimiento(n), null, n);
    }
    assert.equal(sanitizarNumeroDocumentoMovimiento('421'), '421');
    assert.equal(numeroDocumentoContabilidad('emergencia', 'Si'), 'EMG-S/N');
    assert.equal(numeroDocumentoContabilidad('nota_entrega', 'Sí'), 'NE-S/N');
    assert.notEqual(numeroDocumentoContabilidad('emergencia', 'Si'), 'EMG-Si');
  });

  it('si falta el doc o viene Si, genera ING-YYYYMMDD-id único', () => {
    const fecha = new Date('2026-11-26T15:00:00.000Z');
    const a = resolverDocIngresoFormatoFijo({
      doc: 'Si',
      fecha,
      chatId: '900',
      messageId: 44,
    });
    const b = resolverDocIngresoFormatoFijo({
      doc: null,
      fecha,
      chatId: '900',
      messageId: 44,
    });
    assert.equal(a.generado, true);
    assert.match(a.doc, /^ING-20261126-[a-z0-9]+$/);
    assert.equal(a.doc, b.doc);
    assert.equal(sanitizarNumeroDocumentoMovimiento(a.doc), a.doc);
    const otro = generarNumeroDocumentoIngreso({ fecha, chatId: '900', messageId: 45 });
    assert.notEqual(otro, a.doc);
  });
});

describe('fecha del mensaje Telegram (no la de proceso)', () => {
  it('usa date, y forward_origin si el mensaje se reenvió', () => {
    const orig = fechaMovimientoDesdeMensajeTelegram({ date: 1_700_000_000 });
    assert.equal(orig.toISOString(), '2023-11-14T22:13:20.000Z');
    const fwd = fechaMovimientoDesdeMensajeTelegram({
      date: 1_800_000_000,
      forward_date: 1_700_000_000,
    });
    assert.equal(fwd.toISOString(), orig.toISOString());
    const origin = fechaMovimientoDesdeMensajeTelegram({
      date: 1_800_000_000,
      forward_origin: { date: 1_700_000_000 },
    });
    assert.equal(origin.toISOString(), orig.toISOString());
    const editado = fechaMovimientoDesdeMensajeTelegram({
      date: 1_700_000_000,
      edit_date: 1_800_000_000,
    });
    assert.equal(editado.toISOString(), orig.toISOString());
    assert.match(formatearFechaMensajeCaracas(orig), /^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
});

describe('matching y stock del formato fijo', () => {
  it('empareja cemento de forma difusa y marca tubo ambiguo', () => {
    const cem = emparejarMaterialFormatoFijo('cemento', [CEMENTO, TUBO]);
    assert.equal(cem.estado, 'unico');
    if (cem.estado === 'unico') assert.equal(cem.material.id, CEMENTO.id);

    const tubo = emparejarMaterialFormatoFijo('tubo pvc', [TUBO, TUBO2]);
    assert.equal(tubo.estado, 'ambiguo');

    const nada = emparejarMaterialFormatoFijo('pintura epóxica xyz', [CEMENTO, TUBO]);
    assert.equal(nada.estado, 'sin_match');
  });

  it('no deja pasar una salida que supera el stock (suma líneas del mismo material)', () => {
    const problemas = validarStockSalidaFormatoFijo([
      {
        ok: true,
        material: { ...CEMENTO, cantidadDisponible: 50 },
        score: 100,
        cantidad: 40,
        descripcion: 'cemento',
        lineaOriginal: '40 cemento',
        indice: 2,
      },
      {
        ok: true,
        material: { ...CEMENTO, cantidadDisponible: 50 },
        score: 100,
        cantidad: 20,
        descripcion: 'cemento',
        lineaOriginal: '20 cemento',
        indice: 3,
      },
    ]);
    assert.ok(problemas.length >= 1);
    assert.equal(problemas[0]?.codigo, 'stock_insuficiente');
    assert.match(problemas[0]?.detalle ?? '', /50/);
  });
});

describe('idempotencia y comando /formato', () => {
  it('la clave es chat + message_id', () => {
    assert.equal(claveIdempotenciaFormatoFijo('900', 12), '900:12');
    assert.equal(shortIdDesdeMensajeTelegram('900', 12), shortIdDesdeMensajeTelegram('900', 12));
    assert.notEqual(shortIdDesdeMensajeTelegram('900', 12), shortIdDesdeMensajeTelegram('900', 13));
  });

  it('/formato y /formatofijo muestran la plantilla; /ingreso sigue siendo el menú', () => {
    const f = procesarComandoTelegram('/formato');
    assert.equal(f.handled, true);
    assert.equal(f.comandoFormato, true);
    assert.equal(procesarComandoTelegram('/formato@Bot').comandoFormato, true);
    assert.equal(procesarComandoTelegram('/ingreso').comandoMenuIngreso, true);
    assert.match(MENSAJE_FORMATO_FIJO_AYUDA, /INGRESO/);
    assert.match(MENSAJE_FORMATO_FIJO_AYUDA, /SALIDA/);
    assert.match(MENSAJE_FORMATO_FIJO_AYUDA, /INVENTARIO/);
  });
});
