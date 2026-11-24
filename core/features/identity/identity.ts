import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Account } from '../accounts/accounts.ts'
import { writeProfileConfig } from '../gitconfig/gitconfig.ts'

export function getProfilePath(dataDir: string, accountId: string): string {
  return join(dataDir, 'profiles', `${accountId}.gitconfig`)
}

export function getActiveConfigPath(dataDir: string): string {
  return join(dataDir, 'active.gitconfig')
}

/** docs/product.md: la clave de firma es parte del perfil de la cuenta
    (nunca un switch global) — cualquier carpeta fijada a esta cuenta firma
    sus commits sola, con el mismo mecanismo que ya resuelve identidad por
    carpeta. `gpg.format`/`user.signingkey` son la configuración real de
    Git para esto; `commit.gpgsign` los activa (si no, una clave asignada
    no firmaría nada por sí sola). */
function accountToProfileValues(account: Account): Record<string, string> {
  const values: Record<string, string> = {
    'user.name': account.name,
    'user.email': account.email,
    [`credential.${account.host}.username`]: account.username,
    [`credential.${account.host}.useHttpPath`]: 'false',
  }
  if (account.signingKey) {
    values['user.signingkey'] = account.signingKey.keyId
    values['gpg.format'] = account.signingKey.format
    values['commit.gpgsign'] = 'true'
  }
  return values
}

/** M4.2 */
export async function writeAccountProfile(dataDir: string, account: Account): Promise<void> {
  const profilePath = getProfilePath(dataDir, account.id)
  // `git config --file` no crea el directorio padre (`profiles/`) solo —
  // confirmado: falla con "No such file or directory" si no existe.
  mkdirSync(dirname(profilePath), { recursive: true })
  // Hallazgo real: `writeProfileConfig` solo hace `config --file ... set`,
  // nunca `unset` — si no se borra el archivo primero, una clave de firma
  // sacada después (o cualquier otro valor que ya no corresponda) queda
  // como basura del perfil anterior. Se regenera entero cada vez, nunca se
  // acumula sobre lo que ya había.
  rmSync(profilePath, { force: true })
  await writeProfileConfig(profilePath, accountToProfileValues(account))
}

