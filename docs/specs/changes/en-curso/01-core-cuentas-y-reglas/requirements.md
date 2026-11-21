# Requirements — Fase 1: módulo `core`

## M1 — Migración de lo ya validado

- **M1.1** `core/features/git-credential/` expone lo que validó el spike (`approve`/`fill`/`reject`), mismos tests, en verde, sin cambios de comportamiento.
- **M1.2** `core/features/gitconfig/` expone lo que validó el spike (`writeProfileConfig`/`writeIncludeIf`), mismos tests, en verde.
- **M1.3** Ningún archivo de `core/` importa `electron` (docs/product.md §3.1, regla dura — se verifica con una regla de lint, no solo de memoria).

**Escenario verificable:** `pnpm test` incluye los tests migrados y pasan igual que en el spike; `pnpm lint` falla si alguien agrega `import ... from 'electron'` dentro de `core/`.

## M2 — Cuentas (`core/features/accounts/`)

- **M2.1** Crear una cuenta con `{ provider, host, label, username, name, email }` genera un `id` y la persiste.
- **M2.2** Listar cuentas devuelve las persistidas, sin campos de secreto (no hay `token`/`password` en el tipo `Account` — ni siquiera opcional).
- **M2.3** Renombrar la etiqueta (`label`) de una cuenta existente la actualiza sin tocar el resto de campos.
- **M2.4** Eliminar una cuenta la quita de la lista; eliminar un `id` inexistente no lanza (idempotente) o lanza un error claro — decisión de diseño, documentada en `design.md`.
- **M2.5** El almacenamiento usa `conf` (docs/product.md §4.2) con escritura atómica; en tests, apunta a un directorio temporal (`projectName`/`cwd` de `conf`), nunca a `~/.dossier` real del usuario.

**Escenario verificable:** test de integración que crea 2 cuentas, lista, renombra una, elimina la otra, y relee desde un `conf` nuevo apuntando al mismo directorio para confirmar que persistió en disco (no solo en memoria).

## M3 — Reglas de carpeta (`core/features/rules/`)

- **M3.1** Fijar una carpeta a una cuenta crea una regla `{ path, accountId }`.
- **M3.2** Fijar una carpeta que ya está fijada a otra cuenta la reemplaza (re-fijar es válido) — distinto de M3.3.
- **M3.3** Fijar una carpeta que está **dentro** de otra ya fijada (o que ya contiene una fijada) se **rechaza**, indicando el conflicto (docs/product.md §4.3.3: "una carpeta solo puede pertenecer a una cuenta... no hay competencia por prefijo").
- **M3.4** Desfijar una carpeta la quita de las reglas.
- **M3.5** Listar reglas devuelve las persistidas con el mismo mecanismo de `conf` que `accounts`.

**Escenario verificable:** fijar `C:/work/a`, luego intentar fijar `C:/work/a/sub` → rechazado con el conflicto nombrado; fijar `C:/work/b` (sin relación) → aceptado; desfijar `C:/work/a` → ya no aparece en la lista.

## Fuera de alcance de este change

Proveedores OAuth/PAT, `state.json`/`settings.json`, cualquier integración con `main`/IPC — ver `proposal.md` §"Qué NO cambia".
