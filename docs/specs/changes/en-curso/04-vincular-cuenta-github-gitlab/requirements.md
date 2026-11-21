# Requirements — Vincular cuenta

## L1 — `core/features/link-account` (orquestación)

- **L1.1** `linkGithubAccount(label, onVerification)`: llama a `linkGithub` (Fase 2), guarda el token con `runGitCredential('approve', { protocol: 'https', host: 'github.com', username: login, password: token })`, verifica con `runGitCredential('fill', { protocol: 'https', host: 'github.com', username: login })`. Si `fill` no devuelve el mismo token, lanza un error y **no** crea la cuenta.
- **L1.2** `linkGitlabAccount(label, host, token)`: mismo patrón que L1.1 pero con `linkGitlab(host, token)` y `host` real (sin protocolo) en el `approve`/`fill`.
- **L1.3** Si el guardado/verificación en GCM tiene éxito, crea el registro con `accountsStore.create({ provider, host, label, username, name, email })` y lo devuelve.
- **L1.4** El `token` nunca forma parte del valor devuelto por estas funciones — ya se consumió por completo dentro de la orquestación (ADR 0006).
- **L1.5** `host` para GitHub es siempre `'github.com'`, fijo (el proveedor de GitHub no acepta host configurable — a diferencia de GitLab).

**Escenario verificable:** mismo patrón que ya usan los tests de `core/features/git-credential` — GCM real en Windows (`describe.skipIf(!isWindows)`), host reservado `.invalid` que nunca resuelve por red, usuario/token de prueba con sufijo aleatorio, limpieza garantizada con `reject` al final (R5). Casos: `linkGithubAccount`/`linkGitlabAccount` con un proveedor inyectado que devuelve datos de prueba — uno donde `approve`→`fill` tiene éxito (se crea la cuenta) y uno donde se fuerza que `fill` no encuentre el token (no se crea la cuenta, error claro).

## L2 — IPC (`main`)

- **L2.1** `startGithubLink`: inicia `linkGithubAccount`; mientras espera, emite por evento (`ipcRenderer.on`) el `user_code`/`verification_uri` tal como llega de `onVerification` — sin reformatear. Al terminar (éxito o error), resuelve la invocación original con el resultado.
- **L2.2** `linkGitlab` (nombre de `product.md` §3.4; en código es el handler que llama a `linkGitlabAccount`): recibe `{ host, token, label }`, valida el esquema con `zod` antes de tocar `core`, devuelve la cuenta creada o un error.
- **L2.3** Cada handler valida el payload de entrada con `zod` (ADR 0006, ya establecido en Fase 3 parte 1).
- **L2.4** Tras vincular con éxito, dispara `notify({ title, body: '<label> vinculada', important: false })` (ADR 0007) — primer evento real del módulo de notificaciones.
- **L2.5** No existe `cancelGithubLink` en este change (ver proposal.md, "Qué NO cambia") — cerrar el diálogo en el renderer dejar de escuchar el evento, no cancela nada en `main`.

**Escenario verificable:** test de integración de los handlers IPC con un `core` real pero un proveedor falso (inyectado), confirmando que el evento de verificación llega al callback antes de que se resuelva la promesa final.

## L3 — Diálogo de GitHub (renderer)

- **L3.1** Al hacer clic en "GitHub" (ya no deshabilitado): abre un diálogo modal con una etiqueta editable (nombre para la cuenta, `label`) y un botón "Vincular".
- **L3.2** Mientras se espera la autorización: muestra el `user_code` grande, copiable con un clic, y un enlace a `verification_uri` que abre el navegador del sistema (`shell.openExternal`, nunca dentro de la ventana de la app).
- **L3.3** Éxito: cierra el diálogo, la cuenta aparece en la lista de `ActiveBanner`/`AccountCard`.
- **L3.4** Error (red, token rechazado, fallo de GCM): el diálogo muestra el mensaje y permite reintentar sin cerrar.
- **L3.5** Cerrar el diálogo en cualquier momento no dispara ninguna llamada adicional (ver L2.5).

## L4 — Diálogo de GitLab (renderer)

- **L4.1** Al hacer clic en "GitLab": diálogo con tres campos: etiqueta (`label`), host (con `gitlab.com` precargado pero editable), token (campo de contraseña, nunca de texto plano en pantalla).
- **L4.2** Validación básica en el cliente antes de enviar (campos no vacíos); el error real (token inválido) lo informa `main` tras intentar `linkGitlab`.
- **L4.3** Éxito/]error: mismo patrón que L3.3/L3.4.

## L5 — Preload

- **L5.1** `preload` expone `startGithubLink(label)`, `onGithubVerification(callback)` (suscripción al evento de L2.1), `linkGitlab(data)` — subconjunto de `DossierApi`, tipado con los mismos tipos que ya re-exporta (`Account`).

## Fuera de alcance de este change

Cancelar un Device Flow en curso, editar/desvincular cuentas, Carpetas fijadas, Ajustes, Quick Clone, Doctor, GitLab autoalojado real — ver `proposal.md`.
