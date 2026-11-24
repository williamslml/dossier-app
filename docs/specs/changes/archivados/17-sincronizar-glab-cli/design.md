# Design — Sincronizar cuentas previas a Dossier (parte b: `glab` CLI)

## `core/features/cli-import/cli-import.ts`

```ts
export function findGitlabCliToken(host: string, exec: ExecFile = execFile): Promise<string | undefined> {
  return new Promise((resolve) => {
    exec(
      'glab',
      ['auth', 'status', '--show-token', '--hostname', host],
      { encoding: 'utf8' },
      (_err, stdout, stderr) => {
        const combined = `${stdout ?? ''}\n${stderr ?? ''}`
        const match = /Token found in [^:]+:\s*(\S+)/.exec(combined)
        resolve(match?.[1])
      },
    )
  })
}
```

`ExecFile` (compartido con `findGithubCliToken`) ganó un tercer parámetro opcional (`stderr`) en su callback — `gh` nunca lo necesita, `glab` sí.

## `core/features/link-account/link-account.ts`

```ts
export async function findImportableGitlabCliAccount(
  accountsStore: AccountsStore,
  host: string,
  findToken = defaultFindGitlabCliToken,
  linkGitlab = defaultLinkGitlab,
): Promise<LinkedAccount | undefined> {
  const token = await findToken(host)
  if (!token) return undefined
  const linked = await linkGitlab(host, token)
  const alreadyLinked = accountsStore.list().some((a) => a.host === host && a.username === linked.username)
  return alreadyLinked ? undefined : linked
}
```

Reusa `linkGitlab(host, token)` (ya existente, sin cambios) — a diferencia de GitHub, GitLab nunca necesitó una extracción (`linkGitlab` ya tomaba el token como parámetro directo, no estaba atado al Device Flow).

## IPC / preload / renderer

Mismo molde que la versión de GitHub: `checkGitlabCliImport`/`importGitlabCliAccount` reciben `host` (y `label` el segundo) con zod. `GitlabLinkDialog.tsx` gana `cliImport`/`importingCli`, con `checkCliImport(host)` llamado en `useEffect` (al montar) y en `onBlur` del campo "Dominio" — nunca en `onInput`, para no spamear el chequeo en cada tecla. El cartel comparte la clase `.cli-import-banner` ya existente (sin CSS nuevo).
