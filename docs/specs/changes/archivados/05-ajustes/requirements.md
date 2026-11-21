# Requirements — Ajustes

## S1 — `core/features/settings/` (guardado)

- **S1.1** `createSettingsStore()`: mismo patrón que `core/features/accounts` (`Conf`, `configName: 'settings'`), con valor por defecto `{ theme: 'sistema', launchAtStartup: false }`.
- **S1.2** Tipo `Settings`: `{ theme: 'claro' | 'oscuro' | 'sistema', launchAtStartup: boolean }`. Sin secretos ni datos de cuenta — ya viven en `accounts.json`/GCM.
- **S1.3** API: `get(): Settings` · `update(partial: Partial<Settings>): Settings` (fusiona con lo guardado, igual que `rename`/`remove` en `accounts.ts` leen-modifican-escriben).

**Escenario verificable:** test con `cwd` aislado (mismo patrón que `accounts.test.ts`) — crear el store, `update({ theme: 'oscuro' })`, confirmar que `get()` devuelve `theme: 'oscuro'` y conserva `launchAtStartup` sin tocar.

## S2 — IPC (`main`)

- **S2.1** `getSettings`: devuelve lo guardado en `S1`, pero **`launchAtStartup` siempre sale de `app.getLoginItemSettings().openAtLogin`**, nunca del valor guardado — evita que se desincronice del registro real de Windows (riesgo de `proposal.md`).
- **S2.2** `setSettings(partial)`: valida el payload con `zod` (`theme` en el enum de tres valores, `launchAtStartup` booleano, ambos opcionales). Si trae `launchAtStartup`, llama `app.setLoginItemSettings({ openAtLogin: valor })` **antes** de guardar en `S1` — si Electron lanza, no se guarda un estado que no es real. Si trae `theme`, además de guardar, fija `nativeTheme.themeSource` (ver S2.3).
- **S2.3** Al iniciar la app, `main` aplica `nativeTheme.themeSource = settings.theme` una vez con el valor guardado (traducido: `'sistema'` → `'system'`, `'claro'` → `'light'`, `'oscuro'` → `'dark'`), para que `nativeTheme.shouldUseDarkColors` sea correcto desde el primer render.
- **S2.4** Nuevo canal de **evento** `themeUpdated`: cuando `nativeTheme` emite `'updated'` (cambia el tema elegido o, en modo "sistema", cambia el tema de Windows), `main` reenvía `nativeTheme.shouldUseDarkColors` al renderer. Mismo patrón que `githubVerification` (change 04): el renderer se suscribe una vez al cargar.

**Escenario verificable:** test de los handlers con `app`/`nativeTheme` de Electron ya disponibles en el proceso de test (`vitest`, entorno `node`, mismo patrón que los demás tests de `main` si existen) o, si no es practicable sin una ventana real, test de `core/features/settings` solo (S1) más verificación manual documentada en `tasks.md` (igual que change 04 documentó qué quedaba sin probar automáticamente).

## S3 — Pantalla de Ajustes (`renderer`)

- **S3.1** El botón de engranaje de `TitleBar.tsx` deja de estar deshabilitado; al hacer clic, reemplaza el contenido de `App.tsx` por la vista de Ajustes (mismo patrón de "pantalla única" que ya usa la ventana — no una ventana nueva de Electron). Un botón "Volver" (flecha) en el lugar del engranaje regresa a la pantalla principal.
- **S3.2** Sección **Apariencia**: tres opciones (Claro / Oscuro / Según el sistema). Elegir una llama `setSettings({ theme })` y aplica el cambio de inmediato en esta misma ventana (sin esperar el evento `themeUpdated`, que es para cuando el cambio viene de fuera — Windows cambiando de tema en modo "sistema").
- **S3.3** Aplicación visual del tema: un atributo (`data-theme="claro" | "oscuro"`) en el elemento raíz del documento, nunca clases sueltas por componente — una sola fuente de verdad (riesgo de `proposal.md`).
- **S3.4** Sección **Inicio**: un interruptor "Abrir Dossier al iniciar Windows", reflejando siempre lo que devuelve `getSettings()` (que a su vez sale de Windows, no de un valor guardado — S2.1).
- **S3.5** Sección **Acerca de**: versión de la app (de `package.json`, ya expuesta o agregada al `DossierApi` si hace falta).
- **S3.6** Estado del gestor de credenciales: mismo texto/color que ya usa `Footer.tsx` ("Sincronizado" / "Esperando credencial"), mostrado de nuevo acá.

## S4 — Preload

