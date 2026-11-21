import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSettingsStore } from './settings.ts'
import type { SettingsStore } from './settings.ts'

// S1 (requirements.md): settings.json vía `conf`, sin secretos. `cwd` apunta
// a un directorio temporal: nunca al `~/.dossier` real del usuario.

let cwd: string
let store: SettingsStore

const DEFAULTS = {
  theme: 'sistema',
  launchAtStartup: false,
  applySigningKeyOnSwitch: false,
} as const

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sfp-settings-test-'))
  store = createSettingsStore({ cwd })
})

describe('settings (S1)', () => {
  it('arranca con los valores por defecto (S1.1)', () => {
    expect(store.get()).toEqual(DEFAULTS)
  })

  it('actualiza un campo sin tocar el resto (S1.3)', () => {
    store.update({ theme: 'oscuro' })
    expect(store.get()).toEqual({ ...DEFAULTS, theme: 'oscuro' })
  })

  it('persiste de verdad en disco: una instancia nueva sobre el mismo cwd lo ve', () => {
    store.update({ theme: 'claro', launchAtStartup: true })
    const reread = createSettingsStore({ cwd })
    expect(reread.get()).toEqual({ ...DEFAULTS, theme: 'claro', launchAtStartup: true })
  })

  it('actualiza applySigningKeyOnSwitch sin tocar el resto (S6.1, 05-ajustes)', () => {
    store.update({ applySigningKeyOnSwitch: true })
    expect(store.get()).toEqual({ ...DEFAULTS, applySigningKeyOnSwitch: true })
  })
})
