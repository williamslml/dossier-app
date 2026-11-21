# 0001. Perfil de estructura de código: Fullstack, Etapa 1 (feature-first dentro de cada proceso)

## Status

Aceptado

## Context

El plan original del producto dejaba explícitamente pendiente "la estructura de carpetas y la organización del código... se deciden con la evaluación de arquitectura, no en este documento" (hoy `docs/product.md`). Ese mismo plan listaba los módulos lógicos (`core`, `main`, `preload`, `renderer`) como una tabla plana — eso describe los **procesos de Electron** (una convención real e innegociable del framework), no cómo organizar el código **dentro** de cada uno. Tomado literalmente como estructura final, sería justo el patrón que `project-structure.md` §0 prohíbe como primer nivel: carpetas por capa técnica en vez de por feature.

SFP (`project-structure.md` §3) exige decidir esto con su propio procedimiento, con evidencia real, no copiando esa tabla sin más.

## Decision

1. **Nivel superior — impuesto por el framework, no es una elección de perfil:** `src/main/`, `src/preload/`, `src/renderer/` (convención de `electron-vite`) + `core/` como paquete Node puro separado (regla explícita del producto: `core` nunca importa `electron`, ver `docs/adr/0003-stack-fundacional-y-sin-backend.md`).
2. **Perfil aplicado: Fullstack, Etapa 1.** Vía regla de desempate D3 de `project-structure.md` §3.1: front (`renderer`) y lógica de negocio (`core`, accedida por IPC en vez de HTTP) sin meta-framework, un solo desplegable (el `.exe` de Dossier). Etapa 1 porque `features_max=0` hoy y ninguna condición de Etapa 2 se cumple (el producto no proyecta ≥11 features ni despliegues separados, ver `docs/product.md`).
3. **Organización interna, feature-first (no por capa):**
   - `src/renderer/features/{principal,vincular-github,vincular-gitlab,etiqueta,quick-clone,carpetas-fijadas,ajustes}/` (pantallas de `docs/adr/0007-frontend.md`), con `shared/ui/` solo para lo reusado por 2+ features.
   - `core/features/{accounts,rules,git-credential,gitconfig,providers/github,providers/gitlab}/`, con `shared/` solo para errores/config transversales.
   - `src/main/` y `src/preload/` quedan delgados: wiring, IPC, bandeja — sin lógica de negocio propia (ya lo exige `docs/adr/0003-stack-fundacional-y-sin-backend.md`: "Main y tests usan exactamente el mismo código de `core`").

## Alternatives

- **Perfil `ninguno`** (no estructurar, dejar que emerja): descartada — ya hay evidencia real (el producto + convención de electron-vite) de la que partir; no aplicar el procedimiento sería ignorar información disponible.
- **Copiar literal la tabla `core`/`main`/`preload`/`renderer` del plan original como estructura final** (sin feature-first dentro de cada uno): descartada — viola la regla común de los 8 perfiles de SFP y dificultaría escalar `core`/`renderer` cuando crezcan.
- **Perfil Monorepo**: descartada — un solo deployable, sin `pnpm-workspace.yaml` ni manifiestos múltiples; no hay evidencia (`desplegables_estimados=0`) que lo justifique hoy.

## Consequences

- Cuando `core` o `renderer` crezcan (condición de Etapa 2 de cada perfil: un componente se repite en 3+ features, o reglas de negocio cruzan features), se re-evalúa con `project-structure.md` §3 paso 6 (modo Actualización), no se reestructura por impulso.
- `verify_command` quedó `PENDIENTE` hasta que existiera el scaffold real de `electron-vite` (Fase 0); se fijó ahí (`docs/adr/0002-target-electron-vite-para-electron-45.md`) y se registra en `.sfp/manifest.json`.
- Cualquier desviación de este ADR en una feature concreta debe justificarse en la spec de ese change, no solo en el código.

## References

- `docs/product.md` (visión, fases), `docs/adr/0003-stack-fundacional-y-sin-backend.md` (arquitectura de procesos), `docs/adr/0007-frontend.md` (pantallas)
- Skill `spec-first-protocol`, `references/project-structure.md` §3 (procedimiento) y §3.1 (regla D3)
- `.sfp/manifest.json` → `structure`
