# Requirements — Pipeline de release (Fase 5)

Ver `proposal.md` para el porqué, el alcance completo y los riesgos. Acá, los requisitos con sus escenarios verificables.

## R1 — Configuración de publicación en `electron-builder.yml`

- **R1.1** `publish: { provider: 'github', owner: 'williamslml', repo: 'dossier-app' }` — necesaria tanto para `electron-builder --publish` (R2) como para que `electron-updater` (R3) sepa contra qué repo chequear actualizaciones (las dos lo leen de la misma sección `build` que termina en `app-update.yml` empaquetado con la app).
- **R1.2** No agrega `releaseType` explícito — el default de `electron-builder` ya es `draft` (verificado contra el tipo real de `builder-util-runtime`, no asumido), que es justo el comportamiento que pide `proposal.md`: nunca publicada sola.

**Escenario verificable:** `pnpm dist:win` (ya probado en una sesión anterior) sigue funcionando igual sin la variable de entorno `GH_TOKEN` seteada — agregar `publish` no debe romper el build local que no publica nada (`electron-builder` sin `--publish` nunca intenta hablar con GitHub).

## R2 — `.github/workflows/release.yml`

- **R2.1** Se dispara con un tag que matchee `v*` (`on: push: tags: ['v*']`), nunca con un push a una rama.
- **R2.2** Corre en `windows-latest` únicamente (mismo criterio que ya documenta el comentario de `ci.yml`: "solo Windows" para el instalador real — la matriz de 3 sistemas de `ci.yml` es solo para tests).
- **R2.3** Usa el `GITHUB_TOKEN` que Actions ya provee automáticamente (permiso `contents: write` explícito en el workflow para poder crear la release) — nunca un Personal Access Token guardado como secreto aparte.
- **R2.4** Corre `pnpm dist:win` con `--publish always` (o el flag equivalente) para que suba los artefactos — el instalador queda **sin firmar** (sin certificado configurado, `electron-builder` ya lo resuelve logueando "signing is skipped", confirmado en la prueba local anterior).
- **R2.5** La release que resulta queda en **borrador** (R1.2) — nadie la ve publicada hasta que un humano la confirme manualmente desde GitHub.

**Escenario verificable:** empujar un tag de prueba (`v0.0.0-test` o similar, **con tu aprobación explícita en el momento**, nunca de forma automática) y confirmar que el workflow corre y deja una release en borrador con el `.exe` adjunto — nunca una release ya publicada.

## R3 — Auto-actualización (`electron-updater`)

- **R3.1** Nueva dependencia `electron-updater`. `main` llama `autoUpdater.checkForUpdatesAndNotify()` (o el equivalente que permita interceptar antes de instalar — a confirmar al implementar cuál da mejor control) al iniciar la app.
- **R3.2** Si hay una actualización: se descarga en segundo plano, sin interrumpir el uso de la app.
- **R3.3** Antes de instalar/reiniciar: una notificación (`notify()`, ya existe) o un diálogo explícito pide confirmación — nunca `autoUpdater.quitAndInstall()` sin que el usuario lo haya pedido primero. Mismo principio que el resto de la app (S11.6 de `05-ajustes`, por ejemplo): ninguna acción con efecto real sin un clic explícito.
- **R3.4** Si falla el chequeo (sin red, GitHub caído, lo que sea): se loguea (`electron-log`, ya en uso), nunca interrumpe el arranque normal de la app ni muestra un error intrusivo por algo que no es culpa del usuario.

**Escenario verificable:** con una release de prueba ya publicada manualmente en GitHub (con tu aprobación, ver R2), una instancia local con una versión de `package.json` más vieja detecta la actualización al iniciar, la descarga, y la notificación/diálogo de confirmación aparece — sin instalar nada hasta un clic explícito.

## Fuera de alcance de este change

Ver "Qué NO cambia / queda fuera" en `proposal.md`: crear/empujar el tag real de una versión, publicar la release (sacarla de borrador), firma con SignPath, `winget`/Scoop.
