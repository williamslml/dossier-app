# Design — Quick Clone

Ver `proposal.md`/`requirements.md` para el porqué y los requisitos. Acá, el enfoque técnico.

## Q1/Q2 — `core/features/clone/clone.ts`

Ver el archivo real para el código completo — acá, lo que cambió en la revisión de Q8 respecto al sketch original:

- `validateCloneUrl` también rechaza `parsed.username`/`parsed.password` no vacíos (Q8.3), y compara hosts en minúsculas de los dos lados (Q8.5).
- `cloneRepo` arma el `simpleGit` con `{ timeout: { block: 30_000 } }` + `.env('GIT_TERMINAL_PROMPT', '0')`, y agrega dos `-c` más al `git clone`: `credential.interactive=false` y `credential.guiPrompt=false` (Q8.1 — `GIT_TERMINAL_PROMPT` por sí solo no alcanzó, confirmado con un test que se colgó igual sin estos dos).
- **Hallazgo de implementación, aparte de la revisión:** llamar `.env({ ...process.env, GIT_TERMINAL_PROMPT: '0' })` (spread completo) disparaba el plugin de seguridad de `simple-git` ("Use of EDITOR is not permitted without enabling allowUnsafeEditor") si el `EDITOR` de la shell estaba seteado — la forma de un solo par clave/valor (`.env('GIT_TERMINAL_PROMPT', '0')`) evita el problema sin necesitar `allowUnsafeEditor`.

`InvalidCloneUrlError`/errores de Git (lanzados tal cual, `simple-git` ya los da con `stderr` legible) llegan al IPC handler, que los reenvía al renderer como el `message` de la excepción — mismo patrón que `FolderOverlapError` en `pinFolder`.

## Q5 — Orden de las operaciones en el handler de `main`

```ts
ipcMain.handle(IPC.cloneRepo, async (_event, payload: unknown) => {
  const { url, destPath, accountId } = cloneRepoSchema.parse(payload)
  const account = accountsStore.list().find((a) => a.id === accountId)
  if (!account) throw new Error('Cuenta no encontrada')

  validateCloneUrl(url, [...new Set(accountsStore.list().map((a) => a.host))])

  // Q8.2 (hallazgo de revisión): validateCloneUrl solo confirma que el host
  // tiene ALGUNA cuenta vinculada, nunca que sea la MISMA que accountId —
  // sin esto, un accountId de otro host dejaba el override de credencial
  // sin efecto y el Auto-Pin fijaba la carpeta a la cuenta equivocada.
  if (new URL(url).host !== account.host.toLowerCase()) {
    throw new Error('La cuenta elegida no es del mismo host que la URL.')
  }

  // Q5.1: el chequeo de solapamiento corre ANTES del clone — reusa la misma
  // normalización que ya tiene rulesStore internamente, llamando a un
  // chequeo de "solo lectura" antes de tocar disco/red. Decisión de diseño
  // al implementar: exportar una función `findOverlap(rules, path)` desde
  // `core/features/rules` (hoy esa lógica vive privada dentro de `pin`), en
  // vez de intentar/revertir — más simple que deshacer un clone a medias.
  const overlap = findOverlap(rulesStore.list(), destPath) // nueva función, ver tasks.md
  if (overlap) throw new FolderOverlapError(destPath, overlap.path)

  // Sin evento de progreso aparte (ver requirements.md Q6.1): una sola
  // llamada esperada de punta a punta, el `invoke` ya le dice al renderer
  // cuándo empieza/termina/falla.
  await cloneRepo(url, destPath, account)

  // Q4: mismo camino que pinFolder (src/main/index.ts), no uno paralelo.
  await writeAccountProfile(dataDir, account)
  const rule = rulesStore.pin(destPath, account.id)
  const block = await renderIncludeIfBlock(`${destPath}/`, getProfilePath(dataDir, account.id))
  updateRegion(globalConfigPath, (region) => `${region}\n${block}`.trim())

  return rule
})
```

## Q6 — Canal IPC

```ts
// src/shared/ipc-channels.ts
cloneRepo: 'cloneRepo',
```

`preload`: `cloneRepo(data): Promise<Rule>` (invoke) — sin evento aparte, ver la decisión de Q6.1 en requirements.md.

## Q3 — `CloneDialog.tsx` (renderer)

Mismo esqueleto que `GithubLinkDialog.tsx`: un `type Step = { kind: 'form' } | { kind: 'clonando' } | { kind: 'error'; message: string }`. El filtro de cuentas por host (Q3.2) se calcula en el render a partir del `host` que devuelve `new URL(url).host` cuando la URL ya es parseable (si no, la lista de cuentas queda vacía/el campo de cuenta deshabilitado hasta que la URL sea válida — evita que el usuario elija una cuenta de un host distinto al de la URL por error).

## Riesgos técnicos ya resueltos por reutilización (no se repiten)

Token nunca en disco/URL (GCM vía `credential.<host>.username`), escritura atómica de `active.gitconfig`/perfiles, y la región delimitada de `includeIf` — los tres ya están resueltos por código existente (`core/features/git-credential`, `core/features/identity`, `core/features/gitconfig/region.ts`) y Quick Clone los reutiliza tal cual, no reimplementa ninguno.
