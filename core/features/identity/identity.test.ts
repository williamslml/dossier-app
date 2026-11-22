import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it } from 'vitest'
import { getActiveConfigPath, getProfilePath, writeAccountProfile } from './identity.ts'
import type { Account } from '../accounts/accounts.ts'

// M4 (requirements.md): perfil por cuenta + cuenta activa, sobre un
// dataDir de prueba aislado — nunca ~/.dossier real.

let dataDir: string

const account: Account = {
  id: 'cuenta-1',
  provider: 'github',
  host: 'github.com',
  label: 'Trabajo',
  username: 'juan-dev',
  name: 'Juan Dev',
  email: 'juan@users.noreply.github.com',
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'sfp-identity-core-test-'))
})

async function gitConfigGetFile(filePath: string, key: string): Promise<string | undefined> {
  const git = simpleGit({ unsafe: { allowUnsafeConfigPaths: true } })
  try {
    // simple-git resuelve `config --get` de una clave inexistente como
    // éxito con cadena vacía, no como rechazo (docs/lessons/README.md) —
    // '' == "no configurado", igual que gitconfig.test.ts ya lo trata.
    const value = (await git.raw(['config', '--file', filePath, '--get', key])).trim()
    return value === '' ? undefined : value
  } catch {
    return undefined
  }
}

describe('rutas (M4.1)', () => {
  it('getProfilePath arma profiles/<id>.gitconfig dentro del dataDir', () => {
    expect(getProfilePath(dataDir, 'cuenta-1')).toBe(
      join(dataDir, 'profiles', 'cuenta-1.gitconfig'),
    )
  })

  it('getActiveConfigPath arma active.gitconfig dentro del dataDir', () => {
    expect(getActiveConfigPath(dataDir)).toBe(join(dataDir, 'active.gitconfig'))
  })
})

describe('writeAccountProfile (M4.2)', () => {
  it('escribe identidad y cuenta de credencial de la cuenta', async () => {
    await writeAccountProfile(dataDir, account)
    const profilePath = getProfilePath(dataDir, account.id)
    expect(await gitConfigGetFile(profilePath, 'user.name')).toBe('Juan Dev')
    expect(await gitConfigGetFile(profilePath, 'user.email')).toBe('juan@users.noreply.github.com')
    expect(await gitConfigGetFile(profilePath, 'credential.github.com.username')).toBe('juan-dev')
    expect(await gitConfigGetFile(profilePath, 'credential.github.com.useHttpPath')).toBe('false')
  })
})

