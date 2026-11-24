# Proposal — Sincronizar cuentas previas a Dossier (parte a: credencial ya guardada en GCM)

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de vinculación de cuentas (lee el Credential Manager de Windows y confirma un token real contra la API de GitLab) — revisión obligatoria en sesión separada antes de mergear.

## Por qué

`docs/product.md`: `15-sincronizar-cuentas-previas` dejó afuera la parte (a) — detectar si GCM ya tiene guardada una credencial para un host, de algún uso previo de `git` común (p. ej. `git clone`) antes de instalar Dossier — porque GCM no tiene un comando de "listar credenciales de un host" genérico (a diferencia de GitHub, que sí tiene `credential-manager github list`), y no había un camino de solo lectura igual de seguro para probarlo sin tocar cuentas reales.

## Qué se encontró investigando de nuevo (nunca asumido de memoria)

- `cmdkey /list` (comando nativo de Windows, de solo lectura) sí muestra el username de cada credencial guardada por GCM, sin revelar la contraseña — pero su texto sale localizado según el idioma de Windows ("Destino"/"Target", "Usuario"/"User"), probado a mano contra esta máquina (en español). Parsear ese texto habría significado soportar cada idioma de Windows a mano, o fallar en silencio en los demás.
- La API nativa de Windows (`CredEnumerate`, `advapi32.dll`, vía P/Invoke desde PowerShell) da la misma información (target + username, nunca la contraseña) sin ningún texto localizado de por medio — probada en vivo contra el Credential Manager real de esta máquina antes de construir nada.
- **Hallazgo 1**: `spawn('powershell.exe', ...)` desde Node resuelve el Windows PowerShell 5.1 del sistema, no el pwsh 7+ de una sesión interactiva — probado a mano antes de asumirlo. `ConvertTo-Json -AsArray` no existe en PS 5.1 (se agregó en 6.2+), y sin eso, pasar el resultado por el pipe colapsa un array de un solo elemento a un objeto suelto. Se usa `ConvertTo-Json -InputObject $resultado -Compress` (sin pipe) en su lugar — confirmado con 0, 1 y 3 resultados contra el binario real que de verdad se termina invocando.
- **Hallazgo 2**: con más de una credencial guardada para el mismo host (el caso real que le importa a esta app, donde varias cuentas comparten host), GCM distingue la segunda credencial embebiendo el username en el target (`git:https://<username>@<host>`), no solo `git:https://<host>` — encontrado creando dos credenciales de prueba reales para el mismo host `.invalid` y comparando contra la enumeración real, nunca con JSON inventado a mano.
- Se encontró además, al investigar esto, una credencial de prueba residual real de `14-almacen-secretos-ausente` que no se había limpiado sola (ver `docs/lessons/README.md`) — ya se borró.

## Qué cambia

1. **`core/features/git-credential/git-credential.ts`**: `listGcmGitCredentials()` — enumera, de solo lectura, las credenciales `git:https://<host>` que GCM ya tiene guardadas (cualquier host, no solo GitHub), vía `CredEnumerate` nativo corrido desde un script de PowerShell. Nunca lanza (sin PowerShell, sin resultado, cualquier fallo da `[]`). `parseGcmGitCredentialsOutput` separado y puro, testeable sin PowerShell real.
2. **`core/features/link-account/link-account.ts`**: `findImportableGcmAccountsForHost(accountsStore, host, ...)` — a diferencia de (b) (una sola sesión de CLI posible), puede haber **varios** candidatos para el mismo host: pide el token real de cada uno con `fill` (ya existente) y lo confirma contra `GET /api/v4/user` (`linkGitlab`, ya existente) — la identidad real que se ofrece es siempre la que confirma la API, nunca la etiqueta que GCM tenía guardada. Devuelve todos los que verifican bien; un candidato sin token real o con token ya inválido se descarta en silencio, sin afectar a los demás.
3. **IPC**: `checkGcmCachedAccounts(host)` (devuelve una lista, nunca un token) y `importGcmCachedAccount(label, host, username)` (re-chequea del lado de `main`, por username porque puede haber más de un candidato).
4. **`GitlabLinkDialog.tsx`**: un cartel por cada cuenta detectada (puede haber más de una), al lado del cartel ya existente de `glab` CLI — mismo guard de "último dominio gana" que ya tiene ese diálogo.

## Qué NO cambia / queda fuera

- **GitHub**: ya tiene su propio camino (`listGithubAccounts`, orphan detection) y el de `gh` CLI (`15-sincronizar-cuentas-previas`) — no se duplica acá.
- No se modifica en nada el flujo existente de `approve`/`fill`/`reject` — esta función solo lee, nunca escribe ni borra.

## Riesgos

- **El token nunca debe llegar al renderer**: mismo diseño que (b) — `checkGcmCachedAccounts` solo devuelve campos seguros, `importGcmCachedAccount` vuelve a pedir el token del lado de `main`.
- **`CredEnumerate` nunca debe exponer la contraseña**: no se marshalea `CredentialBlob` en ningún momento — confirmado con un test real que compara el JSON completo contra la contraseña real guardada.
- **Un candidato con token vencido/inválido no debe romper a los demás ni mostrarse como error** — se descarta en silencio (igual criterio que (b) para el caso de un solo candidato).

## Criterio de éxito

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo contra el Credential Manager real de esta máquina, con credenciales de prueba contra un host `.invalid` (nunca cuentas reales): confirma que la enumeración encuentra el host y username reales (incluyendo el caso de dos cuentas en el mismo host, hallazgo 2), que el fallo esperado de verificación contra la API para un host `.invalid` (no resuelve DNS) se maneja en silencio sin romper nada (mismo límite ya documentado para (b): un host `.invalid` nunca puede completar ese roundtrip real), y que el estado final de cuentas reales no cambió.
