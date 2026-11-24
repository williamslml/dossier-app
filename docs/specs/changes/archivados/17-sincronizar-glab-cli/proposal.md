# Proposal — Sincronizar cuentas previas a Dossier (parte b: `glab` CLI)

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de vinculación de cuentas (confirma un token real contra la API de GitLab y lo guarda en GCM) — revisión obligatoria en sesión separada antes de mergear.

## Por qué

`docs/product.md`: `15-sincronizar-cuentas-previas` dejó afuera `glab` CLI a propósito porque no estaba instalado en la máquina de desarrollo y no se podía confirmar su comando/formato real sin inventarlo de memoria. Esta sesión se instaló el binario oficial (`gitlab-org/cli` v1.132.0, verificado por checksum SHA256 contra el publicado en la release) para probarlo de verdad antes de construir nada.

## Qué se encontró probándolo en vivo (nunca asumido de memoria)

- El comando real es `glab auth status --show-token --hostname <host>` — no existe un equivalente directo a `gh auth token`.
- **Hallazgo 1**: `glab` sale con código de salida ≠ 0 incluso cuando SÍ encuentra el token guardado — intenta confirmarlo contra la API del host, y si eso falla (host no resuelve, token inválido), igual imprime la línea del token *antes* de reportar el error final. Por eso nunca hay que confiar en el código de salida, solo en el texto.
- **Hallazgo 2, más importante**: esa línea ("Token found in ...: `<token>`") sale por **stderr**, no por stdout — confirmado con un `execFile` real, nunca visualmente en una terminal (que combina los dos canales y hace parecer que es todo stdout). Una implementación que solo mirara `stdout` (como se había armado en el primer intento) nunca habría encontrado nada, en silencio, sin ningún error visible.
- El texto exacto de esa línea cambia según el backend de almacenamiento (`Token found in configuration file (plaintext): ...` vs. `Token found in operating system keyring: ...`), pero el patrón `Token found in [^:]+: <token>` es el mismo en los dos casos.

## Qué cambia

1. **`core/features/cli-import/cli-import.ts`**: `findGitlabCliToken(host)` — corre `glab auth status --show-token --hostname <host>`, mira stdout **y** stderr concatenados (hallazgo 2), ignora el código de salida (hallazgo 1). Nunca lanza: sin `glab`, sin sesión para ese host, o cualquier otro fallo da `undefined`.
2. **`core/features/link-account/link-account.ts`**: `findImportableGitlabCliAccount(accountsStore, host, ...)` — mismo patrón que la versión de GitHub: si hay un token cacheado para ese host y la cuenta todavía no está vinculada, lo confirma contra `GET /api/v4/user` (`linkGitlab`, ya existente) y lo devuelve. Nunca crea la cuenta por sí sola.
3. **IPC**: `checkGitlabCliImport(host)` (nunca devuelve el token) y `importGitlabCliAccount(label, host)` (re-chequea del lado de `main`).
4. **`GitlabLinkDialog.tsx`**: a diferencia de GitHub (host fijo `github.com`), acá el host lo escribe el usuario — el cartel se chequea al montar (con el valor por defecto `gitlab.com`) y de nuevo cada vez que el usuario termina de editar el campo "Dominio" (`onBlur`), nunca en cada tecla.

## Qué NO cambia / queda fuera

- **GitHub CLI (`gh`)**: ya resuelto en `15-sincronizar-cuentas-previas`, sin cambios acá.
- **(a) detección de credencial de GCM pre-existente**: sigue fuera de alcance, mismo motivo que antes (sin probar en vivo, sin un camino de solo lectura igual de seguro).

## Riesgos

- **El token de `glab` nunca debe llegar al renderer**: mismo diseño que GitHub — `checkGitlabCliImport` solo devuelve campos seguros, `importGitlabCliAccount` vuelve a pedir el token del lado de `main`.
- **Un fallo de verificación (host no resuelve, token inválido) no debe mostrarse como un error de diálogo durante la detección pasiva** — solo "no hay nada para ofrecer" (igual que ya se corrigió para GitHub en `15-sincronizar-cuentas-previas`, aplicado acá desde el principio).

## Criterio de éxito

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo contra el binario real de `glab` (instalado aparte en el scratchpad de la sesión, nunca agregado al sistema de forma permanente), con una sesión de prueba contra un host `.invalid` (nunca una cuenta real): confirma que la detección real del token funciona (antes del fix de stderr, no funcionaba — confirmado el fallo real, no solo el test), que un fallo de verificación de red no rompe la UI ni crea una cuenta a medias, y que el estado final (2 cuentas reales) no cambió.
