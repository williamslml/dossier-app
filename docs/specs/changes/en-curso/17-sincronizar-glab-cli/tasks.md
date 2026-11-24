# Tasks — Sincronizar cuentas previas a Dossier (parte b: `glab` CLI)

Señal de alto riesgo (confirma un token real contra la API y lo guarda en GCM): revisión obligatoria en sesión separada antes de mergear.

## 0. Investigación previa (antes de escribir código)

- [x] Instalado el binario oficial de `glab` (v1.132.0, `gitlab-org/cli`), descargado de la release real y verificado por SHA256 contra el `checksums.txt` publicado — nunca en el sistema de forma permanente, solo en el scratchpad de la sesión
- [x] Probado en vivo (host `.invalid`, nunca una cuenta real): encontrados los dos hallazgos reales documentados en proposal.md (código de salida ≠0 con token encontrado; la línea del token sale por stderr, no stdout)

## 1. `core` (G1)

- [x] `findGitlabCliToken` en `cli-import.ts` (stdout+stderr, ignora código de salida)
- [x] `findImportableGitlabCliAccount` en `link-account.ts`, exportados desde `core/index.ts`
- [x] Tests: `cli-import.test.ts` (+6, incluido uno que confirma que stdout solo también se revisa) · `link-account.test.ts` (+5: sin token, token de cuenta nueva, cuenta ya vinculada, mismo username en otro host no cuenta, token inválido propaga el error)

## 2. IPC (G2)

- [x] `checkGitlabCliImport`/`importGitlabCliAccount` en `ipc-channels.ts`, handlers en `main/index.ts`, preload

## 3. Renderer (G3)

- [x] `GitlabLinkDialog.tsx`: cartel de importación, chequeo al montar + `onBlur` del dominio

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (20 archivos, 153 tests)
- [x] `pnpm electron-vite build` + verificación en vivo con Playwright (`_electron`) y el binario real de `glab` (PATH inyectado solo para el proceso de prueba, config aislada en el scratchpad): confirmado que la detección real del token funciona (tras el fix de stderr — antes del fix, fallaba en silencio, confirmado el bug real); un host con sesión de prueba que no puede verificarse contra la API (`.invalid`, nunca resuelve) no muestra el cartel ni rompe nada; un host sin ninguna sesión tampoco; estado final de cuentas reales sin cambios (2), sin errores de consola

## 5. Cierre del change

- [ ] Revisión en sesión separada (señal de alto riesgo)
- [ ] Merge con `finishing-a-development-branch`
- [ ] Mover la spec a `../archivados/`
