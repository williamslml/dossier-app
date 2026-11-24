import { rmSync } from 'node:fs'
import type { AccountsStore } from '../accounts/accounts.ts'
import { removeIncludeIfBlock, updateRegion } from '../gitconfig/region.ts'
import { getProfilePath } from '../identity/identity.ts'
import type { RulesStore } from '../rules/rules.ts'

export interface RemoveAccountDeps {
  rulesStore: RulesStore
  accountsStore: AccountsStore
  dataDir: string
  globalConfigPath: string
}

/**
 * docs/product.md: desvincular una cuenta también desfija sus carpetas y
 * saca su `includeIf` — nunca deja una carpeta apuntando a un perfil que
 * ya no corresponde a nada. Nunca toca GCM ni el token real: desvincular y
 * revocar son dos decisiones distintas (ver "Credenciales huérfanas",
 * 05-ajustes, pensada justo para revocar aparte, a propósito).
 */
export function removeLinkedAccount(deps: RemoveAccountDeps, id: string): void {
  const { rulesStore, accountsStore, dataDir, globalConfigPath } = deps
  for (const rule of rulesStore.list().filter((r) => r.accountId === id)) {
    rulesStore.unpin(rule.path)
    updateRegion(globalConfigPath, (region) => removeIncludeIfBlock(region, `${rule.path}/`))
  }
  rmSync(getProfilePath(dataDir, id), { force: true })
  accountsStore.remove(id)
}
