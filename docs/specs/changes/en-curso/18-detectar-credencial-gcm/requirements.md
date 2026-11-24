# Requirements — Sincronizar cuentas previas a Dossier (parte a: credencial ya guardada en GCM)

## G1. `core`: enumeración de solo lectura

- G1.1: `listGcmGitCredentials()` enumera, por `CredEnumerate` nativo (nunca texto localizado de `cmdkey`), cada credencial `git:https://<host>` guardada en el Credential Manager de Windows — host y username, nunca la contraseña.
- G1.2: soporta el caso real de varias credenciales para el mismo host (hallazgo: GCM embebe el username en el target de la segunda en adelante, `git:https://<username>@<host>`) — el host extraído debe ser el mismo para todas.
- G1.3: sin PowerShell, sin resultado, o salida irreconocible → `[]`, nunca lanza.
- G1.4: el script de PowerShell corre en el `powershell.exe` real que `spawn` resuelve (Windows PowerShell 5.1, no asumir pwsh 7+) — probado contra ese binario, no solo contra una terminal interactiva.

## G2. `core`: verificación por host

- G2.1: `findImportableGcmAccountsForHost(accountsStore, host, ...)` filtra los candidatos de `listGcmGitCredentials()` por el host pedido.
- G2.2: para cada candidato nuevo (no ya vinculado), pide el token real con `fill` (ya existente) y lo confirma contra `GET /api/v4/user` (`linkGitlab`, ya existente) — la identidad ofrecida es siempre la que confirma la API, nunca la etiqueta que tenía GCM.
- G2.3: puede devolver más de un candidato — nunca elige uno solo por su cuenta.
- G2.4: si el host del candidato ya está vinculado con ese username (en `accountsStore`, o porque la API resuelve a un username ya vinculado), no se ofrece de nuevo.
- G2.5: un candidato sin token real (`fill` falla) o con token ya inválido (`linkGitlab` lanza) se descarta en silencio — nunca rompe a los demás candidatos.
- G2.6: dos candidatos de GCM que resuelven, vía API, al mismo username real nunca se duplican en el resultado.

## G3. IPC

- G3.1: `checkGcmCachedAccounts(host)` nunca devuelve un token — solo `username`/`name`/`email`, en una lista (puede ser vacía).
- G3.2: `importGcmCachedAccount(label, host, username)` vuelve a correr la detección+verificación del lado de `main` y busca el candidato por `username` (puede haber más de uno) — nunca confía en el renderer.

## G4. UI — `GitlabLinkDialog.tsx`

- G4.1: un cartel por cada cuenta detectada (0, 1, o varias), al lado del cartel ya existente de `glab` CLI.
- G4.2: mismo guard de "último dominio gana" que ya tiene el diálogo (hallazgo de revisión de `17-sincronizar-glab-cli`) — se extiende a este chequeo, no se duplica la lógica.
- G4.3: "Usar esta cuenta" exige una etiqueta ya escrita, igual que los demás caminos de vincular.

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo contra el Credential Manager real de esta máquina (credenciales de prueba contra un host `.invalid`, nunca cuentas reales): confirma que la enumeración encuentra host y username reales, incluyendo el caso de dos cuentas en el mismo host. El paso de verificación contra la API real no se puede probar en vivo con un host `.invalid` (nunca resuelve DNS) — mismo límite ya documentado para `glab` CLI (b); ese camino queda cubierto por los tests inyectando `linkGitlab`.
