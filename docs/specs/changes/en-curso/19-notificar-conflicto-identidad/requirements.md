# Requirements — Notificar un conflicto de identidad sin depender de la ventana

## G1. `core`: detección de archivos nuevos

- G1.1: `diffNewConflictFiles(known, current)` devuelve los nombres presentes en `current` pero no en `known` — pura, sin tocar disco.
- G1.2: sin nada conocido antes, todo lo actual cuenta como nuevo.
- G1.3: un archivo que reaparece después de haber desaparecido (conflicto resuelto y luego uno nuevo de verdad en la misma carpeta) vuelve a contar como nuevo — la función no necesita saber nada de "resuelto", es responsabilidad del llamador mantener la lista de "conocidos" actualizada después de cada chequeo.

## G2. `main`: vigilancia + notificación

- G2.1: al arrancar, los conflictos ya existentes en `identity-conflicts/` se registran como "ya conocidos" — nunca disparan una notificación al iniciar la app.
- G2.2: un archivo nuevo (escrito por el hook mientras la app ya corre) dispara `notify()` con `important: true`, sin importar si la ventana está visible u oculta.
- G2.3: nunca se envía más de una notificación por el mismo evento, aunque `fs.watch` dispare varios callbacks para una sola escritura real.
- G2.4: un fallo al leer la carpeta o un archivo puntual nunca debe romper el watcher completo ni el arranque de la app — se registra en el log y se sigue.
- G2.5: el clic en la notificación muestra la ventana — reutilizando el manejador global ya existente, sin uno nuevo.

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo contra el binario empaquetado real, con la ventana oculta desde el arranque (sin `DOSSIER_SHOW_ON_START`): confirma, con un conflicto de prueba contra un `repoPath` ficticio, que el log muestra "conflicto de identidad detectado" y por lo tanto que se llamó a `notify()`, sin que la ventana se haya mostrado en ningún momento.