- **S4.1** `DossierApi` gana `getSettings(): Promise<Settings>` · `setSettings(partial: Partial<Settings>): Promise<Settings>` · `onThemeUpdated(callback: (shouldUseDarkColors: boolean) => void): () => void`.

---

## Parte 2 (ampliación) — S5 a S10

## S5 — Reglas por carpeta desde Ajustes

**Depende de `docs/specs/changes/en-curso/06-motor-de-identidad/`**, que ya construyó toda la orquestación real (región delimitada, perfil por cuenta, IPC `pinFolder`/`unpinFolder`/`listPins`) — encontrado al empezar a diseñar esta misma sección: lo que acá se pensaba reutilizar como "ya existente" (`RulesStore.create`, `writeIncludeIf` conectado a cuentas) en realidad no estaba conectado en ningún lado todavía. Esta sección es **solo la UI**, sobre el IPC que `06-motor-de-identidad` ya expone.

- **S5.1** El acceso a `listPins`/`pinFolder`/`unpinFolder` (IPC ya existente, `06-motor-de-identidad`) vive en la pantalla principal, no en Ajustes: cada cuenta tiene un botón "Carpetas de esta cuenta" que abre `AccountFoldersDialog`, ya con la cuenta fijada — no se agrega lógica de dominio nueva acá, solo la pantalla. **Corregido tras feedback de uso real:** el diseño original ponía esto en Ajustes con "carpeta primero, cuenta después" (un desplegable); resultaba confuso porque el modelo mental natural es al revés — entrás desde la cuenta que ya estás viendo.
- **S5.2** El diálogo muestra las reglas de esa cuenta (`listPins` filtrado por `accountId`), cada una con su carpeta; agregar una carpeta abre el selector nativo de Windows (`pickFolder`) y la fija directo a la cuenta del diálogo — no hace falta elegir cuenta, ya se sabe cuál es.
- **S5.3** Crear una regla sobre una carpeta que ya se superpone con otra existente: `pinFolder` ya puede lanzar `FolderOverlapError` (`core/features/rules`, reutilizado por `06-motor-de-identidad`) — el diálogo solo necesita mostrar ese error con un mensaje claro, no reimplementar la validación.
- **S5.4** Este diálogo es un acceso más, no reemplaza ninguna pantalla "Carpetas fijadas" dedicada que se construya después (`docs/adr/0007-frontend.md`) — ambas llaman el mismo IPC.

**Escenario verificable:** test de integración IPC (o de la UI contra un `main` real de prueba) — crear una regla, listar, crear una que se superpone y confirmar el error — reutilizando los tests de integración que `06-motor-de-identidad` ya tiene para la parte de `core`.

## S6 — Alcance al cambiar de cuenta activa (clave de firma)

**También depende de `06-motor-de-identidad`**: `selectAccount` ya llama `setActiveAccount` (perfil real escrito en `active.gitconfig`) — esta sección solo agrega la clave de firma a ese mismo perfil, no construye el mecanismo de cuenta activa desde cero.

- **S6.1** Nuevo campo en `Settings`: `applySigningKeyOnSwitch: boolean` (por defecto `false` — ver riesgo de `proposal.md`).
- **S6.2** Cuando está en `true` y se llama `selectAccount(id)`: además de lo que `06-motor-de-identidad` ya hace (`setActiveAccount`), si la cuenta tiene una clave de firma asignada (ver S6.3), agrega `user.signingkey`/`gpg.format` al mismo perfil que `setActiveAccount` ya escribe (`writeAccountProfile`/`writeProfileConfig`, `core/features/identity` + `core/features/gitconfig`) — nunca en la configuración global, y nunca en `credential.*` (eso sigue siendo GCM, sin cambios).
- **S6.3** Una cuenta puede tener una clave de firma asignada (nuevo campo opcional en `Account`, o una tabla aparte `signing-keys.json` — decisión de diseño) — `gpg.format: 'openpgp' | 'ssh'`, y el identificador de la clave (ruta del archivo público para SSH, o key ID para GPG). **Nunca** se genera ni se importa una clave: Dossier solo referencia una que el usuario ya tiene.
- **S6.4** `gpg.format: 'ssh'` es exclusivamente para firmar (`commit.gpgsign`), nunca para el transporte remoto (`docs/product.md` §1) — este change no agrega ni un solo lugar donde Dossier arme una URL `git@host:`.

**Escenario verificable:** extensión de los tests de integración de `06-motor-de-identidad` (`core/features/identity/end-to-end.test.ts`) — con `applySigningKeyOnSwitch: true` y una cuenta con clave asignada, confirmar que `active.gitconfig` (o el perfil de la carpeta fijada) tiene `user.signingkey`/`gpg.format` correctos; con `false`, confirmar que no se toca.

