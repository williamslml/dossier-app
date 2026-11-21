import { randomUUID } from 'node:crypto'
import Conf from 'conf'

/**
 * Cuenta vinculada. **Sin secretos**: el token vive solo en GCM
 * (docs/adr/0004-modelo-de-credenciales-e-identidad.md); este tipo nunca
 * debe ganar un campo `token`/`password`.
 */
export interface Account {
  id: string
  provider: 'github' | 'gitlab'
  host: string
  label: string
  username: string
  name: string
  email: string
}

export interface AccountsStore {
  list(): Account[]
  create(data: Omit<Account, 'id'>): Account
  rename(id: string, label: string): Account
  remove(id: string): void
}

interface Schema {
  accounts: Account[]
}

export function createAccountsStore(options?: { cwd?: string }): AccountsStore {
  const conf = new Conf<Schema>({
    projectName: 'dossier',
    configName: 'accounts',
    defaults: { accounts: [] },
    // exactOptionalPropertyTypes: `cwd` debe omitirse, no pasarse como
    // `undefined`, cuando no se pide un directorio aislado para tests.
    ...(options?.cwd ? { cwd: options.cwd } : {}),
  })

  return {
    list(): Account[] {
      return conf.get('accounts')
    },

    create(data: Omit<Account, 'id'>): Account {
      const account: Account = { ...data, id: randomUUID() }
      conf.set('accounts', [...conf.get('accounts'), account])
      return account
    },

    rename(id: string, label: string): Account {
      const accounts = conf.get('accounts')
      const index = accounts.findIndex((a) => a.id === id)
      const existing = index === -1 ? undefined : accounts[index]
      if (!existing) {
        throw new Error(`No existe la cuenta ${id}`)
      }
      const renamed: Account = { ...existing, label }
      const next = [...accounts]
      next[index] = renamed
      conf.set('accounts', next)
      return renamed
    },

    remove(id: string): void {
      // Idempotente a propósito (M2.4, design.md): eliminar un id que ya no
      // existe no es un error, es una carrera esperable desde la UI.
      conf.set(
        'accounts',
        conf.get('accounts').filter((a) => a.id !== id),
      )
    },
  }
}
