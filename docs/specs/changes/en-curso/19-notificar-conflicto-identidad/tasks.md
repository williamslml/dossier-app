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

- [x] Revisión en sesión separada (señal de alto riesgo) — dos hallazgos reales corregidos. (1, bloqueante) `mkdirSync`/`watch()` sin try/catch y el `FSWatcher` sin `.on('error', ...)` podían tumbar todo el proceso de `main` si la carpeta de conflictos fallaba o quedaba inaccesible (un `EventEmitter` que emite `'error'` sin listener lanza esa excepción) — corregido envolviendo todo el bloque en try/catch y agregando el manejador de error del watcher. (2, importante) `knownConflictFiles` se actualizaba con el listado completo ANTES de intentar leer cada archivo nuevo — si el hook escribe el JSON de forma no atómica y un evento llega con el archivo a medio escribir, el nombre quedaba marcado "ya conocido" y la notificación real se perdía para siempre en el próximo evento (con el archivo ya completo). Corregido: solo se marcan "conocidos" los archivos que se leyeron y parsearon bien; los que fallan quedan afuera para reintentarse — verificado en vivo (archivo incompleto → falla logueada → se completa → notifica bien). (3, nitpick) el test de "reaparición" no ejercitaba la secuencia completa — se agregó uno que sí la ejercita paso a paso. De paso, se simplificó el título de la notificación ("Conflicto de identidad" en vez de repetir "Dossier", que Windows ya muestra en la cabecera — hallazgo visual del usuario al verla en pantalla)
- [x] Merge con `finishing-a-development-branch` — mergeado localmente a `main` (sin conflictos), `pnpm typecheck && pnpm lint && pnpm test` en verde sobre el resultado, rama `feat/notificar-conflicto-identidad` borrada
- [x] Mover la spec a `../archivados/`
