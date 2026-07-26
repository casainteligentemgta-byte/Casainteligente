/**
 * Ejecutar: npx tsx --test lib/pheme/parseProcesarAudioError.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseProcesarAudioError } from './parseProcesarAudioError';

describe('parseProcesarAudioError', () => {
  it('prioriza detail JSON', () => {
    assert.equal(
      parseProcesarAudioError('', 500, { detail: 'GEMINI_API_KEY no configurada.' }),
      'GEMINI_API_KEY no configurada.',
    );
  });

  it('explica HTTP 413 sin JSON', () => {
    const msg = parseProcesarAudioError('<html>413</html>', 413);
    assert.match(msg, /413|límite|Storage/i);
  });

  it('explica payload too large en cuerpo', () => {
    const msg = parseProcesarAudioError('FUNCTION_PAYLOAD_TOO_LARGE', 500);
    assert.match(msg, /Storage|demasiado grande/i);
  });

  it('explica timeout 504', () => {
    assert.match(parseProcesarAudioError('', 504), /tiempo|corto/i);
  });

  it('fallback genérico con status', () => {
    assert.match(parseProcesarAudioError('', 500), /HTTP 500/);
  });
});
