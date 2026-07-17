import conduits from '@/data/netvision/conduits.json'

/** Stub Fase 4 — selector de cajetín por nº de Cat6. */
export function recommendConduitBox(cat6Count: number) {
  return (
    conduits.boxes.find((b) => b.maxCat6 >= cat6Count) ??
    conduits.boxes[conduits.boxes.length - 1]
  )
}
