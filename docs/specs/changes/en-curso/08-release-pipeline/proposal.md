# Proposal — Pipeline de release (Fase 5)

**Aprobación humana obligatoria** (`CLAUDE.md`): "cualquier paso de firma o publicación de release (SignPath, tags, GitHub Releases)". Este change construye el *pipeline*, pero **ningún tag se crea ni se empuja, y ninguna GitHub Release se publica**, sin tu aprobación explícita en el momento — ver "Qué NO hace este change" más abajo.

## Por qué

`docs/product.md` §5 (Fase 5): "electron-builder + Actions + Releases + updater", terminado cuando "un tag publica el `.exe` y la app se actualiza sola". `.github/workflows/ci.yml` ya anticipa esto en su propio comentario ("No genera artefactos de instalación... eso es la Fase 5, `release.yml`, solo Windows"). Hoy generar un instalador es un paso manual (`pnpm dist:win`, usado como prueba local en una sesión anterior) y no hay forma de distribuir una actualización salvo que cada usuario vuelva a descargar el instalador a mano.

## Qué cambia

1. **`electron-builder.yml`**: agrega `publish: { provider: 'github', owner: 'williamslml', repo: 'dossier-app' }` — necesario tanto para que `electron-builder` sepa dónde subir el instalador como para que `electron-updater` (punto 3) sepa dónde buscar actualizaciones. No publica nada por sí solo; sin un token con permiso de escritura en el entorno (que no corre en la máquina local), `electron-builder --publish` falla en vez de intentar subir nada a ciegas.
2. **`.github/workflows/release.yml`** (nuevo): se dispara con un tag `v*`. Instala dependencias, corre `pnpm dist:win` (sin firmar — ver "Qué NO cambia"), y sube el instalador + `latest.yml` a una **GitHub Release en borrador** (`draft: true` en la config de `electron-builder`, o el flag equivalente de la action de publicación) — nunca publicada automáticamente. Confirmar y publicar la release queda en tus manos, desde GitHub, después de revisar los artefactos.
3. **Auto-actualización (`electron-updater`)**: nueva dependencia; `main` chequea actualizaciones al iniciar (y opcionalmente cada tanto) contra la config de `publish` del punto 1, descarga en segundo plano si hay una nueva, y pide confirmación antes de reiniciar para instalarla — nunca una actualización silenciosa sin aviso (mismo principio que el resto de la app: ninguna acción con efecto real sin que el usuario la vea).

## Qué NO cambia / queda fuera

- **Crear o empujar un tag**: ningún comando de este change hace `git tag`/`git push --tags`. El workflow de release se dispara con un tag, pero crear ese tag es tu decisión, en el momento que elijas, no algo que este change automatice.
- **Publicar la GitHub Release**: el workflow sube los artefactos a una release en **borrador**; publicarla (hacerla visible, disparar la notificación de `electron-updater` a los usuarios) es un clic tuyo en GitHub, no parte del pipeline automático.
- **Firma del instalador (SignPath)**: sigue pendiente de que se apruebe la postulación a SignPath Foundation (`docs/product.md` §7, decisión abierta #3) — ese trámite es tuyo, no algo que se resuelva con código. Mientras tanto, el instalador que genera `release.yml` queda **sin firmar**, igual que la prueba local ya hecha — Windows SmartScreen va a seguir marcándolo como "editor no reconocido" hasta que haya firma real.
- **`winget`/Scoop**: `docs/product.md` los deja para Fase 6 ("Después"), no para este change.
- **Verificación de notificaciones en un instalador real** (`AppUserModelID`/`ToastActivatorCLSID`, decisión abierta #4 de `docs/product.md`): ya se verificó una vez con el build de prueba local (`docs/lessons/README.md` — pendiente de anotar si no está). Este change no repite esa verificación salvo que algo relacionado con `electron-updater` la afecte.

## Riesgos

- **Un pipeline de release que publica solo, sin revisión, sería peligroso** (ADR 0006: ninguna acción con efecto real sin aprobación explícita) — por eso la release queda en borrador, nunca publicada por el workflow mismo. Este es el límite más importante del change, no un detalle.
- **Un token de GitHub Actions con permisos de más** podría usarse para algo distinto de subir un release — el workflow usa el `GITHUB_TOKEN` por defecto de Actions (alcance limitado al repo, de vida corta), nunca un Personal Access Token guardado como secreto, salvo que GitHub lo exija para algo puntual (a confirmar al implementar).
- **Auto-actualización silenciosa** podría instalar algo sin que el usuario se entere — `autoUpdater` se configura para pedir confirmación antes de reiniciar/instalar, nunca `autoInstallOnAppQuit` sin aviso previo.
- **Firmar la expectativa de "ya se puede publicar"**: este change dice "pipeline listo", no "ya hay una versión publicada" — publicar la primera release real sigue siendo una decisión tuya, después de este change, no una consecuencia automática de mergearlo.

## Criterio de éxito

- `pnpm dist:win` sigue funcionando igual que la prueba local ya hecha (sin firmar, instala, deja el AppUserModelID correcto).
- Un workflow de GitHub Actions (`release.yml`) existe, dispara con un tag `v*`, y (verificado empujando un tag de prueba, con tu aprobación explícita en el momento) genera una GitHub Release en **borrador** con el instalador adjunto — nunca publicada sola.
- Con `electron-updater` wireado: una instancia de la app con una versión vieja, apuntando a una release **ya publicada manualmente** (de prueba, con tu aprobación), detecta la actualización, la descarga, y pide confirmación antes de instalar.
- `pnpm typecheck && pnpm lint && pnpm test` en verde.
