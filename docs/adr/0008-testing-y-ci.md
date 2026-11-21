# 0008. Estrategia de testing y CI/CD

## Status

Aceptado (CI base ya implementada en la Fase 0; el resto se activa por fase)

## Context

El producto maneja credenciales y corre solo en Windows, pero el código debe seguir siendo multiplataforma (`docs/product.md` §1) — había que decidir qué se prueba, con qué herramienta, y cómo la CI detecta errores de portabilidad sin publicar nada fuera de Windows.

## Decision

**Tests (Vitest).**

- Unitarios: generación y parseo de la región de `includeIf`, prioridad/orden de reglas, solapamientos, validación de URLs, contrato IPC. **Implementado** para `includeIf`/reglas en `core/features/gitconfig`, `core/features/rules` (Fase 1); IPC pendiente de Fase 3.
- Integración: git real en carpetas temporales; `git config --get user.email` y `git config --get credential.<host>.username` dentro de una carpeta fijada; `git credential approve/fill/reject` con GCM en Windows. **Implementado**, `core/features/git-credential`, `core/features/gitconfig`.
- Caso Windows: dos cuentas en el mismo host devuelven tokens distintos según `credential.<host>.username`. **Implementado y confirmado contra GCM real.**

**E2E (Playwright).** Bandeja, ventana 390×620, primer estado vacío, vinculación y cambio de cuenta. Las notificaciones nativas y `AppUserModelID` se validan manualmente en el spike NSIS (decisión abierta, `docs/product.md` §7.4). Pendiente de Fase 3 (no hay UI todavía).

**CI (GitHub Actions, gratis en repos públicos).**

- Matriz Windows + macOS + Linux en **tests únicamente**: detecta rutas mal escritas, aunque solo se publique para Windows. No genera artefactos de release para macOS ni Linux. **Implementado** (`.github/workflows/ci.yml`, Fase 0); el test de GCM se salta en macOS/Linux con `describe.skipIf`, no se fuerza a pasar.
- Lint, typecheck y tests en cada PR. **Implementado**; pendiente confirmar en una corrida real (bloqueado: el repo todavía no tiene git iniciado).

**Release.** Un tag dispara `electron-builder`, que publica el instalador en GitHub Releases. `electron-updater` consume esas Releases. Pendiente de Fase 5.

## Alternatives

Ninguna evaluada aparte de Vitest/Playwright — son las herramientas ya elegidas en ADR 0003 (ecosistema Vite/Vitest coherente con `electron-vite`).

## Consequences

- Mientras no haya CI real corriendo (sin git iniciado), la matriz de 3 sistemas solo se verifica localmente en Windows — riesgo anotado en `docs/product.md` §6 y en los `tasks.md` de los changes activos.
- Cualquier test que dependa de GCM real queda marcado como señal de alto riesgo por `CLAUDE.md`: necesita aprobación explícita antes de ejecutarse, no solo antes de mergear.

## References

- `.github/workflows/ci.yml`
- `docs/specs/changes/archivados/00-spike-base-y-gcm/` (R1–R6, de donde salió esta CI)
- `CLAUDE.md` (aprobación humana obligatoria)
