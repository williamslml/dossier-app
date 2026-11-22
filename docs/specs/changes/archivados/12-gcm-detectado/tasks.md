# Tasks — GCM detectado y usable

Señal de alto riesgo (credenciales/GCM, aunque de solo lectura): revisión obligatoria en sesión separada antes de mergear.

## 1. `core` (G1)

- [x] `getCredentialStatus` + `parseCredentialHelperChain` en `git-credential.ts`, exportadas desde `core/index.ts`
- [x] Tests: `parseCredentialHelperChain` (pura), `getCredentialStatus` contra GCM real de esta máquina + nunca lanza

## 2. IPC (G2)

- [x] `getCredentialStatus`/`recheckCredentials` en `ipc-channels.ts`, handlers en `main/index.ts`, preload

## 3. Renderer (G3)

- [x] `store.ts`: `$credentialStatus`, `loadCredentialStatus`, `recheckCredentials`
- [x] `App.tsx`: carga el estado al montar, lo pasa a `Footer` en los dos lugares
- [x] `Footer.tsx`: 3 estados reales + clic para reverificar / abrir descarga de Git for Windows
- [x] CSS: `--status-dot-warn` (claro/oscuro) + `.status-dot--warn`/`.status-dot--error`, reset de botón para `.footer-status`

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (116 tests)
- [x] `pnpm electron-vite build` + verificación en vivo con Playwright (`_electron`), de solo lectura: `getCredentialStatus()` real = `{"gcmConfigured":true,"helpers":["manager"],"otherHelperBeforeGcm":false}`, pie muestra "Sincronizado"; clic en el pie reverifica sin errores de consola

## 5. Cierre del change

- [x] Revisión en sesión separada (señal de alto riesgo) — sin hallazgos bloqueantes. Confirmó (corriendo typecheck/lint/test ella misma, 116 tests en verde) que `getCredentialStatus`/`parseCredentialHelperChain` nunca escriben nada (solo `--get-all`, sin `--replace-all`/`--add`/`--unset`), que el caso sin ninguna clave configurada no lanza, que los handlers IPC no necesitan zod (no reciben payload), que `describe()` cubre los 3 estados sin ambigüedad y que `openExternal` solo se llama con la URL fija de Git for Windows, nunca con algo dinámico. Un hallazgo menor no bloqueante: `handleClick` en `Footer.tsx` usaba un chequeo "falsy" (`!status?.gcmConfigured`) en vez del estricto (`status?.gcmConfigured === false`) que ya usaba el `title` del mismo botón — durante el estado inicial `null` ("Verificando…"), un clic en esa ventana de milisegundos abría de más la página de descarga. Corregido: mismo chequeo estricto en los dos lugares
- [x] Merge con `finishing-a-development-branch` — mergeado localmente a `main` (fast-forward, sin conflictos), `pnpm typecheck && pnpm lint && pnpm test` en verde sobre el resultado (116 tests), rama `feat/gcm-detectado` borrada
- [x] Mover la spec a `../archivados/`
