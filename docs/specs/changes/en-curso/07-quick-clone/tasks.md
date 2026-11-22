# Tasks — Quick Clone

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de credenciales/GCM e `includeIf`. Revisión obligatoria en sesión separada, a partir de esta spec + diff, antes de mergear — no del historial de la sesión que implementó.

## 1. `core/features/clone/` — validación + clone (Q1, Q2) — TDD

- [x] RED/GREEN: `validateCloneUrl` — tabla de casos válidos/inválidos (Q2.1/Q2.2)
- [x] RED/GREEN: `cloneRepo` — test de integración real (sin mockear Git). **Decisión tomada al implementar:** contra un repo bare _local_ (no github.com) — prueba la mecánica real del clone (incluido el `-c credential.*`) sin depender de la red, mismo criterio que el resto de la suite (nunca una API remota real en los tests automatizados; sí se probó contra github.com real en la verificación en vivo, sección 6)
- [x] Wire en `core/index.ts`

## 2. `core/features/rules/` — chequeo de solapamiento reusable (Q5)

- [x] RED/GREEN: `findOverlap` extraída de `pin()` (antes vivía privada) — `pin()` la usa internamente, los 13 tests existentes de `rules.test.ts` siguen pasando sin cambios
- [x] Wire en `core/index.ts`

## 3. IPC y preload (Q6)

- [x] Canal `IPC.cloneRepo` en `src/shared/ipc-channels.ts`
- [x] Handler `IPC.cloneRepo` en `main` (orden exacto: cuenta → validar URL → chequear solapamiento → clonar → Auto-Pin, ver design.md)
- [x] `cloneRepo` en `src/preload/index.ts`

**Hallazgo al implementar, corregido:** se armó primero un evento `cloneProgress` siguiendo el patrón de `githubVerification`, pero quedó sin ningún consumidor — a diferencia del Device Flow, acá todo el trabajo ocurre dentro de una sola llamada esperada de punta a punta, el `invoke` ya le dice al renderer cuándo empieza/termina/falla. Se sacó el evento (canal, handler, preload) en vez de dejarlo sin usar — ver requirements.md Q6.1.

## 4. `CloneDialog.tsx` (renderer) (Q3)

- [x] Componente nuevo, mismo patrón visual que `GithubLinkDialog.tsx`
- [x] Filtro de cuentas por host de la URL (Q3.2/Q3.3)
- [x] Estados clonando/listo/error (Q3.4/Q3.5/Q3.6), reusa `showToast`
- [x] `store.ts`: función `cloneRepo` que invoca el IPC y recarga `$pins`

## 5. Habilitar el botón (Q7)

- [x] `AddButtons.tsx`: saca `disabled`/el tooltip "Próximamente", conecta `CloneDialog`

## 6. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` en verde (118 tests)
- [x] Verificación en vivo (CDP/DOM): diálogo abre, campos en el orden correcto; filtro de cuentas por host confirmado con tres casos (host con una cuenta, sin ninguna cuenta, cambio de URL)
- [x] Verificación en vivo con un repo real (`https://github.com/octocat/Hello-World.git`, a través de todo el camino de IPC, no solo `core`): clonado real hacia una carpeta temporal vacía, confirmado con `git remote -v`/`git log` reales; quedó fijado a la cuenta elegida (`enforced: false`). Clonar hacia una subcarpeta de esa misma carpeta se rechazó con `FolderOverlapError` antes de tocar la red; una URL `ssh://` se rechazó antes de llegar a Git. Carpeta y regla limpiadas después.

## 7. Revisión en sesión separada (señal de alto riesgo)

**Hecha** — agente sin el historial de esta sesión, a partir de spec + diff. Tres hallazgos importantes, todos corregidos (ver requirements.md Q8 para el detalle completo):

- [x] Q8.1: `cloneRepo` no desactivaba la interactividad de Git/GCM (confirmado real: un test se colgó 20s sin el fix) — agregado `GIT_TERMINAL_PROMPT=0` + `credential.interactive=false` + `credential.guiPrompt=false` + timeout de bloqueo
- [x] Q8.2: el handler no validaba que la cuenta coincidiera con el host de la URL — agregado el chequeo
- [x] Q8.3: `validateCloneUrl` no rechazaba URLs con credenciales embebidas (`user:pass@host`) — agregado el rechazo
- [x] Q8.4 (menor): `CloneDialog` perdía el error si se cerraba mientras clonaba — ahora no se puede cerrar hasta que termine
- [x] Q8.5 (menor): comparación de host sensible a mayúsculas/minúsculas — normalizada
- [x] Re-verificado en vivo tras los fixes: el flujo completo (clonar, rechazo de solapamiento, rechazo de URL inválida) sigue funcionando igual

## 8. Cierre del change

- [x] Criterio de éxito de `proposal.md` verificado:
  - Clonar un repo público real por HTTPS con cuenta + carpeta vacía: **verificado en vivo** (sección 6) con `octocat/Hello-World.git`, confirmado con `git remote -v`/`git log` reales, carpeta fijada a la cuenta elegida.
  - Carpeta ya fijada a otra cuenta: **verificado en vivo**, rechazado con `FolderOverlapError` antes de tocar la red.
  - URL no-`https://` (`ssh://`, ruta local): **verificado en vivo**, rechazado antes de llegar a Git.
  - Cuenta con credencial inválida en GCM: **confirmado por inspección del código real** (no repetido en vivo, mismo camino de error que los dos casos de arriba) — en el handler de `main`, `await cloneRepo(...)` corre antes que `rulesStore.pin(...)`; si `cloneRepo` lanza (incluido un error de autenticación real de Git), la excepción se propaga tal cual por IPC y `pin()` nunca se ejecuta, igual que en los casos de solapamiento/URL inválida ya probados.
  - `pnpm typecheck && pnpm lint && pnpm test`: **en verde** (122 tests, ver sección 6).
- [x] Lecciones anotadas en `docs/lessons/README.md`: `GIT_TERMINAL_PROMPT=0` solo no alcanza (hace falta el resto de ADR 0004), el quirk de `allowUnsafeEditor` de simple-git, y la condición de carrera entre el chequeo de solapamiento y el Auto-Pin quedó documentada como limitación conocida en requirements.md Q8 (no en lessons — no es un hallazgo "no obvio" sino una decisión de alcance explícita)
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
