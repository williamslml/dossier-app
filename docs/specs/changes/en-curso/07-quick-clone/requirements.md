# Requirements — Quick Clone

Ver `proposal.md` para el porqué, el alcance completo y los riesgos. Acá, los requisitos con sus escenarios verificables.

## Q1 — `core/features/clone`: clonar con la credencial correcta

- **Q1.1** `cloneRepo(url, destPath, account)` clona el repo en `destPath` usando `git -c credential.<account.host>.username=<account.username> clone <url> <destPath>` — la credencial que GCM resuelve (`fill`) es la de la cuenta elegida, no la de ninguna cuenta "activa" (`selectAccount`/`active.gitconfig` no se tocan para nada acá).
- **Q1.2** Nunca arma la URL con `usuario:token@host` — el token no pasa por ningún argumento de línea de comandos ni por disco; sigue siendo GCM quien lo resuelve, por `host + username` (mismo patrón que el resto del proyecto, `docs/adr/0004`).
- **Q1.3** Si Git falla (auth, red, carpeta no vacía, lo que sea), `cloneRepo` rechaza con el `stderr`/mensaje real de Git, sin intentar interpretarlo ni reintentar solo.

**Escenario verificable:** test de integración real (sin mockear Git) — clona un repo público real de GitHub hacia un directorio temporal y confirma que el `.git` resultante tiene el remoto esperado; un segundo test clona con una URL inválida/host inalcanzable y confirma que rechaza con el error de Git, sin crear una carpeta parcial que rompa el resto de la suite.

## Q2 — Validación de la URL antes de pasarla a Git

- **Q2.1** Solo `https://` — cualquier otro esquema (`ssh://`, `git://`, una ruta local, o nada) se rechaza antes de llegar a Git, con un mensaje claro.
- **Q2.2** El host de la URL tiene que coincidir con el host de alguna cuenta ya vinculada — si ninguna cuenta vinculada tiene ese host, la función de validación lo rechaza (el diálogo, además, ni siquiera deja llegar a este paso sin una cuenta elegida — ver Q3).

**Escenario verificable:** test unitario puro (sin Git real) de la función de validación — tabla de URLs válidas/inválidas (`https://...` válida, `ssh://...` / `git://...` / `/ruta/local` / `https://host-sin-cuenta-vinculada/...` inválidas), confirmando el motivo exacto de cada rechazo.

## Q3 — Diálogo "Clonar repositorio"

- **Q3.1** Mismo patrón visual que `GithubLinkDialog`/`AccountFoldersDialog` (`dialog-overlay`/`dialog-card`, cierra con clic afuera o la X).
- **Q3.2** Campos, en este orden: URL → cuenta (la lista se filtra a las cuentas cuyo host coincide con la URL ingresada; si hay una sola, no se preselecciona sola igual — Q3.3) → carpeta destino (reusa `window.dossier.pickFolder()`, ya existe).
- **Q3.3** Si hay más de una cuenta del mismo host, ninguna queda preseleccionada — el usuario elige a propósito (mismo criterio que `AccountFoldersDialog` cuando hay ambigüedad).
- **Q3.4** Mientras clona: estado "Clonando…" (sin progreso con porcentaje — ver proposal.md), los campos y el botón quedan deshabilitados — no se puede lanzar un segundo clone en paralelo desde el mismo diálogo.
- **Q3.5** Al terminar con éxito: mismo patrón de `showToast` que vincular una cuenta ("`<nombre>` clonado"), el diálogo se cierra solo.
- **Q3.6** Si falla: el diálogo quda abierto, muestra el error (mismo patrón `dialog-error` que los demás diálogos), permite reintentar sin volver a tipear todo.

**Escenario verificable:** verificación en vivo (CDP/DOM) — abrir el diálogo, confirmar el orden de los campos y que la lista de cuentas se filtra por host; no se puede probar un clone real contra una URL pública sin tocar la red real desde la verificación en vivo del change (sí vía el test de integración de Q1).

## Q4 — Auto-Pin al terminar con éxito

- **Q4.1** Reusa exactamente el mismo camino que fijar una carpeta a mano (`AccountFoldersDialog`): `writeAccountProfile` + `rulesStore.pin` + `renderIncludeIfBlock`/`updateRegion` — no una función paralela.
- **Q4.2** Corre **después** de que `cloneRepo` confirma éxito (Q1), nunca en paralelo ni antes — un clone que falla no deja ninguna regla fijada.
- **Q4.3** La guardia de identidad (`enforced`, S11 de `05-ajustes`) queda apagada por defecto en la regla recién creada, igual que al fijar a mano.

**Escenario verificable:** cubierto por el mismo test de integración de Q1, extendido para confirmar que, tras un clone exitoso, `rulesStore.list()` tiene la regla nueva con `enforced: false`.

## Q5 — Solapamiento de carpeta, chequeado antes de clonar

- **Q5.1** Antes de lanzar `cloneRepo`, se valida que `destPath` no se solape con ninguna regla ya fijada (mismo chequeo que `FolderOverlapError` de `rulesStore.pin`, pero corrido **antes** del clone, no después — si se corriera después, un clone ya hecho quedaría en disco sin poder fijarse).
- **Q5.2** Si hay solapamiento, se rechaza con el mismo mensaje de `FolderOverlapError`, sin tocar el sistema de archivos ni la red.

