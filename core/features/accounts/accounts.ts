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
  /** S6.3 (05-ajustes): clave de firma de commits — nunca para transporte
      remoto, Dossier nunca genera ni importa una clave, solo referencia. */
  signingKey?: { format: 'openpgp' | 'ssh'; keyId: string }
}

/** S9.2 (05-ajustes): host+username de una cuenta ya borrada — lo único
    que permite detectar huérfanas para proveedores sin listado propio en
    GCM (todo salvo GitHub, ver docs/specs/.../06-motor-de-identidad). */
export interface RemovedAccountRef {
  host: string
  username: string
}

export interface AccountsStore {
  list(): Account[]
  create(data: Omit<Account, 'id'>): Account
  rename(id: string, label: string): Account
  setSigningKey(id: string, signingKey: NonNullable<Account['signingKey']>): Account
  remove(id: string): void
  listRemoved(): RemovedAccountRef[]
}

interface Schema {
  accounts: Account[]
  removed: RemovedAccountRef[]
}

export function createAccountsStore(options?: { cwd?: string }): AccountsStore {
  const conf = new Conf<Schema>({
    projectName: 'dossier',
    configName: 'accounts',
    defaults: { accounts: [], removed: [] },
    // exactOptionalPropertyTypes: `cwd` debe omitirse, no pasarse como
    // `undefined`, cuando no se pide un directorio aislado para tests.
    ...(options?.cwd ? { cwd: options.cwd } : {}),
  })

  function replace(id: string, update: (existing: Account) => Account): Account {
    const accounts = conf.get('accounts')
    const index = accounts.findIndex((a) => a.id === id)
    const existing = index === -1 ? undefined : accounts[index]
    if (!existing) {
      throw new Error(`No existe la cuenta ${id}`)
    }
    const updated = update(existing)
    const next = [...accounts]
    next[index] = updated
    conf.set('accounts', next)
    return updated
  }

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
      return replace(id, (existing) => ({ ...existing, label }))
    },

    setSigningKey(id: string, signingKey: NonNullable<Account['signingKey']>): Account {
      return replace(id, (existing) => ({ ...existing, signingKey }))
    },

    remove(id: string): void {
      // Idempotente a propósito (M2.4, design.md): eliminar un id que ya no
      // existe no es un error, es una carrera esperable desde la UI.
      const accounts = conf.get('accounts')
      const existing = accounts.find((a) => a.id === id)
      conf.set(
        'accounts',
        accounts.filter((a) => a.id !== id),
      )
      // S9.2: recordar host+username, nunca el resto de la cuenta (no hace
      // falta para encontrar huérfanas, y es menos dato guardado de más).
      if (existing) {
        conf.set('removed', [
          ...conf.get('removed'),
          { host: existing.host, username: existing.username },
        ])
      }
    },

    listRemoved(): RemovedAccountRef[] {
      return conf.get('removed')
    },
  }
}
