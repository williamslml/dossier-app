import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createRulesStore, FolderOverlapError } from './rules.ts'
import type { RulesStore } from './rules.ts'

// M3 (requirements.md): una carpeta solo puede pertenecer a una cuenta
// (docs/adr/0004-modelo-de-credenciales-e-identidad.md) — "no hay competencia por prefijo".

let cwd: string
let store: RulesStore

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sfp-rules-test-'))
  store = createRulesStore({ cwd })
})

describe('rules (M3)', () => {
  it('fija una carpeta a una cuenta (M3.1)', () => {
    const rule = store.pin('C:/work/a', 'acc-1')
    expect(rule.accountId).toBe('acc-1')
    expect(store.list()).toEqual([rule])
  })

  it('re-fijar el mismo path reemplaza, no es conflicto (M3.2)', () => {
    store.pin('C:/work/a', 'acc-1')
    const replaced = store.pin('C:/work/a', 'acc-2')
    expect(store.list()).toEqual([replaced])
    expect(replaced.accountId).toBe('acc-2')
  })

  it('fijar una carpeta dentro de otra ya fijada se rechaza (M3.3)', () => {
    store.pin('C:/work/a', 'acc-1')
    expect(() => store.pin('C:/work/a/sub', 'acc-2')).toThrow(FolderOverlapError)
  })

  it('fijar una carpeta que ya contiene una fijada también se rechaza (M3.3, otro sentido)', () => {
    store.pin('C:/work/a/sub', 'acc-1')
    expect(() => store.pin('C:/work/a', 'acc-2')).toThrow(FolderOverlapError)
  })

  it('carpetas sin relación de contención se aceptan ambas (M3.3, control negativo)', () => {
    store.pin('C:/work/a', 'acc-1')
    const ruleB = store.pin('C:/work/b', 'acc-2')
    expect(store.list()).toHaveLength(2)
    expect(ruleB.accountId).toBe('acc-2')
  })

  it('desfija una carpeta (M3.4)', () => {
    store.pin('C:/work/a', 'acc-1')
    store.unpin('C:/work/a')
    expect(store.list()).toEqual([])
  })

  it('desfijar una carpeta no fijada es idempotente', () => {
    expect(() => store.unpin('C:/work/nunca-fijada')).not.toThrow()
  })

  it('persiste de verdad en disco (M3.5)', () => {
    const rule = store.pin('C:/work/a', 'acc-1')
    const reread = createRulesStore({ cwd })
    expect(reread.list()).toEqual([rule])
  })

  it('una regla nueva empieza sin guardia de identidad activada (S11.1)', () => {
    const rule = store.pin('C:/work/a', 'acc-1')
    expect(rule.enforced).toBe(false)
  })

  it('activa la guardia de identidad de una regla existente (S11.1)', () => {
    store.pin('C:/work/a', 'acc-1')
    const updated = store.setEnforced('C:/work/a', true)
    expect(updated.enforced).toBe(true)
    expect(store.list()).toEqual([updated])
  })

  it('desactivarla de nuevo vuelve a dejarla en false (S11.1)', () => {
    store.pin('C:/work/a', 'acc-1')
    store.setEnforced('C:/work/a', true)
    const updated = store.setEnforced('C:/work/a', false)
    expect(updated.enforced).toBe(false)
  })

  it('setEnforced sobre una carpeta no fijada es un error (no hay regla que activar)', () => {
    expect(() => store.setEnforced('C:/work/nunca-fijada', true)).toThrow()
  })

  it('re-fijar una carpeta ya enforced no le resetea el campo (M3.2 + S11.1)', () => {
    store.pin('C:/work/a', 'acc-1')
    store.setEnforced('C:/work/a', true)
    const replaced = store.pin('C:/work/a', 'acc-2')
    expect(replaced.enforced).toBe(true)
  })
})
