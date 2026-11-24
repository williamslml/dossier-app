# Design — Gestión de cuentas

## `core/features/identity/identity.ts`

```ts
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

export async function writeAccountProfile(dataDir: string, account: Account): Promise<void> {
  const profilePath = getProfilePath(dataDir, account.id)
  mkdirSync(dirname(profilePath), { recursive: true })
  rmSync(profilePath, { force: true }) // writeProfileConfig nunca hace unset
  await writeProfileConfig(profilePath, accountToProfileValues(account))
}
```

## `core/features/accounts/accounts.ts`

```ts
clearSigningKey(id: string): Account {
  return replace(id, (existing) => {
    const rest: Account = { ...existing }
    delete rest.signingKey // exactOptionalPropertyTypes: omitir, nunca `undefined`
    return rest
  })
}
```

## `core/features/account-lifecycle/account-lifecycle.ts` (nuevo)

```ts
export function removeLinkedAccount(deps: RemoveAccountDeps, id: string): void {
  const { rulesStore, accountsStore, dataDir, globalConfigPath } = deps
  for (const rule of rulesStore.list().filter((r) => r.accountId === id)) {
    rulesStore.unpin(rule.path)
    updateRegion(globalConfigPath, (region) => removeIncludeIfBlock(region, `${rule.path}/`))
  }
  rmSync(getProfilePath(dataDir, id), { force: true })
  accountsStore.remove(id)
}
```

Extraído a `core` (en vez de quedar inline en `main/index.ts`, como `pinFolder`/`unpinFolder`) específicamente para poder probarlo con Git real y stores aislados — es una operación destructiva que no se puede verificar en vivo contra una cuenta de producción.

## IPC / preload / renderer

`setSigningKey`/`clearSigningKey`/`removeAccount`, mismo molde que el resto (zod en los handlers con payload, `getState()` como respuesta). `AccountFoldersDialog.tsx` gana `SigningKeySection` (componente interno); `AccountCard.tsx` habilita el botón de desvincular (ya existía, deshabilitado); `App.tsx` agrega el estado para `RemoveAccountDialog.tsx` (nuevo), mismo patrón que `AccountFoldersDialog`.
