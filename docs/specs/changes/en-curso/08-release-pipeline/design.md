# Design — Pipeline de release (Fase 5)

Ver `proposal.md`/`requirements.md` para el porqué y los requisitos. Acá, el enfoque técnico.

## R1 — `electron-builder.yml`

```yaml
appId: com.dossier.app
productName: Dossier
directories:
  output: release
files:
  - out/**/*
electronFuses:
  runAsNode: false
  enableNodeOptionsEnvironmentVariable: false
  enableNodeCliInspectArguments: false
  enableEmbeddedAsarIntegrityValidation: true
  onlyLoadAppFromAsar: true
win:
  target: nsis
  icon: resources/app-icon.ico
publish:
  provider: github
  owner: williamslml
  repo: dossier-app
```

Solo se agrega el bloque `publish` — el resto ya existía (probado en una sesión anterior, `pnpm dist:win` generó un instalador sin firmar funcional).

## R2 — `.github/workflows/release.yml`

```yaml
name: Release

# Fase 5 (docs/product.md §5): dispara con un tag v*, nunca con un push a
# una rama. Deja la release en GitHub como borrador (default de
# electron-builder, ver requirements.md R1.2) - publicarla es manual.

on:
  push:
    tags: ['v*']

permissions:
  contents: write # necesario para que electron-builder cree la release (borrador)

jobs:
  release:
    name: Build + publish (borrador)
    runs-on: windows-latest
    env:
      RTK_DISABLED: '1'
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} # electron-builder lo busca con este nombre
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24.22'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test

      - run: pnpm electron-vite build
      - run: pnpm electron-builder --win --publish always
```

`--publish always` es lo que le dice a `electron-builder` que suba los artefactos a la release de GitHub (en vez de solo dejarlos en `release/` local, que es lo que hace `pnpm dist:win` sin ese flag) — se corre directo, no a través del script `dist:win` (que no pasa `--publish`), para no tener que variar el script según el contexto.

## R3 — `electron-updater` en `main`

```ts
// src/main/index.ts (agregado, no un archivo nuevo - mismo lugar que el
// resto del ciclo de vida de la app)
import { autoUpdater } from 'electron-updater'

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = false // R3.3: nunca instala sola al cerrar

// Hallazgo real al diseñar esto: `registerNotificationClickHandler`
// (notify.ts) registra un único callback GLOBAL para cualquier clic en
// cualquier notificación (`Notification.handleActivation`, API de
// Electron) — no se puede registrar un segundo callback solo para esta
// notificación sin reemplazar el que ya existe (clic → mostrar ventana).
// Por eso la señal de "hay que instalar" vive en una variable de módulo
// que el mismo callback global ya existente revisa.
let updateReadyToInstall = false

autoUpdater.on('update-downloaded', (info) => {
  updateReadyToInstall = true
  notify({
    title: brand.displayName,
    body: `Versión ${info.version} lista para instalar — hacé clic para reiniciar y actualizar.`,
  })
})

// En el callback global ya existente (src/main/index.ts, ya registrado una
// sola vez al iniciar):
registerNotificationClickHandler(() => {
  if (updateReadyToInstall) {
    autoUpdater.quitAndInstall() // R3.3: solo acá, nunca antes de este clic
    return
  }
  mb.showWindow() // comportamiento ya existente, sin cambios
})

autoUpdater.on('error', (err) => {
  log.error('autoUpdater falló', err) // R3.4: nunca interrumpe el arranque
})

mb.on('ready', () => {
  // ... código ya existente ...
  void autoUpdater.checkForUpdates() // R3.1
})
```

`electron-updater` lee la config de publicación empaquetada (`app-update.yml`, que `electron-builder` genera solo a partir del mismo bloque `publish` de R1) — no hace falta repetir `owner`/`repo` a mano en el código.

## Riesgos técnicos ya resueltos por reutilización (no se repiten)

`notify()`/`registerNotificationClickHandler()` (ya existen, `src/main/notify.ts`), `electron-log` (ya en uso en todo `main`) — R3 los reutiliza tal cual, no reimplementa ninguno.
