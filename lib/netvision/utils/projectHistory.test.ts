import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { emptyProject } from '@/lib/netvision/storage'
import {
  NETVISION_HISTORY_MAX,
  popProjectHistory,
  pushProjectHistory,
} from './projectHistory'

describe('projectHistory', () => {
  it('apila y restaura el último diseño', () => {
    const a = emptyProject({ id: 'a', name: 'uno' })
    const b = { ...a, name: 'dos' }
    let stack = pushProjectHistory([], a)
    stack = pushProjectHistory(stack, b)
    const first = popProjectHistory(stack)
    assert.equal(first.restored?.name, 'dos')
    const second = popProjectHistory(first.rest)
    assert.equal(second.restored?.name, 'uno')
    assert.equal(second.rest.length, 0)
  })

  it('no pasa del tope', () => {
    let stack: ReturnType<typeof emptyProject>[] = []
    for (let i = 0; i < NETVISION_HISTORY_MAX + 5; i++) {
      stack = pushProjectHistory(stack, emptyProject({ id: `p${i}`, name: `n${i}` }))
    }
    assert.equal(stack.length, NETVISION_HISTORY_MAX)
    assert.equal(stack[0]?.name, 'n5')
  })

  it('pop vacío no rompe', () => {
    const { rest, restored } = popProjectHistory([])
    assert.equal(restored, null)
    assert.equal(rest.length, 0)
  })
})
