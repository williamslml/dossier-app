# Tasks — Spike: base del proyecto + GCM + includeIf

Checklist, unidad de trabajo de este change. Estado compartido entre sesiones (sin orquestador): marcar aquí, no en el chat. `[⚠APROBACIÓN]` = toca la señal de alto riesgo "flujo de git credential/GCM/includeIf" (`CLAUDE.md`): parar y pedir tu aprobación explícita antes de ejecutar ese paso, no solo al final.

## 1. Base del repositorio (R1)

- [x] Prerrequisito: confirmar versión de Git instalada soporta `GIT_CONFIG_GLOBAL` (Git ≥ 2.32) y que el helper activo incluye `manager`/`manager-core` (`git config --get-all credential.helper`) — Git 2.52, `credential.helper=manager` confirmado
- [x] `package.json` con `packageManager: pnpm@12.x` fijado — `pnpm@12.21.0` (docs/product.md §6)
- [x] `tsconfig.json` en modo estricto
- [x] `vitest.config.ts` + test trivial pasando — `spike/sanity.test.ts`
- [x] ESLint + Prettier configurados, sin errores sobre el árbol inicial — alcance restringido a `core/`+`spike/` (excluye `.claude/`, `.agents/`, `.sfp/`, `docs/` de terceros/no-código)

## 2. CI en tres sistemas (R2)

- [x] `.github/workflows/ci.yml`: matriz Windows + macOS + Linux, pasos lint/typecheck/test, sin paso de build de instalador
- [x] El test de GCM (R3) usa `describe.skipIf(!isWindows)`: se salta solo en macOS/Linux, no se fuerza a pasar (diseño confirmado en el código, `git-credential.spike.test.ts`)
- [x] Confirmar en una corrida real de GitHub Actions — **hecho**: repo privado creado (`github.com/williamslml/dossier-app`), CI corrió en los 3 sistemas. Primera corrida (44870359780) **falló** en Windows y macOS: encontró un bug real (ver abajo), no un problema de la CI
- [x] "Detecta rutas mal escritas en un sistema no-Windows" — la CI ya lo demostró por sí sola, con un caso más interesante que el previsto: encontró que `includeIf` no resolvía la ruta real en macOS (symlink) ni en Windows (alias 8.3), corregido con `realpathSync.native` (ver `lessons/README.md`); confirmado en verde en los 3 sistemas en la corrida 44871350217

## 3. Helper de protocolo `git credential` (R3, diseño en `design.md`)

- [x] Implementar `spike/git-credential.ts` (`approve`/`fill`/`reject` vía `child_process`, env no interactivo, timeout) — typecheck/lint en verde
- [x] `[⚠APROBACIÓN]` Ejecutar por primera vez `approve` con un usuario/token **de prueba** contra el GCM real de esta máquina Windows — **aprobado por el usuario y ejecutado**. Hipótesis crítica **confirmada**: dos cuentas, mismo host, tokens distintos, sin red (ver `lessons/README.md`)
- [x] Verificar `fill(A)` devuelve `token-A` y `fill(B)` devuelve `token-B` (R3.3–R3.4) — confirmado, 3/3 tests en verde
- [x] `[⚠APROBACIÓN]` Verificar `reject` limpia correctamente — confirmado (`cmdkey /list` sin residuos antes y después); hallazgo real documentado: sin credencial cacheada, `fill` hace un _probe_ de red al proveedor en vez de devolver vacío (ver `lessons/README.md`)

## 4. `includeIf` por carpeta (R4)

- [x] Implementar `spike/includeif.ts` (`simple-git` + `git config --file`)
- [x] Test: 2 carpetas temporales, 2 perfiles distintos, `git config --get user.email`/`credential.<host>.username` correctos en cada una (R4.1–R4.3) — `includeif.spike.test.ts`, 4/4 verde
- [x] Test: carpeta sin `includeIf` conserva comportamiento global previo (R4.4)
- [ ] Confirmar `useHttpPath=false` queda fijado (R4.5) — diferido: este spike solo probó `user.*`/`credential.*.username`; `useHttpPath` se agrega cuando `core` escriba el perfil completo (Fase 1), no es necesario para validar el mecanismo de `includeIf` en sí

