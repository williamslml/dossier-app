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
})
