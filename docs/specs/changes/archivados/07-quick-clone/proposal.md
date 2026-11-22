# Proposal — Quick Clone

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de credenciales/GCM e `includeIf`. Revisión obligatoria en sesión separada antes de mergear.

## Por qué

`docs/product.md` §3.3 ya define Quick Clone (Fase 4) como la siguiente fase, con un sketch de 5 pasos. Hoy clonar un repo y fijarlo a una cuenta son dos pasos manuales separados y en el orden que no corresponde: cloná vos mismo con `git clone`, después abrís el diálogo de la cuenta y fijás la carpeta ya creada. Quick Clone los une en uno: elegís cuenta → carpeta destino → URL, y Dossier clona usando la credencial correcta y deja la carpeta fijada, sin un paso intermedio donde el repo ya existe pero todavía no tiene identidad asignada.

El botón "Clonar repositorio" en la pantalla principal (`AddButtons.tsx`) ya existe, deshabilitado con el tooltip "Próximamente" desde que se construyó la pantalla principal — este change es lo que hay detrás de ese botón.

## Qué cambia

1. **`core/features/clone/`** (nuevo): `cloneRepo(url, destPath, account)` — clona con `simple-git` (ya es dependencia, sin usar todavía), fijando `credential.<host>.username=<login>` **solo para esa invocación** (nunca el config global ni el de la cuenta activa), para que GCM resuelva el token de la cuenta elegida, no la que esté activa en ese momento.
2. **Validación de URL** antes de pasarla a Git: solo `https://`, y el host tiene que coincidir con el de alguna cuenta vinculada (si no hay ninguna cuenta de ese host, no se puede elegir — ver "Qué NO cambia"). Rechaza cualquier URL que no empiece exactamente con `https://` (en particular, nunca algo que arranque con `-`, que `git` podría interpretar como un flag).
3. **Diálogo "Clonar repositorio"** (`renderer`, mismo patrón visual que `GithubLinkDialog`/`AccountFoldersDialog`): URL → cuenta (preseleccionada si solo hay una del host que coincide, a elegir si hay más de una) → carpeta destino (`pickFolder`, ya existe) → clonar, con estado de progreso simple (clonando / listo / error — no una barra con porcentaje exacto, ver "Qué NO cambia").
4. **Auto-Pin al terminar con éxito**: reutiliza `rulesStore.pin` + `writeAccountProfile` + `renderIncludeIfBlock`/`updateRegion` (los cuatro ya existen, `core/features/rules`+`core/features/gitconfig`+`core/features/identity`) — mismo camino que fijar una carpeta a mano desde `AccountFoldersDialog`, no uno nuevo.
5. **Chequeo de solapamiento antes de clonar, no después**: `rulesStore.pin` ya lanza `FolderOverlapError` si la carpeta se solapa con una ya fijada — ese chequeo se hace **antes** de lanzar el clone, para no terminar con un repo clonado en disco que no se puede fijar.
6. **IPC `cloneRepo`**: emite progreso por evento (mismo patrón que `githubVerification` — el renderer se suscribe, no hace polling).
7. Habilitar el botón "Clonar repositorio" en `AddButtons.tsx` (hoy `disabled`).

## Qué NO cambia / queda fuera

- **Preferencias globales de carpeta por defecto o aislamiento de cuenta al clonar**: decisión ya tomada y revertida en `docs/specs/changes/archivados/05-ajustes/` — Quick Clone pregunta todo en el momento (cuenta, carpeta), no depende de una preferencia guardada.
- **Clonar sin ninguna cuenta vinculada de ese host**: si no hay ninguna cuenta de GitHub/GitLab con el host de la URL, Quick Clone no ofrece esa URL como clonable — vincular la cuenta primero sigue siendo un paso separado, este change no lo reemplaza.
- **Activar la guardia de identidad (S11, `05-ajustes`) automáticamente en la carpeta recién clonada**: sigue apagada por defecto, igual que al fijar una carpeta a mano — el usuario la prende después si quiere, desde el mismo diálogo de siempre.
- **Progreso con porcentaje exacto de objetos/bytes**: alcanza con tres estados (clonando / listo / error); `simple-git` expone eventos de progreso de Git pero no siempre son consistentes entre versiones — no vale la complejidad de intentar un % preciso para esta primera versión.
- **Clonar por SSH**: el proyecto entero asume HTTPS + GCM (`docs/adr/0004`); SSH queda fuera de alcance, como en el resto de la app.
- **Repos privados de un host que la cuenta vinculada no puede ver** (sin permiso): Quick Clone intenta clonar con la credencial de la cuenta elegida; si Git rechaza por permisos, se informa el error tal cual lo da Git, no se intenta adivinar ni reintentar con otra cuenta.

## Riesgos

- **Inyección de flags vía la URL**: `simple-git` invoca `git` sin pasar por una shell (no hay interpolación de shell), pero una URL que empiece con `-` todavía podría interpretarse como un flag de `git clone` en vez de un argumento posicional — la validación (punto 2) rechaza cualquier URL que no empiece literalmente con `https://`, lo que ya descarta esto.
- **El token termina en la URL remota o en el historial de comandos**: nunca — se sigue el mismo patrón ya usado en todo el proyecto, `credential.<host>.username` + GCM resuelve el `fill` solo, la URL que se le pasa a `git clone` nunca lleva `user:token@`.
- **Clonar en una carpeta no vacía o ya un repo Git**: `git clone` ya falla solo en ese caso con un mensaje claro — Quick Clone no necesita revalidar esto, solo no debe fijar la regla si el clone no terminó con éxito.
- **Dejar un repo a medio clonar más una regla fijada, si el proceso se corta a la mitad**: Auto-Pin (punto 4) corre **después** de que `simple-git` confirma éxito, nunca en paralelo ni antes.
- **Elegir la cuenta equivocada sin darse cuenta** (si el diálogo preselecciona mal): si hay más de una cuenta del mismo host, no se preselecciona ninguna — el usuario tiene que elegir a propósito, igual que ya exige `AccountFoldersDialog` cuando hay más de una cuenta.

## Criterio de éxito

- Clonar un repositorio público real por HTTPS, eligiendo una cuenta vinculada y una carpeta vacía: termina con el repo clonado, funcional (`git log`/`git remote -v` dentro de esa carpeta resuelven bien), y la carpeta aparece fijada a esa cuenta en su diálogo de carpetas.
- Intentar clonar hacia una carpeta que ya está fijada a otra cuenta: se rechaza con el mismo mensaje de `FolderOverlapError`, antes de iniciar el clone — no queda ningún repo a medio clonar en esa carpeta.
- Intentar clonar con una URL que no sea `https://` (p. ej. `ssh://...` o una ruta local): se rechaza antes de llegar a Git.
- Clonar con una cuenta cuya credencial ya no es válida en GCM: Git devuelve el error de autenticación, se muestra tal cual, y no queda ninguna regla fijada a medias.
- `pnpm typecheck && pnpm lint && pnpm test` en verde.
