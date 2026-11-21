import type { AccountsStore } from '../accounts/accounts.ts'

export interface OrphanedCredential {
  host: string
  username: string
}

function key(ref: OrphanedCredential): string {
  return `${ref.host}:${ref.username}`
}

/**
 * S9: huérfanas = cuentas de GitHub que GCM conoce (`listGithubAccounts`,
 * `core/features/git-credential`) pero `accounts.json` no, más lo que
 * `accounts.json` recuerda de cuentas ya borradas (único camino para
 * GitLab/otros hosts, sin listado propio en GCM — ver design.md). Si la
 * misma cuenta se volvió a vincular, ya no cuenta como huérfana.
 */
export function findOrphans(
  accountsStore: AccountsStore,
  githubAccounts: string[],
): OrphanedCredential[] {
  const known = new Set(accountsStore.list().map((a) => `${a.host}:${a.username}`))

  const githubOrphans: OrphanedCredential[] = githubAccounts
    .filter((username) => !known.has(`github.com:${username}`))
    .map((username) => ({ host: 'github.com', username }))

  const rememberedOrphans = accountsStore.listRemoved().filter((ref) => !known.has(key(ref)))

  const seen = new Set<string>()
  const result: OrphanedCredential[] = []
  for (const ref of [...githubOrphans, ...rememberedOrphans]) {
    const k = key(ref)
    if (seen.has(k)) continue
    seen.add(k)
    result.push(ref)
  }
  return result
}
