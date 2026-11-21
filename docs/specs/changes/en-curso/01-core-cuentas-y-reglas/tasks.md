# Tasks — Fase 1: módulo `core`

Sin señales de alto riesgo en este change (no toca credenciales reales ni red): ningún ítem necesita `[⚠APROBACIÓN]`.

## 1. Migración (M1)

- [x] Crear `core/features/git-credential/git-credential.ts` (copiado de `spike/`, sin cambios de comportamiento) + mover su test
- [x] Crear `core/features/gitconfig/gitconfig.ts` (copiado de `spike/includeif.ts`, renombrado archivo) + mover su test — re-confirmado contra GCM real tras el movimiento, mismo resultado
- [x] Regla de ESLint: prohibir `import ... from 'electron'` dentro de `core/**` — verificado que dispara con un archivo de prueba descartado
- [x] `core/index.ts`: único punto de entrada, re-exporta lo público de cada feature
- [x] Confirmar `pnpm test`/`typecheck`/`lint` en verde tras la migración

## 2. Cuentas (M2) — TDD

- [x] RED: test de `create`+`list` (M2.1–M2.2) — confirmado, fallaba por módulo inexistente
- [x] GREEN: `accounts.ts` implementado
- [x] `rename` (M2.3), incluido el caso de id inexistente (lanza)
- [x] `remove` idempotente (M2.4)
- [x] Persistencia real con `conf` en directorio temporal, releída con una instancia nueva (M2.5)
- [x] `Account` sin ningún campo de secreto — revisado el tipo, no solo el test

**6/6 tests en verde** (`accounts.test.ts`).

## 3. Reglas de carpeta (M3) — TDD

- [x] RED: confirmado, módulo inexistente
- [x] `pin` simple (M3.1)
- [x] Re-fijar mismo path reemplaza (M3.2)
- [x] Fijar carpeta anidada a una ya fijada se rechaza, en ambos sentidos (M3.3) — `FolderOverlapError` con los dos casos (`a/sub` dentro de `a`, y `a` conteniendo `a/sub`)
- [x] `unpin` (M3.4), idempotente si no existía
- [x] Persistencia con `conf` (M3.5)

**8/8 tests en verde** (`rules.test.ts`), verde a la primera corrida tras la implementación.

## 4. Cierre del change

- [x] Los 3 criterios (M1–M3) verificados: **22/22 tests en verde** en toda la suite (`gitconfig` 4, `git-credential` 3 —incluye GCM real—, `accounts` 6, `rules` 8, `sanity` 1)
- [x] `spike/` limpiado: `git-credential.ts`/`includeif.ts` migrados y borrados de ahí; `electron-target/` también borrado (su único propósito, R6, ya quedó resuelto y documentado en ADR 0002 — mantenerlo solo agregaría ruido). Actualizado `tasks.md` del change `00` reflejándolo
- [x] Lección anotada en `../../../lessons/` (quirks de TypeScript estricto con `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` y la librería `conf`)
- [ ] Mover esta carpeta a `../archivados/` — pendiente de tu confirmación antes de archivar (no lo hago sin pedirlo)
