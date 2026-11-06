import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { X509Certificate } from 'node:crypto';
import {
  estadoTasaParaFechaSolicitada,
  fechaAlmacenamientoTasaBcv,
  parseBcvHomepageHtml,
  parseFechaEspanolBcv,
  parseFechaValorBcv,
  parseNumeroTasaVe,
  parseUsdDesdeBloqueDolar,
} from './bcvOficial';
import { createBcvHttpsAgent } from './bcvOficialFetch';
import {
  SECTIGO_PUBLIC_SERVER_AUTHENTICATION_CA_DV_R36_PEM,
  SECTIGO_PUBLIC_SERVER_AUTHENTICATION_ROOT_R46_PEM,
} from './certs/sectigoBcvOrgVeCa';

const dir = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(dir, 'fixtures', name), 'utf8');

describe('parser de la portada BCV', () => {
  it('lee USD del #dolar y Fecha Valor (caso factura 066726: 896,1225 del 6 nov)', () => {
    const html = fixture('bcv-homepage-usd.html');
    const parsed = parseBcvHomepageHtml(html);
    assert.ok(parsed);
    assert.equal(parsed.usd, 896.1225);
    assert.equal(parsed.fechaValor, '2026-11-06');
    assert.equal(parsed.fuente, 'bcv.org.ve');
    assert.notEqual(parseUsdDesdeBloqueDolar(html), 248.11);
    assert.notEqual(parseUsdDesdeBloqueDolar(html), 10.95601059);
  });

  it('no toma el euro ni el rublo que están en bloques vecinos', () => {
    const html = fixture('bcv-homepage-usd.html');
    assert.equal(parseUsdDesdeBloqueDolar(html), 896.1225);
  });

  it('lee una Fecha Valor anterior (891,1054 del 4 nov) sin fingir que es de hoy', () => {
    const html = fixture('bcv-homepage-fecha-pasada.html');
    const parsed = parseBcvHomepageHtml(html);
    assert.ok(parsed);
    assert.equal(parsed.usd, 891.1054);
    assert.equal(parsed.fechaValor, '2026-11-04');
    assert.equal(
      fechaAlmacenamientoTasaBcv({ fechaValor: parsed.fechaValor, hoy: '2026-11-06' }),
      '2026-11-04',
    );
  });

  it('acepta Fecha Valor solo en texto español (sin atributo content)', () => {
    const html = fixture('bcv-homepage-solo-texto-fecha.html');
    const parsed = parseBcvHomepageHtml(html);
    assert.ok(parsed);
    assert.equal(parsed.usd, 36.6873);
    assert.equal(parsed.fechaValor, '2026-11-09');
    assert.equal(parseFechaValorBcv(html), '2026-11-09');
  });

  it('devuelve null si no hay bloque #dolar', () => {
    assert.equal(parseBcvHomepageHtml('<html><body>sin tasas</body></html>'), null);
  });
});

describe('números y fechas BCV', () => {
  it('interpreta coma decimal venezolana', () => {
    assert.equal(parseNumeroTasaVe('896,12250000'), 896.1225);
    assert.equal(parseNumeroTasaVe('891,10540000'), 891.1054);
    assert.equal(parseNumeroTasaVe('36.50'), 36.5);
  });

  it('parsea «06 Noviembre 2026»', () => {
    assert.equal(parseFechaEspanolBcv('Viernes, 06 Noviembre  2026'), '2026-11-06');
    assert.equal(parseFechaEspanolBcv('Lunes, 09 de Noviembre 2026'), '2026-11-09');
  });
});

describe('fecha efectiva / no presentar una tasa vieja como de hoy', () => {
  it('almacena por Fecha Valor, no por el día del scrape', () => {
    assert.equal(
      fechaAlmacenamientoTasaBcv({ fechaValor: '2026-11-04', hoy: '2026-11-06' }),
      '2026-11-04',
    );
    assert.equal(
      fechaAlmacenamientoTasaBcv({ fechaValor: '2026-11-06', hoy: '2026-11-06' }),
      '2026-11-06',
    );
    assert.equal(
      fechaAlmacenamientoTasaBcv({ fechaValor: '2026-11-09', hoy: '2026-11-06' }),
      '2026-11-09',
    );
    assert.equal(fechaAlmacenamientoTasaBcv({ fechaValor: null, hoy: '2026-11-06' }), '2026-11-06');
  });

  it('marca desactualizada si la tasa no es de la fecha pedida', () => {
    assert.equal(estadoTasaParaFechaSolicitada('2026-11-06', '2026-11-06'), 'actualizada');
    assert.equal(estadoTasaParaFechaSolicitada('2026-11-06', '2026-11-04'), 'desactualizada');
    assert.equal(estadoTasaParaFechaSolicitada('2026-11-06', null), 'desactualizada');
  });
});

describe('TLS solo para BCV', () => {
  it('el Agent verifica el certificado (nunca rejectUnauthorized=false)', () => {
    const agent = createBcvHttpsAgent();
    assert.notEqual(agent.options.rejectUnauthorized, false);
    const ca = agent.options.ca;
    const blob = Array.isArray(ca) ? ca.join('\n') : String(ca ?? '');
    assert.match(blob, /BEGIN CERTIFICATE/);
  });

  it('los PEM empaquetados son el intermedio R36 y la raíz R46 de Sectigo', () => {
    const inter = new X509Certificate(SECTIGO_PUBLIC_SERVER_AUTHENTICATION_CA_DV_R36_PEM);
    const root = new X509Certificate(SECTIGO_PUBLIC_SERVER_AUTHENTICATION_ROOT_R46_PEM);
    assert.match(inter.subject, /Sectigo Public Server Authentication CA DV R36/);
    assert.match(root.subject, /Sectigo Public Server Authentication Root R46/);
    assert.equal(inter.issuer, root.subject);
  });
});
