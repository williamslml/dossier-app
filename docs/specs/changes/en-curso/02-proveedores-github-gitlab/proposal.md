# Proposal — Fase 2: proveedores (GitHub Device Flow + GitLab PAT)

## Por qué

`docs/product.md` §5, Fase 2: "GitLab (PAT), GitHub (Device Flow), IPC — vinculas ambas, los tokens están en GCM y no en disco." Hasta ahora `core/features/accounts` modela una cuenta ya vinculada, pero no hay forma de **obtener** `username`/`name`/`email` reales desde el proveedor — eso es lo que falta para que `main` (Fase 3) tenga algo real que ofrecer al vincular una cuenta.

Además resuelve dos decisiones abiertas de `docs/product.md` §7:

1. **`client_id` de la OAuth App de GitHub** — ya conseguido: `Ov23liZi9KS6Wf5C1aJ5` (Device Flow habilitado).
2. **¿GitHub exige `x-access-token`?** — se confirma al probar el flujo real con una cuenta de verdad (parte de este change).

## Qué cambia

1. **Nuevo** `core/features/providers/github/`: Device Flow con `@octokit/auth-oauth-device`, scope `repo`; tras autorizar, `GET /user` para `login`/`id`/`name`; deriva el email `noreply` según la fecha de creación de la cuenta (`docs/product.md` §3.2).
2. **Nuevo** `core/features/providers/gitlab/`: valida un PAT contra `GET /api/v4/user` (scope `write_repository`, documentado pero no verificable por la API — el usuario lo elige al crear el token); host configurable (no asumir `gitlab.com`).
3. El `client_id` de GitHub (`Ov23liZi9KS6Wf5C1aJ5`) se registra como constante en `core/features/providers/github/` — **no es secreto** (Device Flow es OAuth público, el client_id está pensado para distribuirse con la app; `@octokit/auth-oauth-device` lo asume así).
4. Verificación en vivo (con tu cuenta real de GitHub, interactiva por diseño de OAuth): confirmar que `approve`/`fill` de `core/features/git-credential` funciona con el token real obtenido, y si GitHub exige `username=x-access-token` en vez del login real.

## Qué NO cambia / queda fuera

- Nada de `main`/IPC (Fase 3) — estas funciones son puro `core`, sin Electron.
- Quick Clone (Fase 4).
- GitLab self-hosted de verdad probado (el host es configurable desde el diseño, pero no hay instancia propia para probar contra — decisión abierta, `docs/product.md` §5 "Después").
- Scopes mínimos ya están decididos (`docs/adr/0006-seguridad.md`): `repo` (GitHub), `write_repository` (GitLab) — no se reabren aquí.

## Criterio de éxito

- `core/features/providers/github`: tests unitarios de lo que no depende de red real (construcción de datos, derivación de email noreply); verificación en vivo documentada como lección si algo difiere de lo esperado.
- `core/features/providers/gitlab`: test con un servidor HTTP de prueba simulando `/api/v4/user` (sin depender de GitLab real ni de un token verdadero para los tests automatizados).
- Confirmación explícita (contigo) de si `x-access-token` hace falta o no, documentada como ADR si cambia algo del diseño de `core` ya construido.
