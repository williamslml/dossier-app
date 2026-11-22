import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Account } from '../accounts/accounts.ts'
import { createAccountsStore } from '../accounts/accounts.ts'
import { ensureActiveInclude, updateRegion } from '../gitconfig/region.ts'
import { getActiveConfigPath, writeAccountProfile } from '../identity/identity.ts'
import { createRulesStore } from '../rules/rules.ts'
import { runDoctor } from './doctor.ts'

// Igual que `core/features/identity/end-to-end.test.ts`: config global y
// dataDir de prueba, nunca ~/.gitconfig ni ~/.dossier reales. `env` fuerza
// GIT_CONFIG_GLOBAL al archivo de prueba, para que runDoctor lea de ahí.

let dataDir: string
let globalConfigPath: string
let env: Record<string, string>
let folderConRepo: string
let folderSinRepo: string

const cuenta: Account = {
  id: 'cuenta-doctor',
  provider: 'github',
  host: 'github.com',
  label: 'Doctor Test',
  username: 'doctor-user',
  name: 'Doctor User',
  email: 'doctor@users.noreply.github.com',
}

beforeEach(async () => {
  const root = mkdtempSync(join(tmpdir(), 'sfp-doctor-'))
  dataDir = join(root, 'dossier-data')
  globalConfigPath = join(root, 'global.gitconfig')
  env = { GIT_CONFIG_GLOBAL: globalConfigPath }
  folderConRepo = join(root, 'con-repo')
  folderSinRepo = join(root, 'sin-repo')
  mkdirSync(folderConRepo, { recursive: true })
  mkdirSync(folderSinRepo, { recursive: true })
  await simpleGit(folderConRepo).init()

  updateRegion(globalConfigPath, (region) =>
    ensureActiveInclude(region, getActiveConfigPath(dataDir)),
  )
})

describe('runDoctor', () => {
  it('una carpeta con repo cuya identidad resuelve bien da ok=true, hasRepo=true', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    await writeAccountProfile(dataDir, created)
    rulesStore.pin(folderConRepo, created.id)

    // pinFolder real (main/index.ts) también agrega el includeIf — acá se
    // reproduce ese paso con las mismas funciones de core.
    const { writeIncludeIf } = await import('../gitconfig/gitconfig.ts')
    const { getProfilePath } = await import('../identity/identity.ts')
    await writeIncludeIf(globalConfigPath, folderConRepo, getProfilePath(dataDir, created.id))

    const results = await runDoctor(rulesStore, accountsStore, dataDir, { env })
    expect(results).toEqual([
      {
        path: folderConRepo,
        accountId: created.id,
        accountLabel: 'Doctor Test',
        hasRepo: true,
        ok: true,
      },
    ])
  })

  it('una carpeta con repo cuya config local gana sobre includeIf da ok=false, con detalle (riesgo real de docs/product.md)', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    await writeAccountProfile(dataDir, created)
    rulesStore.pin(folderConRepo, created.id)
    const { writeIncludeIf } = await import('../gitconfig/gitconfig.ts')
    const { getProfilePath } = await import('../identity/identity.ts')
    await writeIncludeIf(globalConfigPath, folderConRepo, getProfilePath(dataDir, created.id))

    // Config local del repo (nunca tocada por Dossier) gana sobre includeIf.
    await simpleGit(folderConRepo).addConfig('user.email', 'otra@ejemplo.com')

    const results = await runDoctor(rulesStore, accountsStore, dataDir, { env })
    expect(results).toHaveLength(1)
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.hasRepo).toBe(true)
    expect(results[0]?.detail).toMatch(/otra@ejemplo\.com/)
    expect(results[0]?.detail).toMatch(/doctor@users\.noreply\.github\.com/)
  })

  it('un desajuste solo en credential.<host>.username (sin tocar user.email) se reporta sin mencionar el email como si también estuviera mal (hallazgo de revisión)', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    await writeAccountProfile(dataDir, created)
    rulesStore.pin(folderConRepo, created.id)
    const { writeIncludeIf } = await import('../gitconfig/gitconfig.ts')
    const { getProfilePath } = await import('../identity/identity.ts')
    await writeIncludeIf(globalConfigPath, folderConRepo, getProfilePath(dataDir, created.id))

    // user.email queda igual (resuelve bien); solo la config local pisa el
    // username de credencial — el único desajuste real es ese.
    await simpleGit(folderConRepo).addConfig(`credential.${cuenta.host}.username`, 'otro-usuario')

    const results = await runDoctor(rulesStore, accountsStore, dataDir, { env })
    expect(results).toHaveLength(1)
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.detail).toMatch(/otro-usuario/)
    expect(results[0]?.detail).not.toMatch(/user\.email/)
  })

  it('una carpeta sin repo todavía, con el perfil generado correcto, da ok=true, hasRepo=false', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    await writeAccountProfile(dataDir, created)
    rulesStore.pin(folderSinRepo, created.id)

    const results = await runDoctor(rulesStore, accountsStore, dataDir, { env })
    expect(results).toEqual([
      {
        path: folderSinRepo,
        accountId: created.id,
        accountLabel: 'Doctor Test',
        hasRepo: false,
        ok: true,
      },
    ])
  })

  it('una carpeta sin repo y sin el archivo de perfil da ok=false', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    // A propósito: nunca se llama a writeAccountProfile.
    rulesStore.pin(folderSinRepo, created.id)

    const results = await runDoctor(rulesStore, accountsStore, dataDir, { env })
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.detail).toMatch(/perfil.*no existe/)
  })

  it('una carpeta cuya cuenta ya fue borrada da ok=false, sin lanzar', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    rulesStore.pin(folderSinRepo, created.id)
    accountsStore.remove(created.id)

    const results = await runDoctor(rulesStore, accountsStore, dataDir, { env })
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.accountLabel).toBe('(cuenta borrada)')
  })

  it('una carpeta que ya no existe en el disco da ok=false, sin lanzar', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    await writeAccountProfile(dataDir, created)
    rulesStore.pin(folderSinRepo, created.id)
    rmSync(folderSinRepo, { recursive: true, force: true })

    const results = await runDoctor(rulesStore, accountsStore, dataDir, { env })
    expect(results[0]?.ok).toBe(false)
    expect(results[0]?.detail).toMatch(/ya no existe/)
  })

  it('sin ninguna carpeta fijada, da una lista vacía', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    expect(await runDoctor(rulesStore, accountsStore, dataDir, { env })).toEqual([])
  })
})
