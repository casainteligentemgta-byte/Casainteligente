import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isolateHiddenCameraIds,
  isCameraCoverageVisible,
  pruneHiddenCameraIds,
  toggleHiddenCameraId,
} from './cameraVisionVisibility'

describe('cameraVisionVisibility', () => {
  it('Todas = ninguna oculta; Solo = oculta el resto', () => {
    const ids = ['a', 'b', 'c']
    assert.deepEqual(isolateHiddenCameraIds(ids, 'b'), ['a', 'c'])
    assert.equal(isCameraCoverageVisible([], 'a'), true)
    assert.equal(isCameraCoverageVisible(['a'], 'a'), false)
  })

  it('apagar / encender una no toca las demás', () => {
    assert.deepEqual(toggleHiddenCameraId([], 'a'), ['a'])
    assert.deepEqual(toggleHiddenCameraId(['a', 'b'], 'a'), ['b'])
  })

  it('quita ids de cámaras que ya no existen', () => {
    assert.deepEqual(pruneHiddenCameraIds(['a', 'gone'], ['a', 'b']), ['a'])
  })
})
