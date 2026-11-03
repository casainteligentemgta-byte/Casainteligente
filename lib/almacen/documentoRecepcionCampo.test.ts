import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  claveIdempotenciaRecepcionCampo,
  esNumeroDocumentoPlaceholder,
  esUuid,
  numeroDocumentoContabilidad,
  puedeReutilizarCompraContable,
} from './documentoRecepcionCampo';

describe('documento de recepción / nota de entrega', () => {
  it('detecta placeholders que no deben fusionar compras', () => {
    for (const n of ['', '  ', 'S/N', 's/n', 'SN', 'NE-S/N', 'NE-SN', 'NOTA-ENTREGA', 'NE-NOTA-ENTREGA']) {
      assert.equal(esNumeroDocumentoPlaceholder(n), true, n);
    }
    assert.equal(esNumeroDocumentoPlaceholder('NE-00421'), false);
    assert.equal(esNumeroDocumentoPlaceholder('F-8891'), false);
  });

  it('antepone NE- salvo que ya venga', () => {
    assert.equal(numeroDocumentoContabilidad('nota_entrega', '00421'), 'NE-00421');
    assert.equal(numeroDocumentoContabilidad('nota_entrega', 'NE-00421'), 'NE-00421');
    assert.equal(numeroDocumentoContabilidad('emergencia', 'x'), 'EMG-x');
    assert.equal(numeroDocumentoContabilidad('factura_canal', 'F-1'), 'F-1');
  });

  it('no busca compra si el doc es placeholder y no ignora proyecto en NE', () => {
    assert.deepEqual(
      puedeReutilizarCompraContable({ tipoRecepcion: 'nota_entrega', invoiceNumber: 'NE-S/N' }),
      { buscar: false, ignorarProyecto: false },
    );
    assert.deepEqual(
      puedeReutilizarCompraContable({ tipoRecepcion: 'nota_entrega', invoiceNumber: 'NE-00421' }),
      { buscar: true, ignorarProyecto: false },
    );
    assert.deepEqual(
      puedeReutilizarCompraContable({ tipoRecepcion: 'factura_canal', invoiceNumber: 'F-1' }),
      { buscar: true, ignorarProyecto: true },
    );
  });

  it('reutiliza token UUID como clave de idempotencia y no pisa una recepción ya registrada', () => {
    const token = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const a = claveIdempotenciaRecepcionCampo({ recepcion_campo_token: token });
    assert.equal(a.key, token);
    assert.equal(a.generated, false);
    assert.equal(a.alreadyRegisteredId, null);

    const b = claveIdempotenciaRecepcionCampo({
      recepcion_campo_registrada_id: token,
      recepcion_campo_token: '11111111-2222-4333-8444-555555555555',
    });
    assert.equal(b.alreadyRegisteredId, token);
    assert.equal(b.key, token);

    const c = claveIdempotenciaRecepcionCampo({});
    assert.equal(esUuid(c.key), true);
    assert.equal(c.generated, true);
  });
});
