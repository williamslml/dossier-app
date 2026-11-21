# Requirements — Fase 2: proveedores

## P1 — GitHub Device Flow (`core/features/providers/github/`)

- **P1.1** `linkGithub(onVerification)` inicia el Device Flow con `@octokit/auth-oauth-device` (`clientType: 'oauth-app'`, `clientId` fijo del proyecto, `scopes: ['repo']`) y llama `onVerification({ verification_uri, user_code, expires_in, interval })` tal como lo entrega la librería — sin reformatear ni inventar campos.
- **P1.2** Al completarse, devuelve `{ token, login, id, name, email }`: `token` de la respuesta de `auth()`; `login`/`id`/`name` de `GET https://api.github.com/user` con el token; `email` derivado (P1.3).
- **P1.3** Derivación del email noreply (`docs/product.md` §3.2): si `created_at` del usuario es `>= 2017-07-18` → `${id}+${login}@users.noreply.github.com`; si es anterior → `${login}@users.noreply.github.com`.
- **P1.4** Nunca se loguea ni se persiste el `token` fuera de lo que devuelve la función — quien la llama decide qué hacer con él (en el producto real: `git credential approve`, nunca disco).

**Escenario verificable (sin red real):** con un `created_at` fijo pasado a la función de derivación de email, confirmar los dos casos de P1.3 (antes/después de la fecha de corte) de forma unitaria.

**Escenario verificable (con red real, interactivo, requiere tu aprobación):** correr el Device Flow completo contra GitHub real, confirmar que `linkGithub` devuelve un `login`/`id`/`token` reales, y que `core/features/git-credential` guarda ese token correctamente — ahí se resuelve si GitHub exige `username=x-access-token`.

## P2 — GitLab PAT (`core/features/providers/gitlab/`)

- **P2.1** `linkGitlab(host, token)` valida el PAT contra `GET https://<host>/api/v4/user` con el header `PRIVATE-TOKEN: <token>`.
- **P2.2** Si la respuesta es 200: devuelve `{ username, id, name, email }` (`email`/`public_email` de la respuesta; si ninguno viene, `email: undefined` — no se inventa un patrón noreply para GitLab, decisión abierta sin confirmar oficialmente, `docs/product.md` §7.2).
- **P2.3** Si la respuesta es 401/403: lanza un error claro ("token inválido o sin permiso") — nunca expone el token en el mensaje de error.
- **P2.4** El `host` es un parámetro, nunca hardcodeado a `gitlab.com` (`docs/product.md` §3.2: soporte para instancias autoalojadas desde el día uno).

**Escenario verificable:** servidor HTTP de prueba local (sin red real, sin GitLab de verdad) que simula `/api/v4/user` — un caso 200 con body completo, un caso 200 sin email, un caso 401.

## Fuera de alcance de este change

IPC/`main` (Fase 3), Quick Clone (Fase 4), GitLab self-hosted real (sin instancia para probar).
