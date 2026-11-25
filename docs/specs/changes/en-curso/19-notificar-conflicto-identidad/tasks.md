# Tasks — Notificar un conflicto de identidad sin depender de la ventana

## 1. `core`: detección de archivos nuevos

- [x] `diffNewConflictFiles(known, current)` en `identity-guard.ts`
- [x] Tests puros (sin conocidos, uno ya conocido, sin nuevos, uno que reaparece)

## 2. `main`: vigilancia + notificación

- [x] `fs.watch` sobre `identity-conflicts/`, baseline de "ya conocidos" al arrancar, `notify()` por cada archivo nuevo, log de cada detección y de cada fallo
- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde

## 3. Verificación en vivo

- [x] `pnpm build` + Playwright `_electron` contra el binario real, **sin** `DOSSIER_SHOW_ON_START` (ventana oculta desde el arranque, confirmado "0 ventanas visibles") — un conflicto de prueba contra un `repoPath` ficticio disparó el log "conflicto de identidad detectado", confirmando que `notify()` se llamó sin que la ventana se mostrara
- [x] Conflicto de prueba limpiado (confirmado con un listado real de la carpeta, no solo inferido)

## 4. Cierre del change

- [ ] Revisión en sesión separada (señal de alto riesgo)
- [ ] Merge con `finishing-a-development-branch`
- [ ] Mover la spec a `../archivados/`
