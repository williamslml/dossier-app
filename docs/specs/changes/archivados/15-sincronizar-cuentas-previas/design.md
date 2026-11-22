# Design — Sincronizar cuentas previas a Dossier (parte b: `gh` CLI)

## `core/features/cli-import/cli-import.ts`

```ts
export type ExecFile = (
  command: string,
  args: string[],
  options: { encoding: 'utf8' },
  callback: (error: Error | null, stdout: string) => void,
) => void

export function findGithubCliToken(exec: ExecFile = execFile): Promise<string | undefined>
```

`exec` inyectable a propósito: la salida de `gh auth token` es un secreto real (a diferencia de `git config`, que no lo es) — los tests nunca invocan el `gh` real, siempre un `exec` falso.

## `core/features/providers/github/github.ts`

`fetchGithubUser(token)` extraída de `linkGithub` — mismo `GET /user`, reusable con cualquier origen de token.

## `core/features/link-account/link-account.ts`

```ts
export async function findImportableGithubCliAccount(
  accountsStore: AccountsStore,
  findToken = defaultFindGithubCliToken,
  fetchUser = defaultFetchGithubUser,
): Promise<LinkedAccount | undefined>
```

Mismo patrón de inyección que `saveLinkedAccount`/`linkGithubAccount` (parámetros con default, reemplazables en tests).

## IPC / preload / renderer

`IPC.checkGithubCliImport` (sin payload) → handler llama `findImportableGithubCliAccount` y devuelve solo `{ username, name, email }` o `null` — nunca el token. `IPC.importGithubCliAccount` (`{ label }`, validado con zod) → vuelve a correr la detección del lado de `main` y llama `saveLinkedAccount` (mismo camino verificado que ya usa `linkGithubAccount`).

`GithubLinkDialog.tsx`: estado `cliImport` (se carga con `useEffect` al montar) + `importingCli`. El cartel vive dentro del paso `form`, antes del botón de enviar — reusa `label` (la misma etiqueta que ya está escribiendo el usuario para el flujo normal), no pide una etiqueta aparte.
