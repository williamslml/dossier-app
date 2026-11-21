import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createStateStore } from './state.ts'
import type { StateStore } from './state.ts'

// S1 (requirements.md): activeId persistido, mismo patrón que accounts/rules.

let cwd: string
let store: StateStore

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sfp-state-test-'))
  store = createStateStore({ cwd })
})

describe('state (S1)', () => {
  it('sin activeId fijado, devuelve undefined (S1.1)', () => {
    expect(store.getActiveId()).toBeUndefined()
  })

  it('fija y lee el activeId (S1.1-S1.2)', () => {
    store.setActiveId('cuenta-1')
    expect(store.getActiveId()).toBe('cuenta-1')
  })

  it('persiste de verdad en disco (S1.3)', () => {
    store.setActiveId('cuenta-2')
    const reread = createStateStore({ cwd })
    expect(reread.getActiveId()).toBe('cuenta-2')
  })
})