## 5. Aislamiento del entorno de pruebas (R5 — antes de ejecutar 3 y 4 en real)

- [x] Confirmar que ningún test apunta a `~/.gitconfig` real: todos usan `GIT_CONFIG_GLOBAL` temporal (R4); R3 usa host `.invalid` + tokens de prueba, nunca cuentas reales
- [x] `[⚠APROBACIÓN]` Confirmar contigo el usuario/host de prueba a usar en R3 antes de la primera corrida contra GCM real — aprobado; ejecutado con `sfp-spike-test-{a,b}-<uuid>` sobre `sfp-spike-test.invalid`; limpieza verificada con `cmdkey /list`

## 6. Target `electron-vite` (R6, independiente)

- [x] Scaffold mínimo en `spike/electron-target/` (proyecto standalone propio, `package.json` separado — `@preact/preset-vite` + Preact, sin plantilla oficial de Preact como ya anotaba `design.md`)
- [x] Fijar `target: node24.22 / chrome156` — en las 3 secciones (`main`/`preload`/`renderer`) de `electron.vite.config.ts`, a mano (el mapa interno de electron-vite 6 no llega a Electron 45)
- [x] `pnpm build` + arranque manual del ejecutable sin error — Electron 45.4.1 real, `electron-vite` 6.0.0, `@preact/preset-vite` 2.10.6 (versiones exactas del docs/product.md §6). Build limpio, arranque con `R6_SPIKE_AUTO_QUIT=1`: `R6-SPIKE-OK: renderer cargó sin error`, `exit=0`. 2 hallazgos no obvios → `lessons/README.md`

## 7. Cierre del change

- [x] Los 6 criterios de éxito de `requirements.md` verificados y anotados: R1/R3/R4/R6 verificados en verde; R2 verificado salvo la corrida real en GitHub Actions (bloqueado, sin git); R4.5 (`useHttpPath`) diferido a propósito a Fase 1
- [x] Decisión abierta docs/product.md §14.5 (target electron-vite) resuelta → **ADR 0002** (`node24.22`/`chrome156` fijado a mano)
- [ ] Decisión abierta docs/product.md §14.6 (spike GCM) **parcialmente resuelta**: el mecanismo `approve`→`fill` por `username` quedó confirmado (sin red, con tokens de prueba). La sub-pregunta "¿GitHub exige `x-access-token`?" sigue abierta — necesita un token OAuth real de GitHub, que no existe hasta el Device Flow de la Fase 2; no se puede cerrar en este change sin inventar un token
- [x] Hallazgos no obvios anotados en `../../../lessons/README.md` (4 lecciones: normalización de rutas en `includeIf`, opciones de `simple-git`, _probe_ de red de GCM en `fill`, target/preload de `electron-vite`)
- [ ] Mover esta carpeta a `../archivados/` — **no todavía**: quedan 2 ítems legítimamente abiertos arriba (CI real, `x-access-token`), no es un cierre completo; se archiva cuando ambos se resuelvan o el usuario decida archivarlo igual con esos pendientes trasladados a la Fase 1/2
- [x] `spike/` se borra o se migra a `core/` — **hecho** al empezar la Fase 1 (change `01-core-cuentas-y-reglas`): `git-credential.ts`/`includeif.ts` migrados a `core/features/`, `electron-target/` borrado (su propósito ya quedó resuelto en ADR 0002). Solo queda `spike/sanity.test.ts` (R1.3, sigue siendo válido)

---

**Antes de empezar a implementar:** este `tasks.md` + `proposal.md`/`requirements.md`/`design.md` son la spec aprobada. Si al implementar aparece algo que contradice el diseño (ej. GCM no soporta lo esperado), parar y volver aquí antes de seguir — no parchear en silencio.
