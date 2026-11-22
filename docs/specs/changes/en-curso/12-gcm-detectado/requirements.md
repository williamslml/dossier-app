# Requirements — GCM detectado y usable

## G1. `core`: `getCredentialStatus`

- G1.1: lee `credential.helper` global (`git config --get-all credential.helper`), nunca escribe nada.
- G1.2: `gcmConfigured` es `true` si algún helper de la cadena matchea `manager` (cubre `manager` y la legada `manager-core`).
- G1.3: `otherHelperBeforeGcm` es `true` solo si hay al menos un helper antes del primero que matchea `manager`.
- G1.4: si la clave no existe (sin ningún helper configurado), nunca lanza — devuelve `{ gcmConfigured: false, helpers: [], otherHelperBeforeGcm: false }`.

## G2. IPC

- G2.1: `getCredentialStatus` y `recheckCredentials` devuelven el mismo `CredentialStatus`, llamando a la misma función de `core` — la única diferencia es cuándo se disparan (al cargar vs. a pedido).

## G3. UI — `Footer.tsx`

- G3.1: sin estado (`null`, antes de la primera respuesta del IPC): punto "idle", texto "Verificando…".
- G3.2: `gcmConfigured: false`: punto de error, "GCM no detectado".
- G3.3: `gcmConfigured: true` y `otherHelperBeforeGcm: true`: punto de advertencia, "Otro gestor puede interferir".
- G3.4: `gcmConfigured: true` y `otherHelperBeforeGcm: false`: punto ok, "Sincronizado".
- G3.5: clic siempre dispara `recheckCredentials`; además, si `gcmConfigured` es `false`, abre la página de descarga de Git for Windows.

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo de solo lectura (Playwright `_electron`): confirmar `CredentialStatus` real de esta máquina y que el pie lo refleja; confirmar que el clic no produce errores de consola.
