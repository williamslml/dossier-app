# Tasks — Doctor

Señal de alto riesgo (resolución de identidad/`includeIf`, aunque de solo lectura): revisión obligatoria en sesión separada antes de mergear.

## 1. `core` (D1)

- [x] `runDoctor`/`DoctorCheck` en `core/features/doctor/doctor.ts`, exportados desde `core/index.ts`
- [x] Tests (7): identidad resuelta bien (con repo) · config local gana sobre `includeIf` (con detalle) · sin repo con perfil correcto · sin repo sin perfil · cuenta borrada · carpeta borrada del disco · sin carpetas fijadas

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

- [ ] Revisión en sesión separada (señal de alto riesgo)
- [ ] Merge con `finishing-a-development-branch`
- [ ] Mover la spec a `../archivados/`
