import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getActiveConfigPath,
  getProfilePath,
  setActiveAccount,
  writeAccountProfile,
  writeSigningKey,
} from './identity.ts'
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

describe('setActiveAccount (M4.3, M4.4)', () => {
  it('escribe el mismo bloque en active.gitconfig', async () => {
    await setActiveAccount(dataDir, account)
    const activePath = getActiveConfigPath(dataDir)
    expect(await gitConfigGetFile(activePath, 'user.email')).toBe('juan@users.noreply.github.com')
  })

  it('nunca deja un archivo .tmp residual después de terminar', async () => {
    await setActiveAccount(dataDir, account)
    expect(existsSync(`${getActiveConfigPath(dataDir)}.tmp`)).toBe(false)
  })

  it('reemplaza el contenido anterior al activar otra cuenta', async () => {
    await setActiveAccount(dataDir, account)
    const otraCuenta: Account = {
      ...account,
      id: 'cuenta-2',
      email: 'otra@users.noreply.github.com',
    }
    await setActiveAccount(dataDir, otraCuenta)
    const activePath = getActiveConfigPath(dataDir)
    expect(await gitConfigGetFile(activePath, 'user.email')).toBe('otra@users.noreply.github.com')
  })
})

describe('writeSigningKey (S6.2, 05-ajustes)', () => {
  it('agrega la clave de firma sin tocar la identidad ya escrita por setActiveAccount', async () => {
    await setActiveAccount(dataDir, account)
    await writeSigningKey(dataDir, { format: 'ssh', keyId: '~/.ssh/id_ed25519.pub' })

    const activePath = getActiveConfigPath(dataDir)
    expect(await gitConfigGetFile(activePath, 'user.signingkey')).toBe('~/.ssh/id_ed25519.pub')
    expect(await gitConfigGetFile(activePath, 'gpg.format')).toBe('ssh')
    // La identidad que ya estaba no se pisa (S6.2: agrega, no reescribe el perfil entero).
    expect(await gitConfigGetFile(activePath, 'user.email')).toBe('juan@users.noreply.github.com')
  })

  it('nunca agrega commit.gpgsign ni toca credential.* (S6.4: solo referencia la clave, nunca transporte)', async () => {
    await setActiveAccount(dataDir, account)
    await writeSigningKey(dataDir, { format: 'openpgp', keyId: 'ABC123' })

    const activePath = getActiveConfigPath(dataDir)
    expect(await gitConfigGetFile(activePath, 'commit.gpgsign')).toBeUndefined()
    expect(await gitConfigGetFile(activePath, 'credential.github.com.username')).toBe('juan-dev')
  })
})
