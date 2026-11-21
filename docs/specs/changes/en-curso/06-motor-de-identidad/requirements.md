# Requirements — Motor de identidad

## M1 — Región delimitada (`core/features/gitconfig`, ampliación)

- **M1.1** La región se delimita con `# ${brand.gitConfigMarker}:start` / `# ${brand.gitConfigMarker}:end` (el campo `gitConfigMarker` de `core/features/brand` ya existe con el valor `'dossier'`, sin usarse todavía — este change es su primer consumidor).
- **M1.2** Al escribir (fijar una carpeta, cambiar la cuenta activa), si la región ya existe: se extrae tal cual (todo lo de adentro, sin reinterpretar cada línea salvo lo que se esté agregando/quitando), se separa el resto del archivo, y se vuelve a escribir con la región al final — lo ajeno al marcador nunca se toca ni se reordena.
- **M1.3** Si la región no existe todavía: se crea al final del archivo, con el `[include]` de `active.gitconfig` como primera línea.
- **M1.4** Orden interno de la región: primero el `[include]` de `active.gitconfig`, después un bloque `[includeIf "gitdir/i:…"]` por carpeta fijada. **No hace falta ordenar por especificidad de ruta**: `FolderOverlapError` (`core/features/rules`, ya existente) ya impide que dos carpetas fijadas se solapen, así que nunca hay ambigüedad de cuál debería ganar — el orden de inserción (la más vieja primero) alcanza.

**Escenario verificable:** test con un archivo de config de prueba que ya tiene contenido ajeno antes y después de la región — fijar una carpeta nueva y confirmar que lo ajeno de antes y después de la región sigue intacto, y que la región (con la nueva entrada) quedó al final.

## M2 — Respaldo (`core/features/gitconfig`, ampliación)

- **M2.1** Antes de la primera escritura de Dossier sobre un config global dado, se copia tal cual a `<mismo-archivo>.dossier-backup` — solo si ese archivo de respaldo todavía no existe (nunca se pisa un respaldo ya hecho).

**Escenario verificable:** test que escribe algo al config de prueba dos veces seguidas y confirma que el respaldo se creó una sola vez, con el contenido de ANTES de la primera escritura.

## M3 — Resolver la ruta real del config global (`main`, nuevo)

- **M3.1** `main` (no `core`, porque implica ejecutar Git directamente contra el entorno real) resuelve la ruta real con `git config --global --list --show-origin`, tomando el prefijo `file:` de la primera línea — **verificado en esta máquina**, no asumido (ver `docs/lessons/README.md` si aplica anotar algo al implementar).
- **M3.2** Si el config global está completamente vacío (máquina nueva, ninguna clave global configurada todavía): no hay ninguna línea de la que tomar el origen. Se fuerza su creación escribiendo una clave sentinela (`git config --global <marcador>.initialized true`) y se vuelve a preguntar.

**Escenario verificable:** test de integración (no unitario) contra un `HOME`/`GIT_CONFIG_GLOBAL` de prueba aislado — confirmar que devuelve la ruta correcta tanto con contenido previo como completamente vacío.

## M4 — Perfil por cuenta y cuenta activa (`core`, nueva orquestación)

- **M4.1** `getProfilePath(dataDir, accountId)` → `<dataDir>/profiles/<accountId>.gitconfig`. `getActiveConfigPath(dataDir)` → `<dataDir>/active.gitconfig`. `dataDir` lo resuelve `main` (no `core`, para no mezclar `core` con rutas de Electron) y se pasa como parámetro — mismo criterio que ya usan los stores con `cwd`.
- **M4.2** `writeAccountProfile(account: Account)`: llama `writeProfileConfig` (ya existe) con `user.name`, `user.email`, `credential.<host>.username=<account.username>`, `credential.<host>.useHttpPath=false`.
- **M4.3** `setActiveAccount(account: Account)`: escribe el perfil de esa cuenta en `active.gitconfig` (reutiliza M4.2 pero apuntando a ese archivo), y asegura que la región delimitada (M1) tenga su `[include]` apuntando ahí — solo necesita escribirse una vez en la vida de la instalación, no en cada cambio de cuenta (`active.gitconfig` ya es el archivo que cambia de contenido; el `[include]` que apunta a él no cambia).
- **M4.4** Escritura atómica (archivo temporal + rename) para `active.gitconfig` — igual que ya hace `conf` para los JSON, para que un cambio de cuenta a medio escribir nunca deje un `push` en curso con una identidad incompleta.

**Escenario verificable:** test de integración sobre un `dataDir`/config global de prueba — activar una cuenta, confirmar con `git config --get user.email` (en una carpeta sin fijar) que devuelve la de esa cuenta; activar otra, confirmar que cambió.

## M5 — Conectar `selectAccount` (`main`, IPC existente)

- **M5.1** El handler de `IPC.selectAccount` (ya existe, hoy solo llama `stateStore.setActiveId`) además llama `setActiveAccount` (M4.3) con la cuenta elegida.

## M6 — Fijar/desfijar carpeta (`main`, IPC nuevo + orquestación en `core`)

- **M6.1** `pinFolder(path, accountId)`: asegura el perfil de la cuenta (M4.2, si no existe todavía), llama `rulesStore.pin(path, accountId)` (ya existe, puede lanzar `FolderOverlapError`), y si no lanzó, agrega el `includeIf` dentro de la región (M1).
- **M6.2** `unpinFolder(path)`: llama `rulesStore.unpin(path)` (ya existe) y quita el `includeIf` correspondiente de la región.
- **M6.3** IPC nuevos en `main`: `pinFolder`, `unpinFolder`, `listPins` (lista `rulesStore.list()`) — subconjunto de `docs/product.md` §3.4.

**Escenario verificable:** test de integración — fijar una carpeta a una cuenta distinta de la activa, confirmar que esa carpeta resuelve su propia identidad (no la activa); desfijarla, confirmar que vuelve a resolver la activa (por el `[include]` de M4.3).

## Fuera de alcance de este change

Pantalla de "Carpetas fijadas", Quick Clone, clave de firma (GPG/SSH — queda en `05-ajustes`), Doctor — ver `proposal.md`.
