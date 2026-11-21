import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAccountsStore } from '../accounts/accounts.ts'
import type { Account } from '../accounts/accounts.ts'
import { createRulesStore } from '../rules/rules.ts'
import { normalizeGitdirPattern, renderIncludeIfBlock } from '../gitconfig/gitconfig.ts'
import { ensureActiveInclude, removeIncludeIfBlock, updateRegion } from '../gitconfig/region.ts'
import {
  getActiveConfigPath,
  getProfilePath,
  setActiveAccount,
  writeAccountProfile,
} from './identity.ts'

// Verificación en vivo de M1-M6 juntos (requirements.md) — exactamente lo
// que hacen selectAccount/pinFolder/unpinFolder en main/index.ts, pero
// llamando las funciones de core directo (todavía no hay UI conectada a
// estos IPC — fuera de alcance de este change, ver proposal.md). Config
// global y dataDir de prueba, nunca ~/.gitconfig ni ~/.dossier reales.

let dataDir: string
let globalConfigPath: string
let folderA: string
let folderB: string
let folderSinFijar: string

const cuentaActiva: Account = {
  id: 'activa',
  provider: 'github',
  host: 'github.com',
  label: 'Activa',
  username: 'usuario-activo',
  name: 'Usuario Activo',
  email: 'activo@users.noreply.github.com',
}

const cuentaFijada: Account = {
  id: 'fijada',
  provider: 'gitlab',
  host: 'gitlab.com',
  label: 'Fijada',
  username: 'usuario-fijado',
  name: 'Usuario Fijado',
  email: 'fijado@users.noreply.gitlab.com',
}

async function gitConfigGet(cwd: string, key: string): Promise<string | undefined> {
  const git = simpleGit({ baseDir: cwd, unsafe: { allowUnsafeConfigPaths: true } }).env(
    'GIT_CONFIG_GLOBAL',
    globalConfigPath,
  )
  try {
    const value = (await git.raw(['config', '--get', key])).trim()
    return value === '' ? undefined : value
  } catch (err) {
    if (err instanceof Error && !/exit code 1/.test(err.message)) throw err
    return undefined
  }
}

beforeEach(async () => {
  const root = mkdtempSync(join(tmpdir(), 'sfp-identity-e2e-'))
  dataDir = join(root, 'dossier-data')
  globalConfigPath = join(root, 'global.gitconfig')
  folderA = join(root, 'carpeta-a')
  folderB = join(root, 'carpeta-b')
  folderSinFijar = join(root, 'carpeta-sin-fijar')
  for (const dir of [folderA, folderB, folderSinFijar]) {
    mkdirSync(dir, { recursive: true })
    await simpleGit(dir).init()
  }
})

describe('motor de identidad, de punta a punta', () => {
  it('activar una cuenta cambia la identidad en una carpeta sin fijar (M4, M5)', async () => {
    updateRegion(globalConfigPath, (region) =>
      ensureActiveInclude(region, getActiveConfigPath(dataDir)),
    )
    await setActiveAccount(dataDir, cuentaActiva)

    expect(await gitConfigGet(folderSinFijar, 'user.email')).toBe(cuentaActiva.email)
  })

  it('una carpeta fijada usa su propia cuenta, sin importar cuál esté activa (M6)', async () => {
    updateRegion(globalConfigPath, (region) =>
      ensureActiveInclude(region, getActiveConfigPath(dataDir)),
    )
    await setActiveAccount(dataDir, cuentaActiva)

    await writeAccountProfile(dataDir, cuentaFijada)
    const block = await renderIncludeIfBlock(
      `${folderA}/`,
      getProfilePath(dataDir, cuentaFijada.id),
    )
    updateRegion(globalConfigPath, (region) => `${region}\n${block}`.trim())

    expect(await gitConfigGet(folderA, 'user.email')).toBe(cuentaFijada.email)
    expect(await gitConfigGet(folderSinFijar, 'user.email')).toBe(cuentaActiva.email)
  })

  it('desfijar una carpeta hace que vuelva a resolver la cuenta activa (M6.2)', async () => {
    updateRegion(globalConfigPath, (region) =>
      ensureActiveInclude(region, getActiveConfigPath(dataDir)),
    )
    await setActiveAccount(dataDir, cuentaActiva)
    await writeAccountProfile(dataDir, cuentaFijada)
    const block = await renderIncludeIfBlock(
      `${folderA}/`,
      getProfilePath(dataDir, cuentaFijada.id),
    )
    updateRegion(globalConfigPath, (region) => `${region}\n${block}`.trim())
    expect(await gitConfigGet(folderA, 'user.email')).toBe(cuentaFijada.email)

    updateRegion(globalConfigPath, (region) => removeIncludeIfBlock(region, `${folderA}/`))

    expect(await gitConfigGet(folderA, 'user.email')).toBe(cuentaActiva.email)
  })

  it('con las carpetas A y B fijadas a cuentas distintas, cada una resuelve la suya (rulesStore + FolderOverlapError real)', async () => {
    const rulesStore = createRulesStore({ cwd: dataDir })
    const accountsStore = createAccountsStore({ cwd: dataDir })
    const accountA = accountsStore.create({
      provider: cuentaFijada.provider,
      host: cuentaFijada.host,
      label: cuentaFijada.label,
      username: cuentaFijada.username,
      name: cuentaFijada.name,
      email: cuentaFijada.email,
    })
    const accountB = accountsStore.create({
      provider: cuentaActiva.provider,
      host: cuentaActiva.host,
      label: cuentaActiva.label,
      username: cuentaActiva.username,
      name: cuentaActiva.name,
      email: cuentaActiva.email,
    })

    await writeAccountProfile(dataDir, accountA)
    await writeAccountProfile(dataDir, accountB)
    rulesStore.pin(folderA, accountA.id)
    rulesStore.pin(folderB, accountB.id)

    const blockA = await renderIncludeIfBlock(`${folderA}/`, getProfilePath(dataDir, accountA.id))
    const blockB = await renderIncludeIfBlock(`${folderB}/`, getProfilePath(dataDir, accountB.id))
    updateRegion(globalConfigPath, (region) => `${region}\n${blockA}\n${blockB}`.trim())

    expect(await gitConfigGet(folderA, 'user.email')).toBe(accountA.email)
    expect(await gitConfigGet(folderB, 'user.email')).toBe(accountB.email)

    // Solapamiento real: fijar una subcarpeta de A a otra cuenta se rechaza.
    expect(() => rulesStore.pin(join(folderA, 'sub'), accountB.id)).toThrow()
    expect(normalizeGitdirPattern(`${folderA}/`)).not.toBe(normalizeGitdirPattern(`${folderB}/`))
  })
})
