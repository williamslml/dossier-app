# Proposal — Spike: base del proyecto + GCM + includeIf

## Por qué

El producto se construye entero, sin MVP (docs/product.md §7), y toda su arquitectura (§3–4) descansa en una hipótesis todavía sin verificar en Windows real: que **Git Credential Manager** soporta varias cuentas del mismo host vía `credential.<host>.username` con `git credential approve/fill/reject`, y que `includeIf` resuelve identidad + cuenta HTTPS por carpeta de forma fiable. docs/product.md §4.6 lo marca explícitamente **[verificar en spike]**. Si esta hipótesis falla o se comporta distinto a lo documentado, hay que replantear la arquitectura antes de escribir una sola pantalla o línea de lógica de negocio.

Esta es además la Fase 0 del docs/product.md (§12): "Base del proyecto + GCM + `includeIf`".

## Qué cambia

1. Base del repositorio: gestor de paquetes `pnpm` 12, TypeScript estricto, Vitest, lint/format (ESLint + Prettier) — docs/product.md §6/§9.
2. CI en GitHub Actions con matriz Windows + macOS + Linux, **solo tests** (detecta rutas mal escritas aunque solo se publique para Windows) — docs/product.md §10.
3. Spike reproducible (test de integración con Vitest, git real en carpetas temporales) que verifica GCM + `includeIf` en Windows real — no en modo dev de Electron.
4. Verificación del build mínimo de `electron-vite` 6 con Electron 45, fijando `target: node24.22 / chrome156` (decisión abierta docs/product.md §14.5).

## Qué NO cambia / queda fuera de este change

- Ninguna pantalla ni lógica de negocio real (eso empieza en la Fase 1 — módulo `core`).
- Flujo OAuth Device Flow de GitHub o PAT de GitLab (Fase 2).
- `electron-builder`/`electron-updater`, firma, releases (Fase 5).
- Nombre final de marca (`appId`/`dataDir`) — docs/product.md §2.1 solo exige fijarlo antes de la primera release, no antes del spike.
- Estructura de carpetas de `src/` (perfil de `project-structure.md`): se decide cuando exista el scaffold real de `electron-vite`, en este mismo change, en `design.md`, pero sin aplicar el perfil completo de features todavía — eso empieza con código real en Fase 1.

## Criterio de éxito (docs/product.md §12, Fase 0 — literal)

> `approve` guarda A y B, `fill` devuelve el token correcto según `credential.<host>.username`, y Git resuelve identidad/cuenta por carpeta en Windows.

## Riesgos que este spike existe para descartar (docs/product.md §13)

- GCM no instalado, o cadena de `credential.helper` con un helper ajeno por delante.
- `useHttpPath=true` previo en la configuración del usuario rompe la selección por cuenta.
- `git credential approve` sale con código 0 sin haber guardado realmente el token (pérdida silenciosa).
- Un prompt interactivo se queda colgado y bloquea el flujo.
- Configuración local del repo de prueba gana sobre `includeIf` por orden de aplicación.
- GitHub exige `x-access-token` como username en vez del login real (afectaría también a Quick Clone más adelante).

## Aprobación humana

Este change toca la señal de alto riesgo "flujo de `git credential`/GCM/`includeIf`" (`CLAUDE.md`): cualquier paso que escriba o borre credenciales reales en el almacén de Windows requiere tu aprobación explícita antes de ejecutarse, aparte de la revisión normal del código. Ver `tasks.md` para los puntos exactos marcados.
