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

  it('sin clave de firma asignada, no escribe nada de firma (docs/product.md)', async () => {
    await writeAccountProfile(dataDir, account)
    const profilePath = getProfilePath(dataDir, account.id)
    expect(await gitConfigGetFile(profilePath, 'user.signingkey')).toBeUndefined()
    expect(await gitConfigGetFile(profilePath, 'gpg.format')).toBeUndefined()
    expect(await gitConfigGetFile(profilePath, 'commit.gpgsign')).toBeUndefined()
  })

  it('con clave de firma asignada, escribe la config real de Git para firmar (docs/product.md: parte del perfil, nunca un switch global)', async () => {
    const conFirma: Account = {
      ...account,
      signingKey: { format: 'ssh', keyId: '~/.ssh/id_ed25519.pub' },
    }
    await writeAccountProfile(dataDir, conFirma)
    const profilePath = getProfilePath(dataDir, account.id)
    expect(await gitConfigGetFile(profilePath, 'user.signingkey')).toBe('~/.ssh/id_ed25519.pub')
    expect(await gitConfigGetFile(profilePath, 'gpg.format')).toBe('ssh')
    expect(await gitConfigGetFile(profilePath, 'commit.gpgsign')).toBe('true')
  })

  it('sacar la clave de firma después de haberla asignado borra esa config del perfil (hallazgo real: writeProfileConfig nunca hace unset)', async () => {
    const conFirma: Account = {
      ...account,
      signingKey: { format: 'openpgp', keyId: 'ABCDEF123456' },
    }
    await writeAccountProfile(dataDir, conFirma)
    await writeAccountProfile(dataDir, account) // misma cuenta, ya sin signingKey

    const profilePath = getProfilePath(dataDir, account.id)
    expect(await gitConfigGetFile(profilePath, 'user.signingkey')).toBeUndefined()
    expect(await gitConfigGetFile(profilePath, 'gpg.format')).toBeUndefined()
    expect(await gitConfigGetFile(profilePath, 'commit.gpgsign')).toBeUndefined()
    // El resto del perfil sigue intacto.
    expect(await gitConfigGetFile(profilePath, 'user.email')).toBe('juan@users.noreply.github.com')
  })
})

