# Design — Quick Clone

Ver `proposal.md`/`requirements.md` para el porqué y los requisitos. Acá, el enfoque técnico.

## Q1/Q2 — `core/features/clone/clone.ts`

```ts
import { simpleGit } from 'simple-git'

export interface CloneAccount {
  host: string
  username: string
}

export class InvalidCloneUrlError extends Error {
  constructor(readonly url: string, reason: string) {
    super(`"${url}" no es una URL válida para clonar: ${reason}`)
    this.name = 'InvalidCloneUrlError'
  }
}

/** Q2.1/Q2.2: valida antes de que la URL llegue a Git — nunca confía en que
    Git rechace algo peligroso por su cuenta (p. ej. una URL empezando con
    `-`, que podría interpretarse como un flag). */
export function validateCloneUrl(url: string, knownHosts: string[]): void {
  if (!url.startsWith('https://')) {
    throw new InvalidCloneUrlError(url, 'solo se admite https://')
  }
  const host = new URL(url).host // tira si la URL es inválida más allá del esquema
  if (!knownHosts.includes(host)) {
    throw new InvalidCloneUrlError(url, `ninguna cuenta vinculada tiene el host "${host}"`)
  }
}

/** Q1.1: `-c credential.<host>.username=<username>` es un override puntual
    de esta invocación — nunca toca `~/.gitconfig` ni `active.gitconfig`,
    así que no interfiere con la cuenta activa ni con otras carpetas
    fijadas. `git.raw([...])` (no el `.clone()` de simple-git) para que el
    `-c` quede exactamente antes de `clone`, mismo patrón que ya usa el
    resto de `core` (`gitconfig.ts`, `identity.ts`). */
export async function cloneRepo(
  url: string,
  destPath: string,
  account: CloneAccount,
): Promise<void> {
  const git = simpleGit()
  await git.raw([
    '-c',
    `credential.${account.host}.username=${account.username}`,
    'clone',
    url,
    destPath,
  ])
}
```

`InvalidCloneUrlError`/errores de Git (lanzados tal cual, `simple-git` ya los da con `stderr` legible) llegan al IPC handler, que los reenvía al renderer como el `message` de la excepción — mismo patrón que `FolderOverlapError` en `pinFolder`.

## Q5 — Orden de las operaciones en el handler de `main`

```ts
ipcMain.handle(IPC.cloneRepo, async (event, payload: unknown) => {
  const { url, destPath, accountId } = cloneRepoSchema.parse(payload)
  const account = accountsStore.list().find((a) => a.id === accountId)
  if (!account) throw new Error('Cuenta no encontrada')

  validateCloneUrl(url, [...new Set(accountsStore.list().map((a) => a.host))])

  // Q5.1: el chequeo de solapamiento corre ANTES del clone — reusa la misma
  // normalización que ya tiene rulesStore internamente, llamando a un
  // chequeo de "solo lectura" antes de tocar disco/red. Decisión de diseño
  // al implementar: exportar una función `wouldOverlap(rules, path)` desde
  // `core/features/rules` (hoy esa lógica vive privada dentro de `pin`), en
  // vez de intentar/revertir — más simple que deshacer un clone a medias.
  const overlap = findOverlap(rulesStore.list(), destPath) // nueva función, ver tasks.md
  if (overlap) throw new FolderOverlapError(destPath, overlap.path)

  event.sender.send(IPC.cloneProgress, { phase: 'clonando' })
  try {
    await cloneRepo(url, destPath, account)
  } catch (err) {
    event.sender.send(IPC.cloneProgress, { phase: 'error', message: String(err) })
    throw err
  }

  // Q4: mismo camino que pinFolder (src/main/index.ts), no uno paralelo.
  await writeAccountProfile(dataDir, account)
  const rule = rulesStore.pin(destPath, account.id)
  const block = await renderIncludeIfBlock(`${destPath}/`, getProfilePath(dataDir, account.id))
  updateRegion(globalConfigPath, (region) => `${region}\n${block}`.trim())

  event.sender.send(IPC.cloneProgress, { phase: 'listo' })
  return rule
})
```

## Q6 — Canales IPC

```ts
// src/shared/ipc-channels.ts
cloneRepo: 'cloneRepo',
cloneProgress: 'cloneProgress',
```

`preload`: `cloneRepo(data): Promise<Rule>` (invoke) + `onCloneProgress(callback): () => void` (evento, mismo patrón que `onGithubVerification`).

## Q3 — `CloneDialog.tsx` (renderer)

Mismo esqueleto que `GithubLinkDialog.tsx`: un `type Step = { kind: 'form' } | { kind: 'clonando' } | { kind: 'error'; message: string }`. El filtro de cuentas por host (Q3.2) se calcula en el render a partir del `host` que devuelve `new URL(url).host` cuando la URL ya es parseable (si no, la lista de cuentas queda vacía/el campo de cuenta deshabilitado hasta que la URL sea válida — evita que el usuario elija una cuenta de un host distinto al de la URL por error).

## Riesgos técnicos ya resueltos por reutilización (no se repiten)

Token nunca en disco/URL (GCM vía `credential.<host>.username`), escritura atómica de `active.gitconfig`/perfiles, y la región delimitada de `includeIf` — los tres ya están resueltos por código existente (`core/features/git-credential`, `core/features/identity`, `core/features/gitconfig/region.ts`) y Quick Clone los reutiliza tal cual, no reimplementa ninguno.
