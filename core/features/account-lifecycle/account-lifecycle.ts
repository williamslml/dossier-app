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
  // Hallazgo de revisión: si se saca primero el includeIf y recién después
  // se desfija, un reintento tras una falla a mitad de camino (el config
  // global bloqueado, por ejemplo) todavía encuentra la regla en
  // rulesStore y puede terminar de limpiar el includeIf. Al revés (como
  // estaba, mismo orden que ya usa unpinFolder en main/index.ts), un
  // reintento ya no ve la regla borrada y nunca vuelve a sacar ese bloque.
  for (const rule of rulesStore.list().filter((r) => r.accountId === id)) {
    updateRegion(globalConfigPath, (region) => removeIncludeIfBlock(region, `${rule.path}/`))
    rulesStore.unpin(rule.path)
  }
  rmSync(getProfilePath(dataDir, id), { force: true })
  accountsStore.remove(id)
}
