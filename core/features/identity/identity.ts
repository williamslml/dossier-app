import { mkdirSync, renameSync } from 'node:fs'
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

/** M4.3/M4.4: escritura atómica (archivo temporal + rename) — nunca deja
    `active.gitconfig` a medio escribir. */
export async function setActiveAccount(dataDir: string, account: Account): Promise<void> {
  // Igual que writeAccountProfile: nada garantiza que dataDir ya exista.
  mkdirSync(dataDir, { recursive: true })
  const activePath = getActiveConfigPath(dataDir)
  const tmpPath = `${activePath}.tmp`
  await writeProfileConfig(tmpPath, accountToProfileValues(account))
  renameSync(tmpPath, activePath)
}

/** S6.2 (05-ajustes): agrega la clave de firma al mismo active.gitconfig
    que setActiveAccount ya escribe — nunca pisa la identidad ya puesta
    (git config --file solo toca las claves que se le pasan). Nunca
    escribe commit.gpgsign ni credential.* — Dossier solo referencia la
    clave, nunca decide si firmar ni toca el transporte remoto. */
export async function writeSigningKey(
  dataDir: string,
  signingKey: NonNullable<Account['signingKey']>,
): Promise<void> {
  await writeProfileConfig(getActiveConfigPath(dataDir), {
    'user.signingkey': signingKey.keyId,
    'gpg.format': signingKey.format,
  })
}
