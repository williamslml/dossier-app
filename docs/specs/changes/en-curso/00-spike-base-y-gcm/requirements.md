# Requirements — Spike: base del proyecto + GCM + includeIf

Requisitos con escenarios verificables. Cada escenario debe poder comprobarse con un comando real (`git config --get ...`, `git credential fill`, salida de CI), no "a ojo".

## R1 — Base del repositorio

- **R1.1** El repo usa `pnpm` 12 con `packageManager` fijado en `package.json`.
- **R1.2** TypeScript en modo estricto (`strict: true` y afines) compila sin errores sobre un proyecto vacío.
- **R1.3** Vitest corre al menos un test trivial (`it('suma', ...)`) con `pnpm test`.
- **R1.4** ESLint + Prettier corren sin errores sobre el código base inicial.

**Escenario verificable:** `pnpm install && pnpm typecheck && pnpm test && pnpm lint` termina en 0 en una máquina Windows limpia (o la más cercana disponible).

## R2 — CI en tres sistemas (solo tests)

- **R2.1** Un workflow de GitHub Actions corre en matriz Windows + macOS + Linux.
- **R2.2** El workflow ejecuta lint, typecheck y tests; no genera artefactos de instalación para ningún sistema.
- **R2.3** Un PR de prueba con una ruta mal escrita (ej. `\` literal en vez de `path.join`) falla la CI en al menos un sistema no-Windows.

**Escenario verificable:** abrir un PR de prueba, ver el workflow correr en los tres sistemas y fallar/pasar según corresponda.

## R3 — GCM guarda y recupera tokens por cuenta (núcleo del spike)

- **R3.1** `git credential approve` con `protocol=https`, `host=github.com`, `username=cuenta-A`, `password=token-A` guarda el token sin error.
- **R3.2** Lo mismo para `username=cuenta-B`, `password=token-B`, mismo host.
- **R3.3** `git credential fill` con `username=cuenta-A` devuelve `password=token-A` (no `token-B`).
- **R3.4** `git credential fill` con `username=cuenta-B` devuelve `password=token-B` (no `token-A`).
- **R3.5** Todas las llamadas se ejecutan con `GIT_TERMINAL_PROMPT=0`, `credential.interactive=false`, `credential.guiPrompt=false` y un timeout explícito; ninguna deja un prompt colgado.
- **R3.6** `git credential reject` borra la credencial de una cuenta sin afectar a la otra (verificado con un `fill` posterior que ya no devuelve el token borrado).

**Escenario verificable:** script/test de integración que ejecuta la secuencia approve(A) → approve(B) → fill(A)==token-A → fill(B)==token-B → reject(A) → fill(A) no devuelve token-A.

## R4 — `includeIf` resuelve identidad y cuenta por carpeta

- **R4.1** Una carpeta de prueba con `includeIf "gitdir/i:<ruta>/"` apuntando a un `profiles/<id>.gitconfig` hace que, **dentro de esa carpeta**, `git config --get user.email` devuelva el email de esa cuenta y no el global.
- **R4.2** La misma carpeta, `git config --get credential.<host>.username` devuelve el `username` de esa cuenta.
- **R4.3** Dos carpetas distintas, cada una con su propio `includeIf`, devuelven cada una su propia identidad/cuenta sin interferirse.
- **R4.4** Una carpeta **sin** `includeIf` (fuera de cualquier pin) conserva el comportamiento global previo del usuario.
- **R4.5** `credential.<host>.useHttpPath=false` queda fijado en los hosts gestionados.

**Escenario verificable:** crear 2 carpetas temporales con repos git inicializados, aplicar 2 bloques `includeIf` distintos al config global de prueba (nunca al config global real del usuario), y comprobar `git config --get` dentro de cada una.

## R5 — No se usa el config global real del usuario para las pruebas

- **R5.1** Todas las pruebas de R3/R4 corren contra un `HOME`/`GIT_CONFIG_GLOBAL` de prueba aislado (variable de entorno o `--global` apuntando a un archivo temporal), nunca contra `~/.gitconfig` real ni contra el Credential Manager real del usuario fuera de un entorno de prueba aislado.

**Escenario verificable:** inspeccionar el script del spike y confirmar que usa `GIT_CONFIG_GLOBAL`/`HOME` apuntando a una ruta temporal antes de cualquier `git credential approve` o escritura de `includeIf`.

## R6 — Target de `electron-vite` 6 fijado y verificado

- **R6.1** Un proyecto mínimo de Electron 45 + `electron-vite` 6 + `@preact/preset-vite` compila con `target: node24.22 / chrome156` fijado explícitamente en la config.
- **R6.2** El build produce un ejecutable que arranca (ventana vacía basta) en Windows.

**Escenario verificable:** `pnpm build` + arrancar el `.exe`/`electron .` resultante sin error de target.

## Fuera de alcance de este change (no se escribe ningún requisito para esto aquí)

Lógica de negocio (`core`), proveedores OAuth/PAT, UI real, empaquetado/firma — ver `proposal.md` §"Qué NO cambia".