**Escenario verificable:** test unitario — con una regla ya fijada, intentar clonar hacia una subcarpeta (o una carpeta que la contiene) rechaza antes de llamar a `cloneRepo` (se verifica con un espía/mock de `cloneRepo` para confirmar que nunca se llama).

## Q6 — IPC

- **Q6.1** Nuevo canal `IPC.cloneRepo` (`{ url, destPath, accountId }` → éxito/error). **Decisión tomada al implementar:** no hay un evento de progreso aparte (`cloneProgress`) — se armó uno primero, siguiendo el patrón de `githubVerification`, pero quedó sin ningún consumidor: a diferencia del Device Flow (que sí tiene un callback intermedio independiente de cuándo termina el `invoke`), acá todo el trabajo ocurre dentro de una sola llamada esperada de punta a punta — el propio `invoke` ya le dice al renderer cuándo empezó (al llamarlo), cuándo terminó bien (resuelve) y cuándo falló (rechaza). Se sacó el evento en vez de dejarlo sin usar.
- **Q6.2** El handler valida el payload con `zod`, igual que el resto de los handlers de `main`.

**Escenario verificable:** cubierto por la verificación en vivo de Q3 (el diálogo refleja clonando/listo/error según el estado de la promesa de `window.dossier.cloneRepo(...)`).

## Q7 — Habilitar el botón

- **Q7.1** `AddButtons.tsx`: el botón "Clonar repositorio" deja de estar `disabled`, abre el diálogo de Q3.

**Escenario verificable:** verificación en vivo — el botón ya no tiene el atributo `disabled` ni el tooltip "Próximamente".

## Q8 — Hallazgos de la revisión independiente, corregidos

Revisión en sesión separada (agente sin el historial de la sesión que implementó, como pide `CLAUDE.md` para esta señal de alto riesgo). Tres hallazgos importantes sobre la superficie de credenciales/seguridad, corregidos:

- **Q8.1** `cloneRepo` no desactivaba la interactividad de Git/GCM — a diferencia de `core/features/git-credential` (que sí lo hace para `approve`/`fill`/`reject`), podía quedarse esperando un prompt para siempre si GCM no resolvía la credencial en silencio, sin ningún timeout. **Confirmado real, no hipotético:** un test contra un host sin credencial cacheada se colgó de verdad (20s, cortado por el timeout del test). **Fix:** `GIT_TERMINAL_PROMPT=0` (como ya hacía `git-credential.ts`) **más** `credential.interactive=false`/`credential.guiPrompt=false` (ADR 0004 punto 3 completo, no solo la primera parte — el primer env var por sí solo no alcanzó, confirmado por el mismo test), más un timeout de bloqueo (`simple-git`'s `timeout.block`, mata el proceso si no hay salida nueva en 30s — no un timeout de duración total, que cortaría un clone lento pero activo).
- **Q8.2** El handler de `IPC.cloneRepo` validaba que el host de la URL tuviera _alguna_ cuenta vinculada (Q2.2), pero nunca que fuera la _misma_ cuenta que `accountId` — ese filtro vivía solo del lado del cliente (`CloneDialog.tsx`). Un `accountId` de otro host habría dejado el override de credencial sin efecto y fijado la carpeta a la cuenta equivocada. **Fix:** el handler compara `new URL(url).host` contra `account.host` antes de clonar.
- **Q8.3** `validateCloneUrl` no rechazaba URLs con credenciales embebidas (`https://token@host/...`) — el host post-"@" es el real/conocido, así que pasaba el resto de la validación y el secreto terminaba en el argv del proceso de `git clone` (visible a otros procesos de la sesión mientras dura el clone, lo que ADR 0006 prohíbe para tokens). **Fix:** se rechaza cualquier URL cuyo `username`/`password` de `new URL()` no esté vacío.

Dos hallazgos menores, también corregidos (bajo riesgo, pero baratos de resolver):

- **Q8.4** `CloneDialog.tsx` no tenía forma de cancelar un clone en curso; si se cerraba el diálogo mientras clonaba, un error quedaba sin mostrar (componente ya desmontado). **Fix:** no se puede cerrar el diálogo (ni con la X ni con clic afuera) mientras `step.kind === 'clonando'` — más simple que agregar cancelación real.
- **Q8.5** La comparación de host podía rechazar un host legítimo guardado con otras mayúsculas/minúsculas (GitLab autoalojado: el host se tipea a mano al vincular, sin normalizar; `new URL().host` siempre normaliza a minúsculas). **Fix:** comparación case-insensitive tanto en `validateCloneUrl` como en el chequeo de Q8.2.

**No corregido, documentado como límite conocido (severidad menor, baja probabilidad):** una carrera residual entre el chequeo de solapamiento (Q5, antes del clone) y el Auto-Pin (Q4, después) — si otra acción fija una regla que se solapa _mientras_ el clone está en curso, `rulesStore.pin()` puede rechazar después de que el clone y `writeAccountProfile` ya corrieron, dejando un repo clonado completo sin regla/`includeIf`. Agregar un lock cruzado a esta única ventana no amerita la complejidad para este change — queda anotado acá por si se repite en otro contexto.

## Fuera de alcance de este change

Ver "Qué NO cambia / queda fuera" en `proposal.md`: preferencias globales de carpeta/aislamiento, clonar sin cuenta vinculada del host, activar la guardia de identidad automáticamente, progreso con porcentaje exacto, SSH, reintento automático con otra cuenta.
