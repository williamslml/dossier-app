# Design — Notificar un conflicto de identidad sin depender de la ventana

## Por qué `fs.watch` sobre la carpeta, no un archivo puntual

El nombre de archivo que reporta el callback de `fs.watch` no siempre es confiable en Windows (puede venir vacío o no reflejar el cambio real). En vez de confiar en eso, cada evento relista toda la carpeta `identity-conflicts/` y compara contra la última lista conocida (`diffNewConflictFiles`, en `core`, pura y testeable sin disco) — más simple y más robusto que intentar interpretar el evento puntual.

## Por qué no reventar nada al arrancar

Al iniciar, `main` lee la lista actual de conflictos como punto de partida ("ya conocidos") antes de empezar a vigilar — así, conflictos de sesiones anteriores (que el usuario ya puede haber visto o no en la tarjeta de la ventana) no generan una notificación de "bienvenida" cada vez que se abre la app. Solo un archivo que aparece **después** de ese punto de partida cuenta como nuevo.

## Por qué reutilizar el manejador global de clics existente

`Notification.handleActivation` de Electron es **global por proceso** — no hay forma de registrar un manejador de clic distinto por cada notificación individual (a diferencia de escuchar `'click'` en la instancia, que solo funciona mientras el proceso ya está corriendo, no en un arranque en frío sobre esa notificación). El manejador global ya registrado en `mb.on('ready', ...)` solo muestra la ventana, nunca instala nada ni ejecuta una acción irreversible — comportamiento seguro para cualquier notificación nueva que no registre su propio `.once('click', ...)`, como esta. No hace falta agregar nada ahí.

## Por qué esto es un aviso adicional, no el mecanismo principal

La tarjeta de conflicto en la ventana (`S11.4`/`S11.5`, ya implementada) sigue siendo la fuente de verdad: se recalcula leyendo el disco cada vez que se abre la ventana, sin depender de que `fs.watch` haya capturado algo. Este cambio no la reemplaza — agrega una notificación nativa de Windows para el caso que esa tarjeta no cubre bien: la app corriendo en la bandeja, con la ventana nunca abierta.

## Qué pasa si algo falla

`readdirSync`/`readFileSync` dentro del watcher están envueltos en manejo de errores que nunca propaga — un directorio temporalmente inaccesible, o un archivo de conflicto a medio escribir cuando llega el evento, solo quedan registrados en el log (`log.error`) y el watcher sigue funcionando para el próximo evento. Nunca debe poder tumbar el proceso principal de la app.
