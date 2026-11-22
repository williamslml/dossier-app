import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Account } from '../accounts/accounts.ts'
import { writeProfileConfig } from '../gitconfig/gitconfig.ts'

export function getProfilePath(dataDir: string, accountId: string): string {
  return join(dataDir, 'profiles', `${accountId}.gitconfig`)
}

export function getActiveConfigPath(dataDir: string): string {
  return join(dataDir, 'active.gitconfig')
}

function accountToProfileValues(account: Account): Record<string, string> {
  return {
    'user.name': account.name,
    'user.email': account.email,
    [`credential.${account.host}.username`]: account.username,
    [`credential.${account.host}.useHttpPath`]: 'false',
  }
}

/** M4.2 */
export async function writeAccountProfile(dataDir: string, account: Account): Promise<void> {
  const profilePath = getProfilePath(dataDir, account.id)
  // `git config --file` no crea el directorio padre (`profiles/`) solo —
  // confirmado: falla con "No such file or directory" si no existe.
  mkdirSync(dirname(profilePath), { recursive: true })
  await writeProfileConfig(profilePath, accountToProfileValues(account))
}

