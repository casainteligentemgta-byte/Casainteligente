/**
 * Ejecutar: npx tsx --test lib/pheme/minutaAudioUpload.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MINUTA_AUDIO_BYTES } from './constants';
import {
  buildMinutaRapidaAudioPath,
  guessAudioMime,
  isMinutaRapidaAudioPath,
  validateMinutaAudio,
} from './minutaAudioUpload';

describe('minutaAudioUpload', () => {
  it('guessAudioMime reconoce mp3', () => {
    assert.equal(guessAudioMime('La Historia.mp3'), 'audio/mpeg');
  });

  it('validateMinutaAudio rechaza archivos enormes', () => {
    const msg = validateMinutaAudio(MAX_MINUTA_AUDIO_BYTES + 1, 'a.mp3', 'audio/mpeg');
    assert.ok(msg);
    assert.match(msg!, /límite/i);
  });

  it('validateMinutaAudio acepta mp3 típico de ~11 MB', () => {
    assert.equal(
      validateMinutaAudio(11 * 1024 * 1024, 'reunion.mp3', 'audio/mpeg'),
      null,
    );
  });

  it('buildMinutaRapidaAudioPath usa prefijo seguro', () => {
    const path = buildMinutaRapidaAudioPath('La Historia de Bolivar.mp3', 'audio/mpeg');
    assert.equal(isMinutaRapidaAudioPath(path), true);
    assert.ok(path.endsWith('.mp3'));
  });

  it('isMinutaRapidaAudioPath bloquea path traversal', () => {
    assert.equal(isMinutaRapidaAudioPath('minuta-rapida/../secret.mp3'), false);
    assert.equal(isMinutaRapidaAudioPath('otros/uuid/file.mp3'), false);
  });
});
