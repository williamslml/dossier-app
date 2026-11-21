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

Ver el archivo real para el YAML completo — acá, por qué terminó así (dos vueltas, las dos con un tag de prueba real empujado, nunca hipotético):

**Primera vuelta:** `pnpm electron-builder --win --publish always` directo. Encontró dos problemas reales en los logs del run:

1. `electron-builder` nombra/busca la release con la versión de `package.json`, no con el tag que disparó el workflow. Con `package.json` en `0.0.0` y un tag de prueba distinto, no encontró ninguna release existente y creó una **"untagged"** nueva — no el tag real.
2. `--publish always` sube cada artefacto con su propio "publisher" en paralelo; cada uno decide por su cuenta si la release ya existe. Con el tag real coincidiendo (punto 1 corregido) esto *todavía* puede competir y crear la release dos veces — se vio literalmente dos líneas de `"creating GitHub release"` para el mismo tag en el mismo segundo.

**Solución final:**

- Un paso deriva `RELEASE_VERSION` de `GITHUB_REF_NAME` (saca la `v` inicial) y se lo pasa a `electron-builder` con `-c.extraMetadata.version=$RELEASE_VERSION`, sin tocar `package.json`.
- `electron-builder` corre **sin** `--publish` (solo construye, deja los artefactos en `release/`).
- Un paso aparte crea la release y sube los tres artefactos (`.exe`, `.exe.blockmap`, `latest.yml`) con un solo `gh release create ... --draft`, que no paraleliza su propia subida — nunca la carrera del punto 2.

Verificado localmente (sin publicar) que `-c.extraMetadata.version=X` deja los nombres de archivo y el contenido de `latest.yml` consistentes con `X`, antes de volver a probar el workflow completo contra GitHub real.

## R3 — `electron-updater` en `main`

```ts
// src/main/index.ts (agregado, no un archivo nuevo - mismo lugar que el
// resto del ciclo de vida de la app)
// Hallazgo real, probado en vivo (no solo compilado): electron-updater es
// CommonJS puro — bajo ESM, el import nombrado (`import { autoUpdater }
// from 'electron-updater'`) pasa TypeScript pero falla en tiempo de
// ejecución ("Named export 'autoUpdater' not found"). Hace falta el
// default export y desestructurar después.
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg

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
