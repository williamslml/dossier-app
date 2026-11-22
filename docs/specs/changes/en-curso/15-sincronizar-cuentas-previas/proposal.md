# Proposal — Sincronizar cuentas previas a Dossier (parte b: `gh` CLI)

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de vinculación de cuentas (confirma un token real contra la API de GitHub y lo guarda en GCM) — revisión obligatoria en sesión separada antes de mergear.

## Por qué

`docs/product.md` §2: "Sincronizar cuentas vinculadas antes de tener Dossier" — dos partes: (a) detectar una credencial de GCM ya guardada para un host, antes de pedir un token nuevo; (b) importar el token ya cacheado por `gh`/`glab` CLI, verificado contra la API igual que un token nuevo.

## Alcance de este change: solo (b), y solo `gh` (no `glab`)

- **`gh` CLI**: instalado y autenticado en esta misma máquina (`gh auth status` lo confirma) — su comando `gh auth token` es público, estable y bien documentado desde hace años. Se puede implementar y probar con confianza real.
- **`glab` CLI**: no está instalado en esta máquina, y no hay forma de confirmar en vivo el comando/formato exacto de su salida sin inventarlo de memoria — exactamente lo que `docs/lessons/README.md` ya advierte que no hay que hacer ("probarlo de verdad... no asumirlo de memoria"). Queda fuera de este change, documentado como pendiente.
- **(a) detectar una credencial de GCM ya guardada**: `docs/product.md` ya marca esto como "una suposición sin probar en vivo todavía" que "solo funcionaría bien con una sola credencial guardada por host". Probarlo de verdad implicaría experimentar contra el Credential Manager real de un desarrollador sin un camino claro, seguro y reversible para hacerlo — a diferencia de (b), que es: leer un comando público (`gh auth token`), confirmar el token contra la API (una llamada de solo lectura, `GET /user`), y recién crear la cuenta si el usuario lo confirma explícitamente. Queda fuera de este change, documentado como pendiente.

## Qué cambia

1. **`core/features/providers/github/github.ts`**: se extrae `fetchGithubUser(token)` de `linkGithub` (antes inline) — confirma cualquier token contra `GET /user`, no solo los que vienen de un Device Flow nuevo.
2. **`core/features/cli-import/cli-import.ts`** (nuevo): `findGithubCliToken()` — corre `gh auth token`, `undefined` si `gh` no está instalado o no hay sesión (nunca lanza).
3. **`core/features/link-account/link-account.ts`**: `findImportableGithubCliAccount(accountsStore, ...)` — si hay un token cacheado y la cuenta todavía no está vinculada, lo confirma contra la API y lo devuelve. Nunca crea la cuenta por sí sola.
4. **IPC**: `checkGithubCliImport` (devuelve solo `username`/`name`/`email` — **nunca el token** al renderer) y `importGithubCliAccount(label)` (re-chequea del lado de `main`, nunca confía en lo que el renderer recuerde de la primera llamada, y recién ahí llama a `saveLinkedAccount`, el mismo camino ya verificado que usa Device Flow).
5. **`GithubLinkDialog.tsx`**: si hay una sesión de `gh` CLI detectada para una cuenta nueva, un cartel la ofrece ("Ya tenés sesión de `gh` CLI con `<username>` — ¿usar esta cuenta?"). Nunca se usa automáticamente: hace falta la etiqueta escrita a mano y un clic explícito en "Usar esta cuenta", igual que el flujo normal.

## Qué NO cambia / queda fuera

- **`glab` CLI**: fuera de alcance, ver arriba.
- **(a) detección de credencial de GCM ya guardada**: fuera de alcance, ver arriba.
- **GitlabLinkDialog**: sin cambios — nada de esto aplica a GitLab en este change.

## Riesgos

- **El token de `gh` nunca debe llegar al renderer**: `checkGithubCliImport` solo devuelve campos seguros; `importGithubCliAccount` vuelve a pedir el token del lado de `main` en vez de reusar uno que el renderer hubiera visto.
- **No crear una cuenta automáticamente**: la detección es pasiva (un cartel), la creación exige clic explícito con una etiqueta ya escrita.

## Criterio de éxito

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo, de solo lectura (nunca se llama `importGithubCliAccount` contra la cuenta real, para no crear una cuenta de verdad sin que el usuario lo pida): `checkGithubCliImport()` real detecta la sesión de `gh` CLI de esta máquina, y el cartel aparece en el diálogo con el username correcto.
