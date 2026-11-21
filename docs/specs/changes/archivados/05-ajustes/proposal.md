# Proposal — Pantalla de Ajustes

**Parte 2 agrega una señal de alto riesgo** (`CLAUDE.md`): toca `includeIf`, identidad de commit, clave de firma y limpieza de credenciales en GCM. Revisión obligatoria en sesión separada antes de mergear esa parte — ver tasks.md.

## Por qué

`docs/adr/0007-frontend.md` ya define la pantalla "Ajustes" dentro del prototipo congelado (GCM, inicio con el sistema, versión), y `docs/product.md` §3.5 tiene reservado `settings.json` para guardarlo, pero nunca se detalló qué contiene exactamente ni cómo se construye. El botón de engranaje de la barra de título (`feat/rediseno-pantalla-principal`) ya existe en la pantalla principal, deshabilitado con el tooltip "próximamente" — este change es lo que hay detrás de ese botón.

Después de la propuesta original (Parte 1, abajo), el usuario pidió ampliar el alcance (Parte 2) para cubrir automatización por carpeta, qué cambia al activar una cuenta, el comportamiento de Quick Clone, más integración con Windows y limpieza de credenciales — y que el menú del clic derecho en la bandeja ofrezca las mismas opciones sin tener que abrir la ventana.

## Qué cambia — Parte 1 (ya construida, bajo riesgo)

1. **`core/features/settings/`**: lee y escribe `settings.json` (modelo ya reservado en `docs/product.md` §3.5). Contenido: tema (`"claro" | "oscuro" | "sistema"`) e inicio con el sistema (`boolean`).
2. **IPC** (`main`): `getSettings` · `setSettings`.
3. **Inicio con el sistema**: usa la API nativa de Electron (`app.setLoginItemSettings`), sin tocar el Registro de Windows a mano.
4. **Tema** (claro / oscuro / según el sistema): variables CSS en `:root`/`:root[data-theme='oscuro']` (`src/renderer/index.html`); "según el sistema" sigue el modo claro/oscuro de Windows en vivo (`nativeTheme.on('updated', …)`).
5. **Pantalla de Ajustes** (`renderer`): Apariencia (selector de tema), Inicio (interruptor), Acerca de (versión de `package.json`), estado de GCM (mismo que `Footer.tsx`, con más detalle).

## Qué cambia — Parte 2 (ampliación pedida por el usuario)

