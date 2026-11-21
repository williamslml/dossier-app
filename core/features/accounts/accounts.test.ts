import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAccountsStore } from './accounts.ts'
import type { Account, AccountsStore } from './accounts.ts'

// M2 (requirements.md): accounts.json vía `conf`, sin secretos. `cwd`
// apunta a un directorio temporal: nunca al `~/.dossier` real del usuario.

let cwd: string
let store: AccountsStore

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sfp-accounts-test-'))
  store = createAccountsStore({ cwd })
})

const newAccount: Omit<Account, 'id'> = {
  provider: 'github',
  host: 'github.com',
  label: 'Personal',
  username: 'juan-dev',
  name: 'Juan Dev',
  email: 'juan@users.noreply.github.com',
}

describe('accounts (M2)', () => {
  it('crea y lista una cuenta, con id generado (M2.1-M2.2)', () => {
    const created = store.create(newAccount)
    expect(created.id).toBeTruthy()
    expect(store.list()).toEqual([created])
  })

  it('nunca incluye campos de secreto en el tipo (M2.2)', () => {
    const created = store.create(newAccount)
    expect('token' in created).toBe(false)
    expect('password' in created).toBe(false)
  })

  it('renombra la etiqueta sin tocar el resto (M2.3)', () => {
    const created = store.create(newAccount)
    const renamed = store.rename(created.id, 'Cliente')
    expect(renamed).toEqual({ ...created, label: 'Cliente' })
  })

  it('renombrar un id inexistente lanza (M2.3, decisión de diseño)', () => {
    expect(() => store.rename('no-existe', 'x')).toThrow()
  })

  it('elimina una cuenta; eliminar un id inexistente es idempotente (M2.4)', () => {
    const created = store.create(newAccount)
    store.remove(created.id)
    expect(store.list()).toEqual([])
    expect(() => store.remove(created.id)).not.toThrow()
  })

  it('persiste de verdad en disco: una instancia nueva sobre el mismo cwd lo ve (M2.5)', () => {
    const created = store.create(newAccount)
    const reread = createAccountsStore({ cwd })
    expect(reread.list()).toEqual([created])
  })

  it('asigna una clave de firma sin tocar el resto (S6.3, 05-ajustes)', () => {
    const created = store.create(newAccount)
    const updated = store.setSigningKey(created.id, {
      format: 'ssh',
      keyId: '~/.ssh/id_ed25519.pub',
    })
    expect(updated).toEqual({
      ...created,
      signingKey: { format: 'ssh', keyId: '~/.ssh/id_ed25519.pub' },
    })
  })

  it('asignar una clave de firma a un id inexistente lanza', () => {
    expect(() => store.setSigningKey('no-existe', { format: 'openpgp', keyId: 'ABC123' })).toThrow()
  })

  it('al eliminar una cuenta, recuerda su host+username (S9.2, 05-ajustes)', () => {
    const created = store.create(newAccount)
    store.remove(created.id)
    expect(store.listRemoved()).toEqual([{ host: 'github.com', username: 'juan-dev' }])
  })

  it('eliminar un id inexistente no agrega nada a lo recordado', () => {
    store.remove('no-existe')
    expect(store.listRemoved()).toEqual([])
  })

  it('lo recordado persiste en disco, igual que las cuentas', () => {
    const created = store.create(newAccount)
    store.remove(created.id)
    const reread = createAccountsStore({ cwd })
    expect(reread.listRemoved()).toEqual([{ host: 'github.com', username: 'juan-dev' }])
  })
})
