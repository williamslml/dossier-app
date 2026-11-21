# Tasks — Pipeline de release (Fase 5)

**Aprobación humana obligatoria** (`CLAUDE.md`): ningún tag se crea/empuja y ninguna release se publica (se saca de borrador) sin tu aprobación explícita en el momento — ver proposal.md.

## 1. `electron-builder.yml` (R1)

- [x] Agregar el bloque `publish` (provider github, owner, repo)
- [x] Confirmar que `pnpm dist:win` local sigue funcionando igual que antes (sin `GH_TOKEN`, no intenta publicar nada) — verificado, instalador generado sin problema

## 2. `.github/workflows/release.yml` (R2)

- [x] Nuevo workflow, dispara con tags `v*`, `windows-latest` únicamente
- [x] Pasos: typecheck/lint/test (mismo criterio que `ci.yml`) → `electron-vite build` → `electron-builder --win` (build, sin publicar) → `gh release create` (ver el hallazgo abajo)
- [x] `permissions: contents: write` explícito

**Cuatro hallazgos reales, cada uno encontrado empujando un tag de prueba de verdad contra GitHub, nunca hipotético (ver requirements.md R2.6 para el detalle completo):**

1. `electron-builder` nombra la release con la versión de `package.json`, no con el tag real — sin corregirlo, creó una release "untagged" en vez de usar el tag empujado.
2. `--publish always` de `electron-builder` paraleliza la subida por artefacto, y cada uno puede decidir crear la release — con dos tags de prueba distintos se vieron **dos** releases creadas para el mismo run.
3. El fix inicial del punto 1 (`-c.extraMetadata.version=X`) falló en el runner real: el shell por default en `windows-latest` es PowerShell, no bash, y ahí ese flag se parseó distinto (`electron-builder` lo tomó como un path de config inexistente). Fix: escribir la versión directo en el `package.json` del checkout temporal con `npm pkg set` (funciona igual en PowerShell y en bash).
4. Quitar `--publish` del comando **no alcanza** — `electron-builder` loguea "Implicit publishing triggered by git tag" y publica solo cuando corre contra un tag de git con `GH_TOKEN` presente, aunque no se le pida (default que el propio `electron-builder` avisa que va a quitar en su v27). Sin `--publish never` explícito, se repitió la carrera del punto 2 incluso sin pedir publicar.

Fix final: `electron-builder --win --publish never` (nunca publica solo) + un paso aparte que crea la release y sube los tres artefactos (`.exe`, `.exe.blockmap`, `latest.yml`) con un solo `gh release create ... --draft`, atómico.

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
