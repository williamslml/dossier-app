import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAccountsStore } from '../accounts/accounts.ts'
import type { Account, AccountsStore } from '../accounts/accounts.ts'
import { findOrphans } from './credential-maintenance.ts'

// S9 (requirements.md): huérfanas = GitHub (comparando contra `github list`
// real) + lo que accounts.json recuerda de una cuenta ya borrada (único
// camino para GitLab/otros hosts, sin listado propio en GCM).

let cwd: string
let store: AccountsStore

const githubAccount: Omit<Account, 'id'> = {
  provider: 'github',
  host: 'github.com',
  label: 'Trabajo',
  username: 'juan-dev',
  name: 'Juan Dev',
  email: 'juan@users.noreply.github.com',
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sfp-credential-maintenance-test-'))
  store = createAccountsStore({ cwd })
})

describe('findOrphans (S9.1, S9.2)', () => {
  it('un username que GCM conoce pero Dossier no, es huérfana (S9.1)', () => {
    store.create(githubAccount)
    const orphans = findOrphans(store, ['juan-dev', 'otro-usuario'])
    expect(orphans).toEqual([{ host: 'github.com', username: 'otro-usuario' }])
  })

  it('una cuenta borrada aparece como huérfana aunque GCM no pueda listarla (S9.2, GitLab)', () => {
    const created = store.create({ ...githubAccount, provider: 'gitlab', host: 'gitlab.com' })
    store.remove(created.id)
    expect(findOrphans(store, [])).toEqual([{ host: 'gitlab.com', username: 'juan-dev' }])
  })

  it('si la misma cuenta se volvió a vincular, ya no es huérfana (ni por S9.1 ni por S9.2)', () => {
    const created = store.create(githubAccount)
    store.remove(created.id)
    store.create(githubAccount) // se volvió a vincular, mismo host+username
    expect(findOrphans(store, ['juan-dev'])).toEqual([])
  })

  it('no duplica si aparece por los dos caminos a la vez', () => {
    const created = store.create(githubAccount)
    store.remove(created.id)
    // Mismo host+username recordado Y GCM todavía lo tiene (no se borró ahí).
    expect(findOrphans(store, ['juan-dev'])).toEqual([{ host: 'github.com', username: 'juan-dev' }])
  })
})