## S7 — Comportamiento al clonar — revertido

**Decisión tomada al usar la app (no un bug):** esta sección proponía preparar `Settings` con una "carpeta de clonado por defecto" y un interruptor "aislar cuenta", para cuando exista Quick Clone. Se decidió en cambio que Quick Clone va a pedir la carpeta **y** la cuenta en el momento de clonar — mismo patrón que `AccountFoldersDialog` (S5) — así que no hace falta ninguna preferencia global. Se sacaron `defaultCloneFolder`/`isolateAccountOnClone` de `Settings`, del store del renderer y de Ajustes. Cuando se construya Quick Clone (fuera de alcance de este change), su propio diseño define cómo pide carpeta+cuenta.

## S8 — Integración con Windows, ampliada

- **S8.1** Documentar en la UI (texto, no código nuevo) que cerrar la ventana (`hideWindow`) la oculta en la bandeja del sistema, no en la barra de tareas, y no cierra la app — distinto de minimizar, que sí la manda a la barra de tareas como cualquier ventana — una sección informativa en Ajustes, sin interruptor (no hay nada que prenda/apague, ya es así siempre).
- **S8.2** Atajo de teclado global nuevo: `globalShortcut.register(...)` (Electron) para mostrar/ocultar la ventana. Combinación configurable, o fija para la primera versión (decisión de diseño) — si es fija, documentar cuál y por qué (evitar choques con atajos comunes de Windows/otras apps).
- **S8.3** El atajo se registra una vez al iniciar (`app.whenReady`/evento equivalente de `electron-menubar`) y se libera con `globalShortcut.unregisterAll()` al salir — Electron no lo hace solo.

**Escenario verificable:** verificación manual documentada en `tasks.md` (los atajos globales no son fáciles de probar con Vitest sin una ventana real) — mismo patrón que ya usó change 04 para lo que no se pudo automatizar.

## S9 — Mantenimiento de credenciales (limpieza, no Doctor completo)

**Verificado contra el binario real de GCM** (`git-credential-manager.exe --help`, ver design.md): no hay un listado genérico, pero `github list` sí existe (específico de GitHub) — GitLab y cualquier otro host no tienen equivalente.

- **S9.1** Para cuentas de **GitHub**: comparar `github list` (cuentas que GCM conoce) contra `accounts.json` (cuentas que Dossier conoce) — cualquier username que aparezca en GCM y no en `accounts.json` es huérfana real.
- **S9.2** Para cuentas de **GitLab** (y cualquier otro host): sin forma de listar — el alcance queda acotado a lo que `accounts.json` ya conoció y perdió al borrar una cuenta (se guarda `host`+`username` en vez de descartarlo del todo, igual que ya decidía la versión anterior de esta sección).
- **S9.3** Nunca lista ni ofrece borrar una entrada que no siga el patrón que Dossier reconoce (riesgo de `proposal.md`: no tocar credenciales de otras herramientas) — nunca un escaneo de `cmdkey /list` ni de ningún almacén fuera de lo que GCM/Dossier ya reconocen como propio.
- **S9.4** Borrar una entrada huérfana usa `runGitCredential('reject', ...)` (ya existe, `core/features/git-credential`) — no un camino nuevo.
- **S9.5** Confirmación explícita antes de borrar (no es una acción de un solo clic) — mismo criterio que cualquier borrado irreversible del proyecto.

**Escenario verificable:** test de `core/features/git-credential` con hosts reservados `.invalid` (mismo patrón que los tests existentes) para la parte de borrado; para `github list`, un test de parseo de su salida con datos de ejemplo (sin ejecutar contra la cuenta real de GitHub del usuario — sandbox de la sesión, correctamente, bloquea ese tipo de acceso).

## S10 — Menú del clic derecho en la bandeja

- **S10.1** El menú de contexto (`Menu.buildFromTemplate`, `src/main/index.ts`) agrega un submenú "Tema" con ítems `radio` (Claro/Oscuro/Según el sistema) y un ítem `checkbox` "Inicio con Windows", antes del separador de "Salir".
- **S10.2** El menú se reconstruye (`mb.tray?.setContextMenu(...)`) cada vez que `setSettings` cambia `theme` o `launchAtStartup`, sin importar si el cambio vino de la ventana o del menú mismo — una sola función que arma el menú a partir de `settingsStore.get()`, llamada desde los dos lugares.
- **S10.3** Elegir una opción desde el menú llama la misma lógica que `IPC.setSettings` (no un camino paralelo) — se factoriza la función que ya hace `setSettings` para que la pueda llamar tanto el handler de IPC como el `click` del menú.

