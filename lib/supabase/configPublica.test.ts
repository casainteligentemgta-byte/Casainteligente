import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { supabasePublicoConfigurado } from './configPublica'

describe('supabasePublicoConfigurado', () => {
  it('rechaza vacío, placeholder y example.supabase.co', () => {
    assert.equal(supabasePublicoConfigurado('', 'key'), false)
    assert.equal(supabasePublicoConfigurado('https://abc.supabase.co', ''), false)
    assert.equal(supabasePublicoConfigurado('https://your-project-url.supabase.co', 'key'), false)
    assert.equal(supabasePublicoConfigurado('https://example.supabase.co', 'key'), false)
  })

  it('acepta un proyecto real', () => {
    assert.equal(supabasePublicoConfigurado('https://abc.supabase.co', 'sb_publishable_test'), true)
  })
})
