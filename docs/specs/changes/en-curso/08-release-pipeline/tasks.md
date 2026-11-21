# Tasks — Pipeline de release (Fase 5)

**Aprobación humana obligatoria** (`CLAUDE.md`): ningún tag se crea/empuja y ninguna release se publica (se saca de borrador) sin tu aprobación explícita en el momento — ver proposal.md.

## 1. `electron-builder.yml` (R1)

- [ ] Agregar el bloque `publish` (provider github, owner, repo)
- [ ] Confirmar que `pnpm dist:win` local sigue funcionando igual que antes (sin `GH_TOKEN`, no intenta publicar nada)

## 2. `.github/workflows/release.yml` (R2)

- [ ] Nuevo workflow, dispara con tags `v*`, `windows-latest` únicamente
- [ ] Pasos: typecheck/lint/test (mismo criterio que `ci.yml`) → `electron-vite build` → `electron-builder --win --publish always`
- [ ] `permissions: contents: write` explícito

## 3. `electron-updater` (R3)

- [ ] Agregar la dependencia
- [ ] Wire en `src/main/index.ts`: `checkForUpdates()` al iniciar, `autoInstallOnAppQuit = false`
- [ ] `update-downloaded`: notifica + marca `updateReadyToInstall`
- [ ] El callback global ya existente de clic en notificaciones revisa esa marca antes de decidir mostrar la ventana o instalar (ver design.md — hallazgo real sobre `Notification.handleActivation`)
- [ ] `error`: solo logueo, nunca interrumpe el arranque

## 4. Verificación

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` en verde
- [ ] `pnpm dist:win` local sigue generando un instalador funcional (repetir la prueba ya hecha en una sesión anterior, confirmando que agregar `publish` no la rompió)
- [ ] **Con tu aprobación explícita en el momento:** empujar un tag de prueba y confirmar que `release.yml` corre y deja una release en **borrador** con el instalador adjunto
- [ ] **Con tu aprobación explícita en el momento:** publicar esa release de prueba manualmente desde GitHub, y confirmar que una instancia local con una versión vieja detecta la actualización, la descarga, y espera el clic antes de instalar

## 5. Cierre del change

- [ ] Criterio de éxito de `proposal.md` verificado y anotado acá
- [ ] Lecciones anotadas en `docs/lessons/README.md` si algo no obvio ocurrió
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
