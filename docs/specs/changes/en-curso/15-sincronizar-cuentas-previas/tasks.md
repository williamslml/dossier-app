# Tasks — Sincronizar cuentas previas a Dossier (parte b: `gh` CLI)

Señal de alto riesgo (confirma un token real contra la API y lo guarda en GCM): revisión obligatoria en sesión separada antes de mergear. Alcance acotado a `gh` CLI — `glab` CLI y la detección de credenciales de GCM pre-existentes (a) quedan fuera, ver proposal.md.

## 1. `core` (C1)

- [x] `findGithubCliToken` en `core/features/cli-import/cli-import.ts` (nuevo), con `exec` inyectable — nunca invoca `gh` real en los tests (su salida es un secreto)
- [x] `fetchGithubUser` extraída de `linkGithub` en `providers/github/github.ts`
- [x] `findImportableGithubCliAccount` en `core/features/link-account/link-account.ts`, exportados desde `core/index.ts`
- [x] Tests: `cli-import.test.ts` (3, con `exec` falso) · `link-account.test.ts` (+4: sin token, token de cuenta nueva, cuenta ya vinculada, token inválido propaga el error)

## 2. IPC (C2)

- [x] `checkGithubCliImport`/`importGithubCliAccount` en `ipc-channels.ts`, handlers en `main/index.ts` (el primero nunca devuelve el token), preload

## 3. Renderer (C3)

- [x] `GithubLinkDialog.tsx`: cartel de importación (carga al montar, reusa la etiqueta ya escrita, botón deshabilitado mientras importa)
- [x] CSS: `.cli-import-banner`

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (19 archivos, 131 tests)
- [x] `pnpm electron-vite build` + verificación en vivo con Playwright (`_electron`), de solo lectura: `checkGithubCliImport()` real detectó la sesión de `gh` CLI de esta máquina (`williamslml`, distinta de la cuenta ya vinculada `hmalasquez08`) y el cartel apareció en el diálogo con ese username — **nunca se llamó `importGithubCliAccount`** contra la cuenta real, para no crear una cuenta de verdad sin que el usuario lo pida explícitamente

## 5. Cierre del change

- [x] Revisión en sesión separada (señal de alto riesgo) — sin hallazgos bloqueantes. Confirmó (corriendo typecheck/lint/test ella misma, 133 tests en verde) que `checkGithubCliImport` nunca devuelve el token, que `importGithubCliAccount` vuelve a chequear del lado de `main` sin confiar en nada del renderer, que `findGithubCliToken` nunca invoca `gh` real en los tests, que `findImportableGithubCliAccount` confirma de verdad el token contra la API antes de ofrecerlo, que la extracción de `fetchGithubUser` es un refactor puro (sin cambiar el Device Flow existente), y que el cartel nunca vincula sin un clic explícito. Un hallazgo no bloqueante corregido: el `useEffect` que detecta la sesión de `gh` CLI no tenía `.catch` — un token ya inválido (expirado/revocado) quedaba como promesa rechazada sin manejar (mismo patrón que `AddButtons.tsx` ya había corregido para el almacén de secretos). Corregido: se trata como "no hay nada para ofrecer", nunca como error de diálogo
- [x] Merge con `finishing-a-development-branch` — mergeado localmente a `main` (sin conflictos), `pnpm typecheck && pnpm lint && pnpm test` en verde sobre el resultado, rama `feat/sincronizar-cuentas-previas` borrada
- [x] Mover la spec a `../archivados/`