**Escenario verificable:** test de la función compartida (sin IPC) que arma el menú a partir de un `Settings` dado, confirmando los ítems y su estado `checked` para cada combinación de tema.

## S11 — Guardia de identidad por carpeta (hooks de Git)

**Señal de alto riesgo** (`CLAUDE.md`): toca `includeIf`/identidad de commit. Revisión en sesión separada antes de mergear.

- **S11.1** Nuevo campo por regla en `rules.json` (o archivo aparte `identity-guard.json` — decisión de diseño): `enforced: boolean`, por defecto `false`. Se activa/desactiva desde `AccountFoldersDialog` (S5), junto a la carpeta a la que pertenece.
- **S11.2** Al activarse en una carpeta: Dossier escribe `.git/hooks/pre-commit` y `.git/hooks/pre-push` en **ese repo** (no en `core.hooksPath` global — cada repo pinned es independiente). Antes de escribir, revisa si el archivo ya existe y **no es el que Dossier puso** (sin una marca propia reconocible, p. ej. un comentario fijo al inicio del script) — si ya existe otro, no lo pisa, avisa en la UI.
- **S11.3** El script del hook (bash, portable vía Git Bash que ya trae Git para Windows) compara el email esperado contra la identidad real (`git config user.email` resuelto en ese momento) — si no coinciden, termina con código distinto de cero y un mensaje en texto plano explicando el desajuste y qué hacer, **sin** depender de que Dossier esté corriendo. **Decisión tomada al implementar** (diverge de la redacción original "lee... de `rules.json`"): el email esperado queda grabado como texto literal en el script al instalarlo, no se relee de `rules.json` en cada commit — el hook no puede invocar Node ni leer el store de Dossier, solo `sh`. Esto implica que **cualquier cambio de cuenta de una carpeta ya con la guardia activa tiene que reinstalar el hook** (ver S11.5, Aplicar) — de lo contrario queda comparando contra el email viejo.
- **S11.4** El hook, además, deja un registro de lo que pasó en un archivo que Dossier (si está corriendo, o la próxima vez que inicia) lee para mostrar la notificación — nunca espera una respuesta en vivo del hook (S11.3 ya terminó y devolvió el control a Git antes de que exista esa respuesta).
- **S11.5** Notificación de Dossier (una tarjeta en la pantalla principal, no un toast nativo de Windows — ver design.md) con tres acciones, **las tres visibles a la vez** (decisión tomada al implementar: ocultar "Reconectar" hasta elegir "Bloquear" exigía mantener el conflicto visible en la UI después de limpiarlo del lado de `main`, con estado local frágil — no vale la complejidad extra, y no cambia ninguna garantía real: las tres acciones siguen sin ocurrir sin un clic explícito):
  - **Aplicar**: busca la cuenta vinculada cuyo email coincide con la identidad real usada en el commit/push que disparó el conflicto, reasigna la regla de esa carpeta a esa cuenta (mismo camino que crear/editar una regla, S5); si la guardia seguía activa (`enforced`, que `pin` preserva al reasignar — ver rules.ts), **reinstala los hooks** con el nuevo email esperado (S11.3: el email queda grabado en el script, no se relee solo) antes de limpiar el registro de conflicto. Si ninguna cuenta vinculada tiene ese email, falla con un mensaje claro — no inventa ni crea una cuenta nueva.
  - **Bloquear**: no cambia nada (la regla sigue igual) — limpia el registro de conflicto sin tocar `rules.json`.
  - **Reconectar**: vuelve a escribir el perfil de la cuenta que la regla ya tiene asignada (no la que se usó en el commit fallido) y confirma que GCM todavía puede devolver su credencial (`fill`) — **no** re-autentica desde cero (no hay token en texto plano disponible en este punto para volver a hacer `approve`).
- **S11.6** Ninguna de las tres acciones ocurre sin un clic explícito del usuario (riesgo de `proposal.md`: Dossier nunca decide solo).

**Escenario verificable:** test de la función que compara identidad esperada vs. real y decide el código de salida (unidad, sin Git real); test de integración que instala el hook en un repo real temporal (`mkdtempSync` + `git init`), simula un commit con otro `user.email` y confirma que se corta con el mensaje esperado; confirma que si ya existe un `pre-commit` ajeno, no se sobreescribe.

## Fuera de alcance de este change

Host de GitLab editable, detección real de GCM, firmado/instalador, renombrar/eliminar cuenta, el flujo de Quick Clone en sí, el diagnóstico completo de "Doctor" — ver `proposal.md`.
