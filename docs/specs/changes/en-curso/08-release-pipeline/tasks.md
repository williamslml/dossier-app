# Tasks — Pipeline de release (Fase 5)

**Aprobación humana obligatoria** (`CLAUDE.md`): ningún tag se crea/empuja y ninguna release se publica (se saca de borrador) sin tu aprobación explícita en el momento — ver proposal.md.

## 1. `electron-builder.yml` (R1)

- [x] Agregar el bloque `publish` (provider github, owner, repo)
- [x] Confirmar que `pnpm dist:win` local sigue funcionando igual que antes (sin `GH_TOKEN`, no intenta publicar nada) — verificado, instalador generado sin problema

## 2. `.github/workflows/release.yml` (R2)

- [x] Nuevo workflow, dispara con tags `v*`, `windows-latest` únicamente
- [x] Pasos: typecheck/lint/test (mismo criterio que `ci.yml`) → `electron-vite build` → `electron-builder --win --publish always`
- [x] `permissions: contents: write` explícito

## 3. `electron-updater` (R3)

- [x] Agregar la dependencia
- [x] Wire en `src/main/index.ts`: `checkForUpdates()` al iniciar, `autoInstallOnAppQuit = false`
- [x] `update-downloaded`: notifica + marca `updateReadyToInstall`
- [x] El callback global ya existente de clic en notificaciones revisa esa marca antes de decidir mostrar la ventana o instalar (ver design.md — hallazgo real sobre `Notification.handleActivation`)
- [x] `error`: solo logueo, nunca interrumpe el arranque

**Hallazgo real, encontrado al probar en vivo (no lo detectó `tsc`):** `import { autoUpdater } from 'electron-updater'` compila pero falla en tiempo de ejecución — `electron-updater` es CommonJS puro, bajo ESM solo expone un default export. Fix: `import electronUpdaterPkg from 'electron-updater'; const { autoUpdater } = electronUpdaterPkg`.

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` en verde (105 tests — esta rama no tiene Quick Clone, que vive aparte en `feat/quick-clone`)
- [x] `pnpm dist:win` local sigue generando un instalador funcional
- [x] Verificado en vivo: la app arranca normal con `electron-updater` wireado — en modo desarrollo (sin empaquetar), la propia librería salta el chequeo sola ("Skip checkForUpdates because application is not packed"), sin romper nada
- [ ] **Con tu aprobación explícita en el momento:** empujar un tag de prueba y confirmar que `release.yml` corre y deja una release en **borrador** con el instalador adjunto
- [ ] **Con tu aprobación explícita en el momento:** publicar esa release de prueba manualmente desde GitHub, y confirmar que una instancia local con una versión vieja detecta la actualización, la descarga, y espera el clic antes de instalar

## 5. Cierre del change

- [ ] Criterio de éxito de `proposal.md` verificado y anotado acá
- [ ] Lecciones anotadas en `docs/lessons/README.md` si algo no obvio ocurrió
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
