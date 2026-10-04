/** Cámaras cuya cobertura (semáforo) está apagada. Las nuevas quedan visibles. */

export function pruneHiddenCameraIds(
  hiddenIds: readonly string[],
  cameraIds: readonly string[],
): string[] {
  const live = new Set(cameraIds)
  return hiddenIds.filter((id) => live.has(id))
}

export function toggleHiddenCameraId(
  hiddenIds: readonly string[],
  cameraId: string,
): string[] {
  return hiddenIds.includes(cameraId)
    ? hiddenIds.filter((id) => id !== cameraId)
    : [...hiddenIds, cameraId]
}

/** Apaga todas menos una: se ve solo esa zona. */
export function isolateHiddenCameraIds(
  cameraIds: readonly string[],
  keepId: string,
): string[] {
  return cameraIds.filter((id) => id !== keepId)
}

export function isCameraCoverageVisible(
  hiddenIds: readonly string[],
  cameraId: string,
): boolean {
  return !hiddenIds.includes(cameraId)
}