6. **Reglas por carpeta, accesibles desde Ajustes**: construido en `docs/specs/changes/en-curso/06-motor-de-identidad/` (encontrado al diseñar esta misma sección: el modelo `core/features/rules`/`core/features/gitconfig` existía, pero nunca estaba conectado a las cuentas ni a un IPC real — se separó en su propio change, más grande de lo que parecía). Acá solo queda la UI, sobre el IPC (`pinFolder`/`unpinFolder`/`listPins`) que ese change ya expone. Se revisa la decisión de "es su propia pantalla, no Ajustes" (`docs/adr/0007-frontend.md`) — queda **accesible desde las dos**, no se elimina la pantalla dedicada, Ajustes agrega un atajo/resumen.
7. **Alcance al cambiar de cuenta activa**: `06-motor-de-identidad` ya conectó `selectAccount` para que escriba la identidad real (`active.gitconfig`) de la cuenta recién activada — este ajuste decide si, además, Dossier **también** escribe ahí la clave de firma de commits (GPG, o SSH con `gpg.format = ssh` — **nunca** para transporte remoto, `docs/product.md` §1). Por defecto, apagado (el comportamiento de `06-motor-de-identidad` no cambia salvo que el usuario lo prenda acá).
8. **Comportamiento al clonar**: carpeta base por defecto para Quick Clone (que todavía no existe como feature, `docs/product.md` §Alcance) y si el repo clonado aísla la cuenta activa dentro de su propio `.git` (configuración local del repo) en vez de depender solo de `includeIf`.
9. **Integración con Windows, ampliada**: Inicio con Windows (Parte 1, ya construido); **cerrar oculta a la bandeja del sistema, no cierra la app** — ya es el comportamiento actual del botón de cerrar (`src/main/index.ts`, `hideWindow`: oculta la ventana, no cierra la app; distinto de minimizar, que la manda a la barra de tareas), se documenta acá para que quede claro en Ajustes, no es una función nueva; atajo de teclado global para abrir la ventana (`globalShortcut`, nuevo).
10. **Mantenimiento de credenciales**: una acción para listar y borrar entradas de GCM que ya no corresponden a ninguna cuenta vinculada (huérfanas) o que chocan entre sí — emparentado con "Doctor" (`docs/product.md` §Alcance, sin marcar), pero acotado a limpieza, no al diagnóstico completo.
11. **Menú del clic derecho en la bandeja**: hoy solo tiene "Abrir" / "Probar notificación" / "Salir" (`src/main/index.ts`). Se agregan ahí mismo las mismas opciones de Ajustes que tienen sentido sin abrir la ventana (tema, inicio con Windows) como ítems nativos de Electron (`checkbox`/`radio` en `Menu.buildFromTemplate`), reconstruyendo el menú cada vez que cambian (Electron no los actualiza solo).
12. **Guardia de identidad por carpeta fijada (opt-in, apagado por defecto, por carpeta)**: ver "Guardia de identidad" más abajo — un hook de Git (`pre-commit` y `pre-push`) que bloquea el commit/push si la identidad real no coincide con la cuenta fijada a esa carpeta, más una notificación de Dossier con **Aplicar** (refijar la carpeta a la cuenta usada) / **Bloquear** (dejar todo como está) / **Reconectar** (si se eligió Bloquear, reescribe la identidad y la credencial de la cuenta fijada, por si el desajuste era un dato corrupto, no una cuenta distinta a propósito).

### Guardia de identidad (detalle del punto 12)

Decisión tomada en conversación con el usuario, después de comparar dos diseños:

- **Descartado:** el hook espera en vivo una decisión interactiva de Dossier antes de terminar. Se descarta a propósito — un hook nunca debería depender de que una app externa esté corriendo y conteste a tiempo (así es como fallan Husky/commitlint cuando se arman mal); si Dossier está cerrado, tarda, o hay un problema de comunicación, el commit queda colgado por una razón que no tiene nada que ver con la identidad.
- **Elegido:** el hook decide solo y rápido, con lo que ya tiene guardado (`rules.json`) — no necesita que Dossier esté corriendo. Si hay desajuste, el commit/push se corta ahí mismo, con un mensaje en la propia terminal que explica qué pasó y qué hacer (sirve incluso si Dossier está cerrado). La notificación de Dossier es un aviso aparte, no el mecanismo que bloquea — si Dossier está abierto, avisa al toque; si no, el usuario lo ve la próxima vez que abre la app.
- Corre en **dos momentos**, no uno: `pre-commit` (feedback rápido) y `pre-push` (red de contención para un commit que llegó por otro lado — un IDE, un cherry-pick — y nunca pasó por `pre-commit`).
- Si la carpeta ya tiene un hook (`.git/hooks/pre-commit` ya existe, p. ej. de Husky), Dossier **no lo pisa**: lo detecta y avisa, no lo reemplaza a ciegas.
- Ninguna de las tres acciones (Aplicar/Bloquear/Reconectar) pasa sola — todas necesitan un clic explícito. Dossier nunca decide por el usuario.
- **Límite honesto, documentado, no escondido:** sigue siendo un hook local — se puede saltar con `git commit --no-verify` o borrando el archivo. Si se necesita una barrera que de verdad no se pueda saltear, eso ya no lo resuelve una app de escritorio: lo resuelven las reglas de protección de rama del lado de GitHub/GitLab (servidor), fuera del alcance de Dossier (`docs/product.md` §1, sin backend).

## Qué NO cambia / queda fuera

