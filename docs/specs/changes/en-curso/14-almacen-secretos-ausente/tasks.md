# Tasks — Detección de almacén de secretos ausente

Señal de alto riesgo (round-trip real de `approve`/`fill`/`reject` contra GCM): revisión obligatoria en sesión separada antes de mergear.

## 1. `core` (S1)

- [x] `checkSecretStoreHealth`/`SecretStoreHealth` en `git-credential.ts`, exportados desde `core/index.ts`
- [x] Tests (2): round-trip real da `healthy: true` · dos corridas seguidas no dejan el almacén roto

## 2. IPC (S2)

- [x] `checkSecretStore` en `ipc-channels.ts`, handler en `main/index.ts`, preload

## 3. Renderer (S3)

- [x] `store.ts`: `checkSecretStore()`
- [x] `AddButtons.tsx`: `openLinkDialog` corre el chequeo antes de abrir GitHub/GitLab, botones deshabilitados mientras verifica, toast si `healthy: false` (nunca abre el diálogo en ese caso)

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (18 archivos, 126 tests)
- [x] `pnpm electron-vite build` + verificación en vivo con Playwright (`_electron`): `checkSecretStore()` real da `{"healthy":true}`; clic en "GitHub" y en "GitLab" abre los dos diálogos con normalidad (el camino sano nunca bloquea)

## 5. Cierre del change

- [ ] Revisión en sesión separada (señal de alto riesgo)
- [ ] Merge con `finishing-a-development-branch`
- [ ] Mover la spec a `../archivados/`
