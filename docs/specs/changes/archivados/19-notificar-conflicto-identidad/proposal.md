# Proposal — Notificar un conflicto de identidad sin depender de la ventana

**Señal de alto riesgo** (`CLAUDE.md`): toca el mecanismo de guardia de identidad (hooks de Git / `includeIf`) — revisión obligatoria en sesión separada antes de mergear.

## Por qué

Pregunta directa del usuario: ¿Dossier avisa con una notificación nativa de Windows cuando el hook de guardia detecta que un commit/push se hizo con la identidad equivocada? Investigando, la respuesta real era **no**: el conflicto se escribe en disco (`core/features/identity-guard`, ya existente) pero solo se lee y se muestra cuando el usuario **abre la ventana de Dossier** (`mb.on('after-show', ...)`, por diseño explícito de `S11.4`: "relee los conflictos cada vez que la ventana se muestra — nunca un watcher de archivos, la diferencia de inmediatez no importa acá, el usuario ya está mirando la ventana cuando puede pasar algo"). Esa premisa no vale para este caso: el usuario puede pushear desde una terminal o un editor con Dossier corriendo en la bandeja, sin abrir nunca la ventana — y nunca se entera.

## Qué cambia

1. **`core/features/identity-guard/identity-guard.ts`**: `diffNewConflictFiles(known, current)` — función pura que compara dos listas de nombres de archivo y devuelve los genuinamente nuevos. Separada del `fs.watch` real para poder probarla sin tocar disco.
2. **`src/main/index.ts`**: `fs.watch` sobre la carpeta `identity-conflicts` entera (nunca un archivo puntual — más simple y evita depender de qué nombre reporta el evento, no siempre confiable en Windows). En cada evento, relista la carpeta, usa `diffNewConflictFiles` contra lo ya conocido, y por cada archivo nuevo dispara `notify()` (la función ya existente, `Notification` nativa de Electron) con `important: true`. Al arrancar, los conflictos que ya existían de antes NO disparan una notificación (ya se ven en la tarjeta de la ventana la primera vez que se abra).
3. **El clic en la notificación**: reutiliza el manejador global ya existente (`registerNotificationClickHandler`, que solo muestra la ventana) — sin agregar ningún manejador nuevo. `Notification.handleActivation` es global en Electron (un solo manejador para toda la app), así que cualquier notificación sin un `.once('click', ...)` propio cae en ese camino, que es exactamente lo que hace falta acá.

## Qué NO cambia

- La tarjeta de conflicto en la ventana (`IdentityConflicts.tsx`, `listIdentityConflicts`) sigue siendo el mecanismo confiable y completo — esto es un aviso **adicional**, nunca un reemplazo. Si `fs.watch` no captura un evento puntual (documentado como posible en Node, sobre todo en Windows), la tarjeta sigue mostrando el conflicto la próxima vez que se abra la ventana.
- El script del hook (`buildHookScript`) no cambia en nada — sigue escribiendo el mismo JSON de siempre, sin saber nada de notificaciones.

## Riesgos

- **Avisos duplicados**: `fs.watch` puede disparar más de un evento por una sola escritura real (hallazgo conocido de Node en Windows) — `diffNewConflictFiles` lo evita, comparando contra la lista ya conocida después de cada chequeo, no contra el nombre que reportó el evento puntual.
- **No reventar el arranque**: `fs.watch`/`readdirSync` envueltos en try/catch — un fallo acá nunca debe impedir que la app arranque ni que la ventana siga funcionando normalmente.

## Criterio de éxito

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo contra el binario real empaquetado, con la ventana **oculta** (sin forzarla a mostrarse) — confirma, con un conflicto de prueba contra un `repoPath` ficticio (nunca una cuenta real), que el código de notificación se ejecuta de verdad sin que el usuario haya abierto la ventana en ningún momento.
