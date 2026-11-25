# Tasks — Sincronizar cuentas previas a Dossier (parte a: credencial ya guardada en GCM)

## 1. `core`: enumeración

- [x] `listGcmGitCredentials()` + `parseGcmGitCredentialsOutput` (pura) en `git-credential.ts`
- [x] Tests puros de `parseGcmGitCredentialsOutput` (target simple, target con username embebido, sin username, JSON inválido/vacío, colapso a objeto suelto)
- [x] Tests reales contra el Credential Manager de esta máquina (host `.invalid`, limpieza garantizada): encuentra una credencial recién guardada, nunca expone la contraseña, dos credenciales en el mismo host (hallazgo del username embebido)

## 2. `core`: verificación por host

- [x] `findImportableGcmAccountsForHost` en `link-account.ts`
- [x] Tests (sin GCM/API real, todo inyectado): sin candidatos, candidato de otro host ignorado, candidato nuevo verificado, identidad real prevalece sobre la etiqueta de GCM, cuenta ya vinculada (por host+username o por el username que resuelve la API) no se repite, varios candidatos nuevos se devuelven todos, un candidato roto (fill o linkGitlab fallan) no afecta a los demás, dos candidatos que resuelven al mismo username real no se duplican

## 3. IPC + preload

- [x] `checkGcmCachedAccounts` / `importGcmCachedAccount` en `ipc-channels.ts`, `main/index.ts`, `preload/index.ts`

## 4. UI — `GitlabLinkDialog.tsx`

- [x] Un cartel por cada cuenta detectada, reutilizando el guard de "último dominio gana" ya existente
- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde

## 5. Verificación en vivo

- [x] `pnpm build` + Playwright `_electron` contra el binario real: credenciales de prueba contra un host `.invalid` (dos cuentas, mismo host) — confirma que la enumeración real encuentra host y username correctos (encontró y corrigió el hallazgo del username embebido)
- [x] Confirmado el límite esperado (igual que `glab` CLI en `17-sincronizar-glab-cli`): un host `.invalid` nunca completa el roundtrip real contra la API de GitLab (no resuelve DNS), así que el cartel de verificación no puede probarse en vivo con datos ficticios — cubierto por los tests inyectados del punto 2, no es un hallazgo nuevo
- [x] Credenciales de prueba limpiadas (confirmado con una enumeración real aparte, no solo inferido)

## 6. Cierre del change

- [x] Revisión en sesión separada (señal de alto riesgo) — sin hallazgos bloqueantes. Confirmó punto por punto: el token nunca llega al renderer, `CredEnumerate` nunca marshalea `CredentialBlob`, la identidad ofrecida siempre pasa por `linkGitlab` (nunca la etiqueta de GCM), un candidato roto (`fill` o `linkGitlab` fallan) nunca tumba a los demás, la deduplicación por username real funciona, el guard de "último dominio gana" cubre también el chequeo nuevo de GCM, y `importGcmCachedAccount` vuelve a verificar del lado de `main`. Dos observaciones no bloqueantes: (1) `listGcmGitCredentials` no tenía timeout en el `spawn` de PowerShell, a diferencia de `runGitCredential` — corregido, mismo patrón de `settled`/`clearTimeout`/`child.kill()`; (2) con varios candidatos de GCM, cada blur del campo dominio dispara una verificación real contra la API por candidato — mismo patrón ya establecido por `glab` CLI, no es un riesgo nuevo, se deja como está
- [x] Merge con `finishing-a-development-branch` — mergeado localmente a `main` (sin conflictos), `pnpm typecheck && pnpm lint && pnpm test` en verde sobre el resultado, rama `feat/detectar-credencial-gcm` borrada
- [x] Mover la spec a `../archivados/`
