import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import type { Account, AccountsStore } from '../accounts/accounts.ts'
import { getProfilePath } from '../identity/identity.ts'
import type { Rule, RulesStore } from '../rules/rules.ts'

export interface DoctorCheck {
  path: string
  accountId: string
  accountLabel: string
  /** `false` = la carpeta todavía no tiene `.git` (ni siquiera clonada
      todavía) — en ese caso solo se puede validar el archivo generado, no
      lo que Git resolvería de verdad (docs/product.md, M-Doctor). */
  hasRepo: boolean
  ok: boolean
  /** Detalle legible de qué está mal — ausente cuando `ok` es `true`. */
  detail?: string
}

/** Solo para tests: fuerza `GIT_CONFIG_GLOBAL` a un archivo aislado en vez
    del real del usuario. En producción se omite — Doctor quiere leer la
    config real, igual que la vería un `git commit` de verdad. */
export interface RunDoctorOptions {
  env?: Record<string, string>
}

async function readConfigValue(
  args: string[],
  env: Record<string, string> | undefined,
): Promise<string | undefined> {
  let git = simpleGit({ unsafe: { allowUnsafeConfigPaths: true } })
  if (env) git = git.env(env)
  try {
    const value = (await git.raw(args)).trim()
    return value === '' ? undefined : value
  } catch (err) {
    // Código de salida 1 = la clave no existe — no es un error real acá.
    if (err instanceof Error && !/exit code 1/.test(err.message)) throw err
    return undefined
  }
}

async function checkRule(
  rule: Rule,
  account: Account | undefined,
  dataDir: string,
  env: Record<string, string> | undefined,
): Promise<DoctorCheck> {
  const base = {
    path: rule.path,
    accountId: rule.accountId,
    accountLabel: account?.label ?? '(cuenta borrada)',
  }

  if (!account) {
    return {
      ...base,
      hasRepo: false,
      ok: false,
      detail: 'La cuenta fijada a esta carpeta ya no existe.',
    }
  }
  if (!existsSync(rule.path)) {
    return { ...base, hasRepo: false, ok: false, detail: 'La carpeta ya no existe en el disco.' }
  }

  const hasRepo = existsSync(join(rule.path, '.git'))

  if (hasRepo) {
    const actualEmail = await readConfigValue(['-C', rule.path, 'config', '--get', 'user.email'], env)
    const actualUsername = await readConfigValue(
      ['-C', rule.path, 'config', '--get', `credential.${account.host}.username`],
      env,
    )
    const ok = actualEmail === account.email && actualUsername === account.username
    return {
      ...base,
      hasRepo: true,
      ok,
      ...(ok
        ? {}
        : {
            detail: `Git resuelve user.email="${actualEmail ?? '(sin configurar)'}" acá; esta carpeta está fijada a "${account.email}".`,
          }),
    }
  }

  const profilePath = getProfilePath(dataDir, account.id)
  if (!existsSync(profilePath)) {
    return {
      ...base,
      hasRepo: false,
      ok: false,
      detail: 'El archivo de perfil de esta cuenta no existe todavía.',
    }
  }
  const profileEmail = await readConfigValue(['config', '--file', profilePath, '--get', 'user.email'], env)
  const ok = profileEmail === account.email
  return {
    ...base,
    hasRepo: false,
    ok,
    ...(ok
      ? {}
      : {
          detail: `El perfil guardado tiene user.email="${profileEmail ?? '(sin configurar)'}"; se esperaba "${account.email}". Todavía no es un repo, así que Git no puede confirmarlo por sí solo.`,
        }),
  }
}

/** M-Doctor (docs/product.md §2): un chequeo por carpeta fijada, no
    reactivo (a diferencia de la guardia de identidad, `identity-guard`,
    que solo actúa al commitear). Nunca escribe nada. */
export function runDoctor(
  rulesStore: RulesStore,
  accountsStore: AccountsStore,
  dataDir: string,
  options: RunDoctorOptions = {},
): Promise<DoctorCheck[]> {
  const accountsById = new Map(accountsStore.list().map((a) => [a.id, a]))
  const rules = rulesStore.list()
  return Promise.all(rules.map((rule) => checkRule(rule, accountsById.get(rule.accountId), dataDir, options.env)))
}
