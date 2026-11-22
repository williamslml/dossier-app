# Tasks — Detección de almacén de secretos ausente

Señal de alto riesgo (round-trip real de `approve`/`fill`/`reject` contra GCM): revisión obligatoria en sesión separada antes de mergear.

## 1. `core` (S1)

- [x] `checkSecretStoreHealth`/`SecretStoreHealth` en `git-credential.ts`, exportados desde `core/index.ts`
- [x] Tests (2): round-trip real da `healthy: true` · un "fill" aparte confirma que "reject" de verdad borró la credencial (ver revisión)

## 2. IPC (S2)

- [x] `checkSecretStore` en `ipc-channels.ts`, handler en `main/index.ts`, preload

## 3. Renderer (S3)

- [x] `store.ts`: `checkSecretStore()`
- [x] `AddButtons.tsx`: `openLinkDialog` corre el chequeo antes de abrir GitHub/GitLab, botones deshabilitados mientras verifica, toast si `healthy: false` (nunca abre el diálogo en ese caso)

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (18 archivos, 126 tests)
- [x] `pnpm electron-vite build` + verificación en vivo con Playwright (`_electron`): `checkSecretStore()` real da `{"healthy":true}`; clic en "GitHub" y en "GitLab" abre los dos diálogos con normalidad (el camino sano nunca bloquea)

## 5. Cierre del change

- [x] Revisión en sesión separada (señal de alto riesgo) — sin hallazgos bloqueantes. Confirmó (corriendo typecheck/lint/test ella misma en un worktree aislado, 126 tests en verde) que el host/username/password de prueba son siempre descartables y aleatorios, que `reject` corre siempre en el `finally`, que el `detail` no filtra el password de prueba, y que no hay condición de carrera de doble clic (mismo estado `checking` sincrónico). Tres hallazgos no bloqueantes, los tres corregidos: (1) `proposal.md` afirmaba de forma categórica que un fallo del `reject` final ya habría sido reportado por `healthy:false` — no es exacto si `approve`+`fill` salieron bien y el `reject` falla de forma independiente (la credencial de prueba quedaría huérfana sin aviso); reescrito como riesgo residual conocido y aceptado, no corregido en código (probabilidad baja, host de prueba siempre descartable); (2) el test "nunca deja basura" solo inferia la limpieza corriendo el chequeo dos veces, sin confirmarla de forma directa — reescrito para forzar una credencial fija y confirmar con un `fill` aparte que ya no está (mismo patrón que "reject borra solo la credencial indicada"); (3) `AddButtons.tsx`'s `openLinkDialog` no tenía `catch`, así que un fallo del propio IPC (no de la lógica de salud, que nunca lanza) habría quedado como promesa rechazada sin manejar — agregado un `catch` con un toast genérico
- [x] Merge con `finishing-a-development-branch` — mergeado localmente a `main` (fast-forward, sin conflictos), `pnpm typecheck && pnpm lint && pnpm test` en verde sobre el resultado, rama `feat/almacen-secretos-ausente` borrada
- [x] Mover la spec a `../archivados/`
