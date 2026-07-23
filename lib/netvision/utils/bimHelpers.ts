/** Helpers BIM (Fase 7). */
export function bimPhaseForElementType(
  type: 'camera' | 'switch' | 'cable' | 'conduit' | 'label',
): 'design' | 'cabling' | 'equipment' | 'documentation' {
  if (type === 'cable' || type === 'conduit') return 'cabling'
  if (type === 'camera' || type === 'switch') return 'equipment'
  if (type === 'label') return 'documentation'
  return 'design'
}
