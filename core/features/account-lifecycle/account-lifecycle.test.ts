import { existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAccountsStore } from '../accounts/accounts.ts'
import type { Account } from '../accounts/accounts.ts'
import { writeIncludeIf } from '../gitconfig/gitconfig.ts'
import { getProfilePath, writeAccountProfile } from '../identity/identity.ts'
import { createRulesStore } from '../rules/rules.ts'
import { removeLinkedAccount } from './account-lifecycle.ts'

// Mismo patrón que core/features/doctor/doctor.test.ts: dataDir y config
// global de prueba, Git real, nunca ~/.gitconfig ni ~/.dossier reales.

let dataDir: string
let globalConfigPath: string
let folder: string

const cuenta: Account = {
  id: 'cuenta-a-borrar',
  provider: 'github',
  host: 'github.com',
  label: 'A borrar',
  username: 'borrar-user',
  name: 'Usuario a Borrar',
  email: 'borrar@users.noreply.github.com',
}

beforeEach(async () => {
  const root = mkdtempSync(join(tmpdir(), 'sfp-account-lifecycle-'))
  dataDir = join(root, 'dossier-data')
  globalConfigPath = join(root, 'global.gitconfig')
  folder = join(root, 'carpeta')
  mkdirSync(folder, { recursive: true })
  await simpleGit(folder).init()
})

async function gitConfigGet(cwd: string, key: string): Promise<string | undefined> {
  const git = simpleGit({ baseDir: cwd, unsafe: { allowUnsafeConfigPaths: true } }).env(
    'GIT_CONFIG_GLOBAL',
    globalConfigPath,
  )
  try {
    const value = (await git.raw(['config', '--get', key])).trim()
    return value === '' ? undefined : value
  } catch {
    return undefined
  }
}

describe('removeLinkedAccount', () => {
  it('desfija las carpetas de la cuenta y saca su includeIf, borra el perfil, y borra la cuenta', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    await writeAccountProfile(dataDir, created)
    rulesStore.pin(folder, created.id)
    await writeIncludeIf(globalConfigPath, folder, getProfilePath(dataDir, created.id))

    // Confirma el estado "antes" con Git real: la carpeta resuelve la cuenta.
    expect(await gitConfigGet(folder, 'user.email')).toBe(cuenta.email)
    expect(existsSync(getProfilePath(dataDir, created.id))).toBe(true)

    removeLinkedAccount({ rulesStore, accountsStore, dataDir, globalConfigPath }, created.id)

    expect(rulesStore.list()).toEqual([])
    expect(accountsStore.list()).toEqual([])
    expect(existsSync(getProfilePath(dataDir, created.id))).toBe(false)
    // La carpeta ya no resuelve nada de esa cuenta (el includeIf se sacó).
    expect(await gitConfigGet(folder, 'user.email')).toBeUndefined()
  })

  it('una cuenta sin ninguna carpeta fijada se borra igual, sin lanzar', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    await writeAccountProfile(dataDir, created)

    removeLinkedAccount({ rulesStore, accountsStore, dataDir, globalConfigPath }, created.id)

    expect(accountsStore.list()).toEqual([])
    expect(existsSync(getProfilePath(dataDir, created.id))).toBe(false)
  })

  it('con dos carpetas fijadas a la misma cuenta, las desfija las dos', async () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    const created = accountsStore.create(cuenta)
    await writeAccountProfile(dataDir, created)
    const folder2 = join(folder, '..', 'carpeta-b')
    mkdirSync(folder2, { recursive: true })
    await simpleGit(folder2).init()

    rulesStore.pin(folder, created.id)
    rulesStore.pin(folder2, created.id)
    await writeIncludeIf(globalConfigPath, folder, getProfilePath(dataDir, created.id))
    await writeIncludeIf(globalConfigPath, folder2, getProfilePath(dataDir, created.id))

    removeLinkedAccount({ rulesStore, accountsStore, dataDir, globalConfigPath }, created.id)

    expect(rulesStore.list()).toEqual([])
    expect(await gitConfigGet(folder, 'user.email')).toBeUndefined()
    expect(await gitConfigGet(folder2, 'user.email')).toBeUndefined()
  })

  it('borrar un id inexistente no lanza (idempotente, igual que accountsStore.remove)', () => {
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const rulesStore = createRulesStore({ cwd: dataDir })
    expect(() =>
      removeLinkedAccount({ rulesStore, accountsStore, dataDir, globalConfigPath }, 'no-existe'),
    ).not.toThrow()
  })
})
