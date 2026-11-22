# Requirements — Pipeline de release (Fase 5)

Ver `proposal.md` para el porqué, el alcance completo y los riesgos. Acá, los requisitos con sus escenarios verificables.

## R1 — Configuración de publicación en `electron-builder.yml`

- **R1.1** `publish: { provider: 'github', owner: 'williamslml', repo: 'dossier-app' }` — necesaria tanto para `electron-builder --publish` (R2) como para que `electron-updater` (R3) sepa contra qué repo chequear actualizaciones (las dos lo leen de la misma sección `build` que termina en `app-update.yml` empaquetado con la app).
- **R1.2** No agrega `releaseType` explícito — el default de `electron-builder` ya es `draft` (verificado contra el tipo real de `builder-util-runtime`, no asumido), que es justo el comportamiento que pide `proposal.md`: nunca publicada sola.

**Escenario verificable:** `pnpm dist:win` (ya probado en una sesión anterior) sigue funcionando igual sin la variable de entorno `GH_TOKEN` seteada — agregar `publish` no debe romper el build local que no publica nada (`electron-builder` sin `--publish` nunca intenta hablar con GitHub).

## R2 — `.github/workflows/release.yml`

- **R2.1** Se dispara con un tag que matchee `v*` (`on: push: tags: ['v*']`), nunca con un push a una rama.
- **R2.2** Corre en `windows-latest` únicamente (mismo criterio que ya documenta el comentario de `ci.yml`: "solo Windows" para el instalador real — la matriz de 3 sistemas de `ci.yml` es solo para tests).
- **R2.3** Usa el `GITHUB_TOKEN` que Actions ya provee automáticamente (permiso `contents: write` explícito en el workflow para poder crear la release) — nunca un Personal Access Token guardado como secreto aparte. Visible solo en los dos pasos que de verdad lo necesitan (`electron-builder --win --publish never`, que descarga binarios de GitHub, y `gh release create`), no a nivel de job entero — hallazgo de la revisión independiente (ADR 0006: acotar la exposición de un token, aunque sea de vida corta y scope limitado, a los pasos que lo usan).
- **R2.4** Corre `pnpm electron-builder --win --publish always` (no el script `dist:win`, que no pasa `--publish`) para que suba los artefactos — el instalador queda **sin firmar** (sin certificado configurado, `electron-builder` ya lo resuelve logueando "signing is skipped", confirmado en la prueba local anterior).
- **R2.5** La release que resulta queda en **borrador** (R1.2) — nadie la ve publicada hasta que un humano la confirme manualmente desde GitHub.
- **R2.6** La versión que usa `electron-builder` para nombrar/encontrar la release es la del **tag real que disparó el workflow** (`GITHUB_REF_NAME` sin el `v`), no la de `package.json` — ver el hallazgo real de abajo.

**Hallazgo real, encontrado empujando un tag de prueba de verdad (no hipotético):** `electron-builder` arma el nombre/versión de la release a partir de `package.json`, no del tag de git que disparó el workflow. Con `package.json` en `0.0.0` y un tag de prueba `v0.0.0-test1` (que no coincide), `electron-builder` no encontró ninguna release existente que correspondiera y creó una release **"untagged"** nueva — y lo hizo **dos veces** (el paso debe haberse ejecutado dos veces o haber una condición de carrera en el publish), repartiendo los artefactos entre las dos (una con el `.exe`+`latest.yml`, la otra solo con el `.blockmap`). Nada de esto rompe la garantía de "nunca publicada sola" (las dos quedaron en borrador), pero una release repartida/mal nombrada no sirve para nada. **Fix:** un paso nuevo en el workflow deriva `RELEASE_VERSION` de `GITHUB_REF_NAME` (saca la `v` inicial) y se lo pasa a `electron-builder` con `-c.extraMetadata.version=$RELEASE_VERSION`, sin tocar el `package.json` del repo.

**Escenario verificable:** empujar un tag de prueba (**con tu aprobación explícita en el momento**, nunca de forma automática) y confirmar que el workflow corre y deja **una sola** release en borrador, con el nombre/tag correspondiente al tag real empujado, con el `.exe`+`latest.yml`+`.blockmap` juntos — nunca una release ya publicada, nunca repartida en varias.

## R3 — Auto-actualización (`electron-updater`)

- **R3.1** Nueva dependencia `electron-updater`. `main` llama `autoUpdater.checkForUpdatesAndNotify()` (o el equivalente que permita interceptar antes de instalar — a confirmar al implementar cuál da mejor control) al iniciar la app.
- **R3.2** Si hay una actualización: se descarga en segundo plano, sin interrumpir el uso de la app.
- **R3.3** Antes de instalar/reiniciar: una notificación (`notify()`, ya existe) o un diálogo explícito pide confirmación — nunca `autoUpdater.quitAndInstall()` sin que el usuario lo haya pedido primero. Mismo principio que el resto de la app (S11.6 de `05-ajustes`, por ejemplo): ninguna acción con efecto real sin un clic explícito.
- **R3.4** Si falla el chequeo (sin red, GitHub caído, lo que sea): se loguea (`electron-log`, ya en uso), nunca interrumpe el arranque normal de la app ni muestra un error intrusivo por algo que no es culpa del usuario.

**Escenario verificable:** con una release de prueba ya publicada manualmente en GitHub (con tu aprobación, ver R2), una instancia local con una versión de `package.json` más vieja detecta la actualización al iniciar, la descarga, y la notificación/diálogo de confirmación aparece — sin instalar nada hasta un clic explícito.

**Hallazgo real, encontrado ejecutando por primera vez un build empaquetado de verdad (nunca `electron .` en modo dev, que es lo único que se había probado hasta ahora):** `electron-updater` revienta con un 404 chequeando `https://github.com/williamslml/dossier-app/releases.atom` — el provider de GitHub de `electron-updater` siempre pide el feed público, sin ningún token, y el repo era privado. No es un bug de implementación, es una decisión de arquitectura: con tu aprobación explícita, se hizo público el repo (`gh repo edit --visibility public`) el 2026-11-21 — la alternativa (guardar un token de GitHub en cada instalación) quedó descartada por tocar manejo de credenciales sin necesidad.

## Fuera de alcance de este change

Ver "Qué NO cambia / queda fuera" en `proposal.md`: crear/empujar el tag real de una versión, publicar la release (sacarla de borrador), firma con SignPath, `winget`/Scoop.
