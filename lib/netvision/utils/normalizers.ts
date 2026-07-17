import countries from '@/data/netvision/countries.json'

export function profilesForCountry(countryCode: string): string[] {
  const entry = (countries as Record<string, { profiles: string[] }>)[countryCode]
  return entry?.profiles ?? ['IEC', 'TIA_EIA_568']
}
