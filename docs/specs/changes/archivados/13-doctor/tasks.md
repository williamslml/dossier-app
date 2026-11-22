# Tasks — Doctor

Señal de alto riesgo (resolución de identidad/`includeIf`, aunque de solo lectura): revisión obligatoria en sesión separada antes de mergear.

## 1. `core` (D1)

- [x] `runDoctor`/`DoctorCheck` en `core/features/doctor/doctor.ts`, exportados desde `core/index.ts`
- [x] Tests (8): identidad resuelta bien (con repo) · config local gana sobre `includeIf` (con detalle) · desajuste solo en `credential.<host>.username` (con detalle correcto, sin mencionar `user.email`) · sin repo con perfil correcto · sin repo sin perfil · cuenta borrada · carpeta borrada del disco · sin carpetas fijadas

## 2. IPC (D2)

- [x] `runDoctor` en `ipc-channels.ts`, handler en `main/index.ts`, preload

## 3. Renderer (D3)

- [x] `store.ts`: `$doctorChecks`, `$doctorLoading`, `runDoctorCheck`
- [x] `Ajustes.tsx`: sección "Doctor" (carga sola, botón "Verificar de nuevo", estado vacío, ✓/✗ + detalle)
- [x] CSS: `.doctor-header`/`.doctor-recheck`/`.doctor-empty`/`.doctor-detail`/`.doctor-icon-ok`/`.doctor-icon-error`

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (18 archivos, 123 tests)
- [x] `pnpm electron-vite build` + verificación en vivo con Playwright (`_electron`), de solo lectura: esta máquina no tiene ninguna carpeta fijada todavía (`listPins()` real = `[]`), así que `runDoctor()` real devuelve `[]` — confirma D1.6 contra el estado real, y la sección "Doctor" en Ajustes muestra correctamente "No hay carpetas fijadas todavía." (sin errores de consola, captura de pantalla + color computado confirmados). Los casos con carpeta fijada (con/sin repo, cuenta borrada, config local ganando a `includeIf`) quedan cubiertos por los 7 tests de integración con Git real — no se pinearon carpetas reales en esta máquina para no tocar el `.gitconfig`/`rules.json` reales solo para la demo

## 5. Cierre del change

- [x] Revisión en sesión separada (señal de alto riesgo) — sin hallazgos de seguridad. Confirmó (corriendo typecheck/lint/test ella misma) que `runDoctor`/`checkRule`/`readConfigValue` nunca escriben nada, que los tres casos de riesgo (cuenta borrada, carpeta borrada, clave de config ausente) no lanzan, que la distinción con/sin repo tiene sentido y cubre bien el caso de worktree (`existsSync` no distingue archivo de carpeta), y que los 7 tests originales usan Git real aislado (nunca `~/.gitconfig`/`~/.dossier` reales). Un hallazgo bloqueante de corrección (no de seguridad): cuando el desajuste era solo en `credential.<host>.username` (el email sí coincidía), el `detail` igual mostraba el mismo `user.email` a los dos lados del mensaje — contradictorio, y ningún test cubría ese caso. Corregido: el mensaje ahora arma una lista de los campos que de verdad no coinciden (`user.email` y/o `credential.<host>.username`, cada uno con su propio valor esperado/encontrado), y se agregó el test que faltaba (8vo test)
- [x] Merge con `finishing-a-development-branch` — mergeado localmente a `main` (fast-forward, sin conflictos, incluye el fix de la revisión), `pnpm typecheck && pnpm lint && pnpm test` en verde sobre el resultado (124 tests), rama `feat/doctor` borrada
- [x] Mover la spec a `../archivados/`