- **Host de GitLab editable después de vincular**: decisión explícita del usuario — el dominio queda fijo una vez vinculada la cuenta; si hace falta otro host, se vincula de nuevo. No se agrega ninguna pantalla para esto.
- **Detección real de GCM** ("GCM detectado y usable, con estado claro cuando falte", `docs/product.md` §Alcance, sin marcar): este change reutiliza la aproximación ya construida (hay cuentas vinculadas = sincronizado), no construye el chequeo real contra el sistema. Si se quiere la detección real, es su propio change.
- **Firmado, instalador o auto-actualización**: fuera de alcance, son sus propios ítems de roadmap (`docs/product.md` §Alcance, Fase 6).
- **Renombrar o eliminar una cuenta vinculada**: viven en la tarjeta de la cuenta, en la pantalla principal (`AccountCard.tsx`, botón "×" ya dibujado y deshabilitado) — no en Ajustes.
- **Quick Clone en sí** (el flujo de clonar con progreso, `docs/product.md` §3.3): sigue siendo su propio change; acá solo se decide su carpeta por defecto y el aislamiento de cuenta, no se construye el flujo de clonado.
- **Diagnóstico completo de "Doctor"** (validar que Git resuelve bien la identidad dentro de cada repo): el punto 10 de acá es solo limpieza de GCM, no el Doctor completo.

## Riesgos

- **Inicio con el sistema mal configurado puede dejar la app arrancando sola sin que el usuario lo recuerde haber pedido**: por eso el interruptor debe reflejar siempre el estado real que devuelve `app.getLoginItemSettings()`, nunca un valor solo guardado en `settings.json` que pueda desincronizarse de lo que Windows tiene registrado.
- **Tema "según el sistema" mal implementado dejaría colores mezclados** (parte de la UI en un tema, parte en otro) si no se aplica una sola fuente de verdad (un atributo en `<html>`, nunca estilos sueltos por componente).
- **Escribir la clave de firma automáticamente puede firmar un commit con la clave equivocada** si la carpeta activa cambia entre que se lee y se escribe la configuración — por eso el ajuste del punto 7 queda apagado por defecto y solo actúa sobre la carpeta que ya resolvió `includeIf` en ese momento, nunca una lista cacheada.
- **Borrar una credencial "huérfana" de GCM que en realidad usa otra herramienta** (no Dossier) dejaría a esa herramienta sin poder autenticarse. El punto 10 solo debe ofrecer borrar entradas que Dossier reconoce como propias (mismo patrón `host + username` que ya guarda en `accounts.json`), nunca un barrido genérico de todo lo que GCM tenga guardado.
- **El menú de la bandeja (punto 11) queda desactualizado** si se reconstruye solo al abrir la app: hay que reconstruirlo cada vez que `setSettings` cambia algo, no una sola vez al iniciar.
- **La guardia de identidad (punto 12) podría interpretarse como "Dossier bloquea tus commits sin avisar por qué"** si el mensaje del hook no es claro, o como "Dossier rompió mi Husky" si pisa un hook existente — por eso el mensaje en la terminal es obligatorio (no solo un código de salida) y detectar un hook existente es obligatorio antes de instalar el propio.

## Criterio de éxito

- Cambiar el tema desde Ajustes y ver toda la pantalla principal reflejarlo al instante, sin reiniciar la app.
- Activar "Inicio con el sistema", cerrar y volver a abrir Windows (o verificarlo con `app.getLoginItemSettings()` sin reiniciar de verdad), y confirmar que Dossier queda registrado para arrancar solo.
- Cambiar el tema desde el menú del clic derecho de la bandeja y verlo reflejado también si se abre la ventana después.
- Asignar una carpeta a una cuenta desde Ajustes y confirmar que `includeIf` la toma (mismo criterio que ya usan los tests de `core/features/gitconfig`).
- Con la guardia de identidad activada en una carpeta fijada: intentar un commit con otra cuenta y ver que se corta, con un mensaje claro en la terminal; elegir "Aplicar" y confirmar que el mismo commit ahora sí pasa; forzar un desajuste de credencial y confirmar que "Reconectar" lo arregla.
- Con un `pre-commit` de Husky ya puesto en una carpeta: activar la guardia ahí y confirmar que Dossier avisa en vez de reemplazarlo.
- `pnpm typecheck && pnpm lint && pnpm test` en verde.
