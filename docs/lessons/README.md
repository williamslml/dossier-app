# Lecciones aprendidas

Registro **manual** (sin orquestador, esta es la fuente de verdad): solo lo **no obvio**, cuando algo cuesta, se repite o sorprende durante el desarrollo. No es un diario de trabajo; si no te sirve a ti en 3 meses o a otra sesión de agente, no va aquí.

## Formato

```markdown
# <título corto>

Aplica cuando: <situación concreta en la que esta lección es relevante>

<qué se descubrió, qué hacer distinto la próxima vez>
```

---

# `includeIf` necesita rutas con `/`, no `\`, incluso en Windows

Aplica cuando: construyas el patrón de un `includeIf "gitdir/i:<patrón>"` a partir de una ruta real del sistema de archivos en Windows.

`path.join`/`mkdtempSync` devuelven rutas con `\` en Windows. Git exige `/` en el patrón de `gitdir` — con `\` el match falla **en silencio** (no hay error, simplemente `includeIf` nunca se activa). Normalizar con `.split('\\').join('/')` dentro de la función que escribe el `includeIf` (no dejarlo como responsabilidad del llamador): lo descubrió el propio test de `includeif.ts` al fallar la primera vez con un `undefined` sin pista aparente.

# `simple-git` necesita opciones específicas para rutas de config "no seguras", y `config --get` de una clave inexistente no rechaza

Aplica cuando: uses `simple-git` con `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` (necesario para aislar tests de `git config`), o leas `git config --get` de una clave que puede no existir.

1. `simple-git` bloquea `GIT_CONFIG_GLOBAL` y rutas de config "no seguras" por defecto (protección razonable). Para habilitarlo: `simpleGit({ unsafe: { allowUnsafeConfigPaths: true } })` — **anidado bajo `unsafe`**, no como opción de primer nivel (el mensaje de error no lo deja claro).
2. `git config --get <clave-inexistente>` sale con código 1 y sin salida en git real, pero `simple-git` lo resuelve como **éxito con cadena vacía** (no como rechazo) — confirmado comparando contra `execFileSync` directo. Cualquier código que use `simple-git` para leer `config --get` debe tratar `''` como "no configurado", igual que `undefined`, o se arriesga a interpretar un valor vacío como un valor real.

---

# GCM hace un _probe_ de red cuando `fill` no encuentra credencial cacheada

Aplica cuando: diseñes cualquier lógica que llame `git credential fill` para decidir si una cuenta está vinculada, o para construir el "Doctor"/estado de credenciales (`docs/adr/0007-frontend.md` §icono de bandeja, `docs/adr/0006-seguridad.md`).

Confirmado en Windows real (Git for Windows + GCM): si `fill` encuentra una credencial cacheada que coincide (`protocol`+`host`+`username`), la devuelve directo, sin red (verificado: R3.1–R3.4 con host `.invalid`, sin red, resuelve igual). Pero si **no** hay coincidencia (nunca se guardó, o se hizo `reject`), GCM no simplemente devuelve vacío: intenta **autodetectar el proveedor del host sondeándolo por red** (`failed to probe '<host>' to detect provider`, ver `https://aka.ms/gcm/autodetect`). Contra un host que no resuelve, eso falla con **exit 128** (error de red), no con una salida vacía — `fill` hay que tratarlo como "puede fallar" en vez de "siempre devuelve algo o nada", y distinguir en el código "no vinculado" de "fallo de red al intentar vincular" (son estados de UI distintos: el primero invita a vincular, el segundo es un error transitorio). Para hosts reales ya conocidos por GCM (github.com, gitlab.com) esto no debería ser un problema en uso normal (hay red); importa sobre todo para tests/Doctor offline y para no interpretar un error 128 como "cuenta sin vincular" sin más.

`GIT_TERMINAL_PROMPT=0` sigue funcionando correctamente en este caso: el proceso nunca se queda colgado esperando input, falla rápido (~1-3s, bien dentro del timeout) — confirma R3.5 en espíritu, aunque la aserción original del test (“siempre resuelve”) estaba mal planteada.

---

# `electron-vite` 6 exige fijar el target a mano para Electron 45, y el preload sale `.mjs`

Aplica cuando: configures `electron.vite.config.ts` con Electron ≥45 (o cualquier versión que el mapa interno de la herramienta no conozca todavía), con `"type": "module"` en `package.json`.

1. El mapa interno de `electron-vite` 6.0.0 solo llega a Electron 44 (ya anotado en `docs/adr/0003-stack-fundacional-y-sin-backend.md` como motivo para no confiar en la detección automática): sin fijar `build.target` a mano en `main`/`preload`/`renderer`, no hay garantía de qué target real usa. Confirmado: fijar `node24.22`/`chrome156` explícito en las 3 secciones de `electron.vite.config.ts` compila sin error.
2. Con `"type": "module"` en `package.json`, el preload se emite como `index.mjs`, no `index.js` — si el main process referencia `../preload/index.js` a mano (copiando el nombre típico de ejemplos CJS), la ventana carga pero sin preload, y el error es silencioso hasta que se intenta usar `contextBridge`. Verificar el nombre real en `out/preload/` tras el build, no asumirlo.
3. `electron` (el paquete, no `electron-vite`) descarga su binario real en un script de instalación que `pnpm` 12 puede omitir sin listarlo en `Ignored build scripts` (a diferencia de `esbuild`, que sí se lista): si `node_modules/electron/dist/` no existe tras `pnpm install`, correr `node node_modules/electron/install.js` a mano antes de intentar arrancar.

---

# `exactOptionalPropertyTypes`/`noUncheckedIndexedAccess` exigen más que "opcional"

Aplica cuando: pases una opción `cwd?: string` a una librería de terceros (ej. `conf`), o accedas a `array[index]` tras un `findIndex`, con `tsconfig.json` en modo estricto real (no solo `strict: true`).

1. Con `exactOptionalPropertyTypes: true`, `{ cwd: valorQuePuedeSerUndefined }` **no** es lo mismo que omitir la clave — si el tipo del tercero declara `cwd?: string` (sin `| undefined` explícito), pasar `cwd: undefined` falla el tipo. Hay que construir el objeto condicionalmente (`...(valor ? { cwd: valor } : {})`) en vez de asignar `undefined` directo.
2. Con `noUncheckedIndexedAccess: true`, `array[index]` siempre es `T | undefined`, aunque ya se haya validado `index !== -1` con `findIndex` en la línea anterior — TypeScript no conecta esa validación con el acceso posterior. Hay que volver a comprobar explícitamente (`const existing = arr[index]; if (!existing) ...`) antes de usarlo, aunque en la práctica sea inalcanzable.

Ambos casos aparecieron construyendo `core/features/accounts/accounts.ts` (M2) — ninguno es un bug real, son el modo estricto haciendo su trabajo, pero el mensaje de error de TS no siempre deja obvio cuál de las dos reglas es la causa.

---

# `includeIf` necesita la ruta REAL — y en Windows eso incluye los alias 8.3, no solo symlinks

Aplica cuando: construyas un patrón de `includeIf "gitdir/i:<patrón>"` a partir de una ruta de la que no controlás si pasa por un symlink/junction o por un alias de nombre corto de Windows — en particular, cualquier ruta bajo `os.tmpdir()`.

Encontrado en CI (GitHub Actions): el test de `includeIf` (R4) pasaba en local y fallaba en `windows-latest` y `macos-latest`, pero no en `ubuntu-latest`. Dos causas distintas, confirmadas con diagnóstico en el propio log de CI:

1. **macOS**: `os.tmpdir()` ahí resuelve a través de un symlink (`/var/...` es symlink de `/private/var/...`).
2. **Windows**: `os.tmpdir()` en el runner de GitHub Actions devolvía el alias de nombre corto 8.3 del usuario (`C:\Users\RUNNER~1\...`), pero `git rev-parse --absolute-git-dir` reportaba el nombre largo real (`C:\Users\runneradmin\...`) — confirmado imprimiendo ambos en el log de CI.

Git resuelve el `gitdir` por su ruta **canónica** al hacer el match de `includeIf`; un patrón construido con la ruta sin resolver no matchea, en silencio, sin error — para ninguno de los dos casos.

**La trampa:** `fs.realpathSync()` (la versión JS pura de Node) resuelve (1) pero **no** resuelve (2) en Windows — confirmado comparándolo contra un alias 8.3 real localmente (`fs.realpathSync('C:\Users\2510TK~1')` devuelve la misma ruta corta, sin cambios). Hace falta `fs.realpathSync.native`, que usa la API nativa de Windows (`GetFinalPathNameByHandle`) y resuelve ambos casos.

Reproducible en **cualquier máquina**, sin depender de que el runner tenga esa condición: (1) crear una carpeta real + una junction que apunte a ella (`fs.symlinkSync(real, link, 'junction')`, sin privilegios de administrador); (2) en Windows, obtener el alias 8.3 de una carpeta con `cmd /c "for %I in (...) do @echo %~sI"` y usarlo en vez del nombre largo. Ambos casos tienen test en `gitconfig.test.ts`.

Fix: `realpathSync.native()` sobre la ruta **antes** de normalizar las barras, dentro de `writeIncludeIf` (no responsabilidad del llamador) — mismo principio que ya se aplicó para `\` vs `/`: la función que escribe el `includeIf` es quien garantiza que el patrón coincide con lo que Git va a comparar, no cada sitio que la llama.

---

# GCM parece resolver la identidad real para `github.com`, no confiar ciegamente en el `username` de `approve`

Aplica cuando: diseñes o depures cualquier lógica que dependa de `credential.<host>.username` para distinguir cuentas en un host que GCM reconoce nativamente (GitHub, y probablemente Bitbucket/Azure DevOps) — distinto de un host genérico/desconocido como el `.invalid` usado en el spike.

Verificación en vivo (Device Flow real, cuenta real `williamslml`, Fase 2): ya existía una credencial real para `github.com` (de uso normal del usuario, antes del test). Se probó `approve`→`fill` con dos `username` distintos (el login real, y `x-access-token`) usando el mismo token OAuth nuevo:

- Con el login real (`williamslml`): `approve` no lanzó error, `fill` devolvió un token con formato válido (40 caracteres, prefijo reconocido) — pero no se pudo confirmar si era el token nuevo o el que ya existía antes (no se persistió el valor nuevo en ningún lado para comparar, por diseño).
- Con `username=x-access-token`: `approve` no lanzó error, pero el `fill` posterior **no encontró nada** bajo ese username exacto (falló igual que "credencial inexistente", no como "token distinto").
- Tras ambos intentos, el Credential Manager seguía mostrando una única entrada para `github.com`, con usuario `williamslml` (nunca apareció `x-access-token`).

**Hipótesis más coherente con estos tres hechos** (no 100% confirmada: requeriría más pruebas con una segunda cuenta real para aislarla del todo): para hosts que reconoce nativamente, GCM no usa el `username` que le pasás en `approve` como clave de almacenamiento literal — resuelve/valida la identidad real del token (vía la API del proveedor) y guarda bajo esa identidad real, sin importar qué string le hayas pasado. Por eso `x-access-token` "desapareció": nunca se guardó nada bajo ese nombre literal.

**Consecuencia para el diseño (confirma lo que `core/features/providers/github` ya hace):** usar siempre el `login` real de GitHub como `username` — nunca `x-access-token` —, tanto para `git credential approve` como para `credential.github.com.username` en el `includeIf` generado. Resuelve la decisión abierta de `docs/product.md` §7 sobre `x-access-token`: **no hace falta, se usa el login real.**

**Verificación de que nada se rompió:** `git ls-remote` contra un repo privado real devolvió los refs correctamente sin pedir credenciales — la credencial de `github.com` del usuario sigue operativa después del test, se haya sobrescrito o no.

---

# El renderer nunca debe importar `core` directamente — solo a través de `preload`

Aplica cuando: un componente del renderer necesite un tipo (`Account`, etc.) que `core` también usa.

Importar `brand` (un valor real, no solo un tipo) desde `core/index.ts` en `App.tsx` arrastró al bundle del renderer todo el grafo de `core` — incluidos `simple-git`, `conf`, `child_process`, `fs` — porque `core/index.ts` es un único barril con todo. Vite lo detectó y los externalizó ("Module externalized for browser compatibility"), pero en producción esos módulos Node no existen en un renderer con `sandbox: true`/`nodeIntegration: false` (ADR 0006): hubiera crasheado en runtime, no en build. El bundle pasó de 156KB/222 módulos a 29.8KB/30 al sacar esa única línea.

Incluso los `import type { Account } from 'core/index.ts'` (que sí se borran en compilación con `verbatimModuleSyntax`) son un acoplamiento conceptual de más: el renderer no debería saber que `core` existe. Fix: `preload/index.ts` reexporta los tipos que el renderer necesita (`export type { Account }`); el renderer los importa de ahí, nunca de `core` directo — ni siquiera como tipo. Cualquier dato que el renderer necesite de `core` (como `brand.displayName`) viaja por IPC dentro del `getState()` normal, no por un import aparte.

# `new URL(...).pathname` rompe en Windows para rutas de archivo reales; usar `fileURLToPath`

Aplica cuando: conviertas una `file://` URL (p. ej. `import.meta.url` + una ruta relativa) a una ruta de sistema de archivos real, en Windows.

`new URL('../preload/index.mjs', import.meta.url).pathname` da `/C:/Users/.../index.mjs` — con una barra inicial que Windows no entiende como ruta válida. Lo que sí funciona (y es exactamente para esto) es `fileURLToPath()` de `node:url`. Si lo que se necesita es la URL en sí (como el `index` de `electron-menubar`, que acepta un `file://`), no hay que convertir nada: `new URL(relativo, import.meta.url).href` ya es la URL correcta, porque `import.meta.url` ya es `file://`.

# `electron-menubar` sin `icon` explícito cae a un `__dirname` que no existe en ESM

Aplica cuando: uses `electron-menubar` (u otra librería con una ruta de icono "por defecto") en un proyecto `"type": "module"` (ESM).

Sin pasar la opción `icon`, `electron-menubar` intenta `dir + 'IconTemplate.png'`; si no existe, cae a un `path.join(__dirname, ...)` interno de la propia librería — pero `__dirname` no existe en módulos ESM, y el main de este proyecto se compila como ESM (`"type": "module"`). Resultado: `ReferenceError: __dirname is not defined`, no un error de icono faltante. Fix: pasar siempre un `icon` explícito cuya ruta exista de verdad (evita por completo esa rama de código de la librería). Se generó un ícono placeholder mínimo (16×16, PNG construido a mano con `zlib`, sin librerías de imágenes) hasta que exista el ícono real de marca (ADR 0005, paso manual pendiente).

**Vuelve a aparecer si la ruta "existe en código" pero no en el build empaquetado.** Pasar un `icon` explícito en `src/main/index.ts` (vía `fileURLToPath(new URL('../../resources/app-icon.ico', import.meta.url))`) no alcanza por sí solo: `electron-builder.yml` solo empaquetaba `out/**/*` dentro del `.asar` — `resources/` (donde vive el ícono real) nunca llegaba. En modo dev la ruta resuelve bien (corre contra el árbol de fuentes real); en un build **empaquetado** (nunca probado hasta que se armó el pipeline de release — `08-release-pipeline`) el archivo no está, `fs.existsSync` da falso, y se cae exactamente a la rama rota de arriba. Fix: agregar `resources/**/*` a los `files` de `electron-builder.yml`. Lección de fondo: "pasar una ruta que existe" hay que verificarlo contra el **build real que se va a distribuir**, no solo contra el árbol de fuentes en dev.

# `electron-menubar`: `after-create-window` ya ocurre con la URL cargada; para enganchar `did-finish-load` hay que usar `before-load`

Aplica cuando: quieras detectar si el renderer cargó bien, usando los eventos de `electron-menubar`.

El evento `after-create-window` de la librería se dispara **después** de que `loadURL` ya corrió — enganchar `did-finish-load` ahí llega tarde casi siempre (la carga de un archivo local es casi instantánea). Hay que escuchar en `before-load` (ventana ya creada, `loadURL` todavía no se llamó) para no perderse el evento. Además, `electron-menubar` crea la `BrowserWindow` de forma perezosa, solo al mostrarla (`showWindow()`) — para una verificación headless automatizada hay que forzar `showWindow()`, no alcanza con esperar a que la bandeja esté lista.

---

# `verify.sh` de SFP: en Windows, Python puede reportar un campo como "vacío" sin estarlo

Aplica cuando: se corre cualquier script de la skill `spec-first-protocol` que lee `.sfp/manifest.json` con Python (no `jq`), en Windows.

`mget` (en `lib.sh`) usa `print()` de Python para devolver el valor de un campo. Si ese valor tiene un carácter fuera de ASCII (en nuestro caso, `→` dentro de `structure.rationale`) y la consola de Python no está en modo UTF-8 (el default en Windows suele ser `cp1252`), `print()` lanza `UnicodeEncodeError`, el proceso termina con error antes de imprimir nada, y `mget` devuelve una cadena vacía sin ningún aviso — `verify.sh` lo reporta como "AVISO: structure.rationale vacío", aunque el campo tiene contenido real. Fix: correr estos scripts con `PYTHONUTF8=1` por delante (mismo patrón que ya usa `integrations.json` para el `undo` de `rtk`). No es un problema del manifiesto ni hay que vaciar los campos de evitar tildes/flechas para "ser compatibles" — es un bug de codificación del entorno, se soluciona con la variable de entorno.

# El campo `verify_command` del manifiesto debe ser _solo_ el comando, nada de prosa

Aplica cuando: se escribe o edita `structure.verify_command` en `.sfp/manifest.json`.

Quedó guardado como `"pnpm typecheck && pnpm lint && pnpm test (ya existen; perfil feature-first por ADR 0001)"` — la aclaración entre paréntesis viajó pegada al comando. `verify.sh --run-verify` ejecuta ese string literal con `sh -c`, así que la paréntesis rompe la sintaxis y el chequeo falla con un error que no tiene nada que ver con el proyecto. Cualquier nota explicativa sobre un campo ejecutable va en otro lado (un comentario fuera del JSON, o el texto que acompaña al ítem en el plan/reporte), nunca concatenada al valor que un script va a correr tal cual.

---

# Commitear directo a `main` sin ramas no es lo que pedía la metodología — fue un error repetido, no una convención

Aplica cuando: se empieza a implementar un cambio no trivial en un proyecto con `spec-first-protocol` instalado.

Desde la Fase 0 hasta la Fase 3 (parte 1), todos los cambios se commitearon directo a `main`, sin abrir ninguna rama. `CLAUDE.md` sí documentaba una convención de nombres de rama (`tipo/efecto-en-pocas-palabras`) y el proyecto tiene instalada la skill `finishing-a-development-branch` (pensada exactamente para cerrar una rama con merge/PR) — ambas cosas no tendrían sentido si el flujo real fuera siempre commitear directo a `main`. La confusión: la pregunta 25 de la entrevista de instalación (`interview.md`) es sobre la **granularidad del commit** (por bloque, uno solo, o ninguno) — "el agente commitea directo sin pedir aprobación por cada commit" responde esa pregunta, pero no dice nada sobre si hay que abrir una rama. Son dos decisiones separadas (`references/git-practices.md` sección 2 de la skill). Corregido en `CLAUDE.md`: ahora separa expresamente "usar una rama para cambios no triviales" de "la granularidad del commit dentro de esa rama".

---

# Nunca aprobar/rechazar credenciales de prueba contra un host real (ni siquiera `github.com`) en un test

Aplica cuando: se escribe un test que llama a `runGitCredential('approve'/'fill', ...)`, directo o a través de `core/features/link-account`.

Un test de `linkGithubAccount` que usaba el host real `github.com` (hardcodeado dentro de la función, correcto en producción) con un token de prueba falso falló con `git credential fill` código 128 ("unable to get password from user") — confirma en la práctica el hallazgo ya anotado más arriba: GCM trata distinto a los hosts que reconoce nativamente, y un token falso contra `github.com` no se comporta como contra un host reservado `.invalid`. Fix: cualquier prueba que ejercite el guardado/verificación real en GCM usa siempre un host reservado inventado (`algo.invalid`, nunca resuelve por DNS) — nunca un host real, ni siquiera de pasada o con datos de prueba. Para probar una función que **internamente** fija un host real (como `linkGithubAccount` con `'github.com'`), se le inyecta también un `gitCredential` falso: esa prueba solo verifica el cableado (qué host usa, qué datos pasa), no el guardado real en GCM — eso ya lo cubre `saveLinkedAccount` contra un host reservado, por separado.

---

# `window.dossier` nunca existió: el preload con `sandbox: true` no admite ES modules, y falla en silencio total

Aplica cuando: se usa `sandbox: true` (ADR 0006) en un proyecto que es ESM en todas partes (`"type": "module"`, ADR 0003).

**Esto estuvo roto desde que se construyó Fase 3 (parte 1)** y nadie lo notó: ni las capturas de pantalla (la app "se veía bien" porque el estado inicial por defecto — "Sin cuenta activa", área vacía — es indistinguible a simple vista del estado real cuando falla), ni `electron-log` (`renderer cargó sin error` se sigue imprimiendo igual: la _página_ carga bien, es el _preload_ el que no), ni `did-fail-load` (ese evento es de la navegación de la página, no del preload).

La causa real: un preload sandboxed (`sandbox: true`) en Electron **no puede usar `import`/`export`**, sin importar la extensión del archivo (`.mjs` no alcanza) — es una limitación documentada de Electron, no un bug de build. El error real (`Unable to load preload script... SyntaxError: Cannot use import statement outside a module`) solo aparece en la consola de DevTools del propio proceso, en un evento (`preload-error`) que la app no escuchaba.

Fix:

1. `electron.vite.config.ts`: forzar el build del preload a CommonJS real, con extensión `.cjs` explícita para no depender del `"type": "module"` del `package.json` raíz (`rollupOptions.output.format: 'cjs'`, `entryFileNames: '[name].cjs'`).
2. `src/main/index.ts`: escuchar `webContents.on('preload-error', ...)` y avisar (log + notificación) — sin esto, una futura rotura del preload volvería a quedar invisible.

Cómo se encontró: recién al intentar automatizar un clic real con CDP (protocolo de depuración de Chrome) y revisar la consola del proceso directamente — ninguna de las verificaciones visuales anteriores (capturas de pantalla, `pnpm test`, `pnpm build`, arranque headless) lo hubiera detectado, porque ninguna ejercita de verdad una llamada a `window.dossier` end-to-end.

---

# `fill` justo después de `approve` puede fallar una vez para hosts que GCM reconoce nativamente — aunque el token sí quedó guardado

Aplica cuando: se llama `approve` seguido de `fill` para el mismo host/usuario, en código (no a mano en una terminal), contra un host real que GCM reconoce (`github.com`).

Con una cuenta de GitHub real recién autorizada por Device Flow, `saveLinkedAccount` guardaba el token con `approve` y fallaba al verificarlo con `fill` (`git credential fill salió con código 128: fatal: unable to get password from user`) — pero el Administrador de Credenciales de Windows (`cmdkey /list`, sin exponer el secreto) mostraba que la entrada `git:https://github.com` con el usuario correcto **sí existía**. No era un problema de identidad (ya resuelto antes, ver la lección de arriba): es una carrera transitoria de GCM al encadenar `approve`→`fill` muy rápido en código, que no aparece si hay una pausa natural (como al probarlo a mano en una terminal, que es como se validó en la Fase 2). Fix: reintentar `fill` un par de veces con una pausa corta antes de rendirse (`fillWithRetry` en `core/features/link-account/link-account.ts`).

---

# `git credential fill` falla para github.com aunque la credencial esté guardada — hay que hablar directo con el binario de GCM

Aplica cuando: `approve`+`fill` guardan bien el token (confirmado en el Administrador de Credenciales) pero `fill` sigue fallando con "fatal: unable to get password from user" (código 128) para un host como `github.com`, incluso reintentando.

Investigando con el usuario (`cmdkey /list` mostró la credencial correcta; una prueba manual de `git credential fill` en una terminal mostró que lo que realmente pasa es que Git for Windows intenta abrir **el diálogo gráfico de contraseña** — nuestra app lo tiene bien deshabilitado, así que en vez de preguntar, falla), se probaron **tres hipótesis en orden**, dos descartadas antes de llegar a la real:

1. **Descartada:** `-c credential.https://github.com.provider=generic` / variable de entorno `GCM_PROVIDER=generic` (pensando que GCM usa un proveedor específico de GitHub que ignora el almacén genérico). Probado con datos descartables contra `github.com` real (nunca con el token real del usuario), en las dos variantes — ninguna cambió el resultado.
2. **Descartada:** sembrar el token con `git credential-manager github login --username <login> --token <token> --no-ui` (el comando propio del proveedor de GitHub) en vez de `approve`. Confirmado que la cuenta quedaba bien registrada (`git credential-manager github list` la mostraba) — pero `git credential fill` **seguía fallando igual** después. El problema no era la falta de registro.
3. **La causa real:** el problema no es el almacén ni el proveedor — es que `git credential fill` (el **despachador genérico** de git hacia el credential helper configurado) no resuelve bien para `github.com`, sin importar qué haya guardado. En cambio, invocar el binario de GCM **directo**, sin pasar por ese despachador (`git credential-manager get`), sí funciona — confirmado con datos de prueba contra un host reservado (`store`→`get`→`erase`, los tres con éxito).

**Fix real:** `core/features/git-credential` ya no llama a `git credential <acción>` — llama directo a `git credential-manager <acción nativa>` (`approve`→`store`, `fill`→`get`, `reject`→`erase`), mismo protocolo por `stdin`, para **cualquier** host, sin caso especial para GitHub. Esto además mejoró la seguridad: ya no hace falta pasar el token como argumento de línea de comandos (como exigía la hipótesis 2) — todo sigue yendo por `stdin`.

**Para la próxima vez:** cuando una hipótesis "suena razonable" (como la del proveedor específico) pero no se puede probar con el caso real, conviene buscar primero si hay una forma de invocar el mecanismo subyacente **más directamente** (menos capas intermedias) antes de ir a buscar una API alternativa — el despachador genérico de git resultó ser la capa rota, no GCM en sí.

---

# Un valor con backslashes de Windows pegado como texto suelto en un archivo de Git config rompe el parseo

Aplica cuando: se arma a mano (concatenación de texto, no `git config --file ... key value`) cualquier línea que vaya a un archivo `.gitconfig`, con una ruta real de Windows como valor.

`ensureActiveInclude` (el `[include] path = …` de la cuenta activa, `core/features/gitconfig/region.ts`) armaba la línea con la ruta de Windows tal cual (`C:\Users\...`), pegada directo al texto. Git interpreta `\` dentro de un valor de config como inicio de una secuencia de escape — `\U` (de `\Users`) no es una secuencia válida, y el archivo entero falla con `fatal: bad config line`. `writeIncludeIf` ya evitaba este mismo problema para el patrón de `gitdir` (normaliza a `/` antes de escribir), pero `ensureActiveInclude` se escribió después y no reutilizó ese criterio — se encontró recién con un test de integración real (`region.test.ts`), no con un test que solo comparaba texto esperado. Fix: cualquier ruta de Windows que se inserte como texto suelto en un archivo de config (no a través de `git config --file`, que sí escapa solo) tiene que normalizarse a `/` primero — mismo criterio en todo el módulo, no uno distinto por función.

# `git config --file` no crea el directorio padre, y un archivo global inexistente hace fallar `--show-origin` (no devuelve vacío)

Aplica cuando: se escribe un archivo de perfil nuevo dentro de una carpeta que todavía no existe (`core/features/identity`), o se resuelve la ruta real del config global de una instalación nueva de Git (`src/main/identity.ts`).

Dos hallazgos del mismo tipo, en la misma sesión: (1) `git config --file <ruta>/profiles/<id>.gitconfig key value` falla con "No such file or directory" si `profiles/` no existe — Git no crea directorios intermedios, solo el archivo final; hay que `mkdirSync(dirname(profilePath), { recursive: true })` antes de escribir, en `writeAccountProfile` **y** en `setActiveAccount` (el `dataDir` mismo tampoco se puede asumir que ya existe). (2) `git config --global --list --show-origin` contra un `GIT_CONFIG_GLOBAL` que apunta a un archivo que ni siquiera existe todavía (máquina nueva, primera vez que corre Dossier) no devuelve una lista vacía — falla con "unable to read config file". Los dos casos (archivo vacío sin ninguna clave, y archivo inexistente) necesitan el mismo manejo (forzar la creación con una escritura sentinela), pero son fallos distintos y hay que probar los dos por separado — un test que solo cubre "vacío" no prueba "inexistente".

---

# Un test que cuenta entradas del directorio temporal del sistema para probar "no quedó nada residual" es inestable bajo ejecución en paralelo

Aplica cuando: se quiere verificar que una función limpia sus archivos temporales (`mkdtempSync`/`rmSync` en un `finally`), contando cuántas entradas con cierto prefijo hay en `os.tmpdir()` antes y después de llamarla.

`renderIncludeIfBlock` limpia bien su directorio descartable (confirmado leyendo el código: `rmSync` dentro de un `finally`), pero un test que comparaba el conteo de entradas de `tmpdir()` antes/después fallaba de forma intermitente corriendo la suite completa (pasó, falló, pasó en tres corridas seguidas) — nunca en aislamiento. Causa: `tmpdir()` es un recurso **global compartido** con cualquier otro archivo de test corriendo en paralelo (Vitest corre archivos de test en paralelo por defecto); otro test creando/borrando su propio directorio temporal en el medio corre la carrera y desbalancea el conteo, sin que haya ningún bug real. Fix: se quitó el test — la garantía ya es verificable leyendo las 6 líneas de la función, y un conteo de un recurso ambiente que ningún test puede aislar de verdad no prueba nada que la lectura del código no pruebe ya, y encima mete inestabilidad real a la suite.

---

# `git credential-manager --help` no siempre devuelve salida capturable; el binario real está en `mingw64/bin/`, no en el PATH directo

Aplica cuando: se necesita inspeccionar la superficie real de comandos de GCM (qué subcomandos tiene, si alguno lista cuentas guardadas) en vez de asumirlo de memoria/documentación.

`git credential-manager --help` (invocado así, como subcomando de `git`) no devolvió salida capturable en varios intentos (ni por `Bash`, ni redirigiendo stdout/stderr explícitamente con `Start-Process` de PowerShell) — sin error, pero tampoco contenido. La causa no se investigó a fondo (podría ser cómo ese binario concreto escribe a la consola bajo ciertos entornos no interactivos), pero el fix fue más simple: invocar el ejecutable real directo, encontrado buscando dentro de la instalación de Git (`(Get-Command git).Source`, subir dos carpetas, `Get-ChildItem -Recurse -Filter "git-credential-manager*"` → `mingw64/bin/git-credential-manager.exe`) en vez de depender del despachador `git <subcomando>`. Con el binario real, `--help` sí respondió con el árbol completo de comandos.

**Hallazgo real de ese árbol** (no documentado de forma clara en ningún lado encontrado por búsqueda web): los comandos de nivel superior son `get`/`store`/`erase`/`configure`/`unconfigure`/`diagnose`, más dos grupos específicos de proveedor, `azure-repos` y `github` — **no hay un "listar todo" genérico**. Pero `github list` sí existe ("List all known GitHub accounts"), y `azure-repos list <organization>` también — el patrón es que **solo los proveedores con un grupo de comandos propio** tienen listado; GitLab (que usa el almacén genérico, sin su propio grupo) no tiene equivalente. Para cualquier diseño que necesite "qué cuentas tiene GCM guardadas", hay que verificar primero si el proveedor en cuestión tiene su propio grupo de comandos — no asumir ni que todos lo tienen, ni que ninguno lo tiene.

---

# `electron-menubar` oculta la ventana sola al perder el foco — choca con un botón de "Minimizar" propio

Aplica cuando: se agrega un botón de minimizar (u otro control de ventana estándar) a una app armada con `electron-menubar` u otra librería de menú desplegable/bandeja.

El usuario probó la app real y reportó: "le di click a minimizar y lo sacó del taskbar" — lo opuesto a minimizar (que debería dejarla en la barra de tareas). La causa no apareció en ningún test, porque los tests y las llamadas sintéticas por CDP no siempre disparan un evento `blur` real de la ventana — la causa solo se vio probando con clics reales. `electron-menubar` tiene `hideOnBlur` activado por defecto (pensado para que el menú desplegable se cierre solo al hacer clic afuera, su comportamiento típico), y minimizar una ventana también le hace perder el foco — así que apenas se minimizaba, la propia librería la ocultaba por completo, encima de haberla minimizado, dejándola sin ningún rastro en la barra de tareas. Fix: `hideOnBlur: false` en las opciones de `menubar(...)` — a cambio, la ventana ya no se cierra sola al hacer clic afuera (el usuario lo prefirió así: "por algo en todas las aplicaciones existe el minimizar y el botón x", quiere que cada botón haga lo suyo, como cualquier app normal).

**Para la próxima vez:** cuando se agregan controles de ventana "normales" (minimizar, maximizar) a una librería pensada para comportarse como un menú desplegable, revisar primero qué comportamiento "automático" trae esa librería por defecto (ocultarse al perder el foco, ocultarse al hacer clic afuera, etc.) — puede chocar con lo que un control estándar espera, y el choque no se nota en ningún test automatizado si ese test no dispara el evento real que lo dispara (acá, `blur`).

---

# Un ícono de bandeja que "se ve chico" casi nunca es un problema de tamaño — Windows usa el mismo cajón para todos

Aplica cuando: alguien compara el ícono de la bandeja de la app con el de otra app y dice que "se ve más chico" o "hay que agrandarlo".

El usuario comparó el ícono de Dossier con el de otra app (Serena) en la bandeja real y pidió agrandarlo. Antes de tocar nada más, se midió la captura real píxel por píxel (`sharp`, buscando el bounding box de contenido no-fondo de cada ícono): los dos ocupaban **exactamente 16×16 píxeles**, en la misma posición vertical — idénticos. Windows le da a todos los íconos de la bandeja el mismo cajón fijo; ninguna app puede hacer el suyo más grande que el de al lado, sin importar la resolución del archivo que se le pase.

Lo que se percibía como "más chico" era densidad/contraste de color: un ícono de color sólido (naranja saturado) pesa mucho más al ojo, en el mismo cajón de 16px, que uno monocromo de trazo fino sobre fondo oscuro — sin que ninguno de los dos sea literalmente más grande. Además, agrandar el glifo dentro del círculo (probado primero, con un 78-82% de llenado) empeoró la lectura en vez de mejorarla: el glifo se comía el círculo y el conjunto se veía más apretado, no más fuerte. Lo que sí ayudó, dentro de un ícono monocromo: que el círculo de fondo llegue de borde a borde del lienzo (sin margen) y el glifo quede chico y limpio adentro (~50% de llenado) — la forma que debe pesar es el círculo (la masa grande), no el trazo.

**Para la próxima vez:** si un ícono "se ve chico" al lado de otro en un contexto de tamaño fijo (bandeja de Windows, favicon, badge), medir primero el tamaño real en la captura (bounding box de contenido) antes de asumir que hace falta agrandar algo — casi siempre el tamaño en píxeles ya es igual, y el problema real es peso visual (color/contraste/llenado), que no se arregla agrandando el dibujo adentro de una forma de tamaño fijo.

---

# Scaffolding de prueba dejado "a propósito" en un menú de producción se vuelve ruido confuso apenas el evento real existe

Aplica cuando: se agrega un ítem de prueba/debug a una UI real (no a una pantalla de desarrollo separada) con la intención de sacarlo "cuando exista el flujo real".

Un ítem "Probar notificación" en el menú de la bandeja (con un comentario explícito: "se mantiene hasta que un change futuro lo conecte a un evento real") quedó ahí durante varios changes, después de que el evento real (notificar al vincular una cuenta) ya existiera — nadie volvió a esa nota para sacarlo. El usuario lo marcó como parte de "la UI de la bandeja está confusa" sin señalarlo puntualmente; apareció al revisar el código del menú con ese lente.

**Para la próxima vez:** un comentario que dice "dejar esto hasta que pase X" es una tarea pendiente sin dueño ni fecha — se pierde fácil entre specs distintas. Mejor: anotarlo como ítem de `tasks.md` del change que agrega el evento real ("sacar el ítem de prueba de tal menú"), no solo como comentario en el código.

---

# Un hook de Git generado a mano necesita el shebang como primera línea literal, antes que cualquier otra cosa

Aplica cuando: se genera un script (hook de Git, u otro archivo que Git/el sistema operativo ejecuta vía shebang) agregándole una marca propia al principio para identificarlo después.

Al generar el script de un hook (`pre-commit`) con una marca propia (`# dossier:identity-guard v1`) **antes** de `#!/bin/sh`, Git en Windows fallaba al ejecutar el commit con `error: cannot spawn .git/hooks/pre-commit: No such file or directory` — un mensaje que no menciona nada sobre shebangs, lo que lo hace confuso. La causa: el shebang solo funciona como primera línea _literal_ del archivo (primeros dos bytes `#!`); cualquier cosa antes (aunque sea un comentario válido) rompe la detección del intérprete, y el sistema no sabe con qué ejecutar el script. Se encontró corriendo el hook contra un repo real (`mkdtempSync` + `git init` + commit real) — un test que solo revisara el contenido del script como string no lo habría detectado.

**Para la próxima vez:** cualquier marca/comentario propio en un archivo ejecutable por shebang va **después** de la línea `#!...`, nunca antes. Y en general: un script generado para ser ejecutado por otro programa (no solo leído) necesita al menos un test de integración que lo ejecute de verdad, no solo que compare su contenido.

---

# Un valor "grabado" dentro de un artefacto generado (no releído del store) necesita regenerarse en _cada_ camino que cambie ese valor, no solo en el que lo crea

Aplica cuando: se genera un archivo ejecutable (un hook, un script, una config) que incluye un valor copiado en el momento de generarlo, en vez de leerlo en vivo de donde vive la fuente de verdad.

El hook de `pre-commit`/`pre-push` de la guardia de identidad (S11) graba el email esperado como texto literal en el script al instalarlo (no puede leer `rules.json` en cada commit, es un script de shell). La acción "Aplicar" de un conflicto reasignaba la regla a la cuenta correcta (`rulesStore.pin`) pero nunca volvía a instalar el hook — como `pin()` preserva la guardia activada al reasignar cuenta, el hook seguía ahí, comparando contra el email _viejo_. El mismo commit que "Aplicar" decía resolver se seguía cortando. Lo encontró una revisión en sesión separada (agente sin el historial de la sesión que implementó), no los tests: la ruta de "reasignar cuenta a una carpeta ya con la guardia activa" no la ejercitaba ningún test ni la verificación en vivo (que sí probó instalar/desinstalar, pero no reasignar).

**Para la próxima vez:** cuando un valor queda "horneado" dentro de un artefacto generado en vez de leerse en vivo, listar **todos** los caminos que pueden cambiar ese valor (no solo el que instala por primera vez) y confirmar que cada uno regenera el artefacto — un test de "cambié el valor por este otro camino, ¿el artefacto lo refleja?" habría encontrado esto antes que una revisión manual.

---

# Un paquete CommonJS puede pasar `tsc` con un import nombrado bajo ESM y aun así fallar en tiempo de ejecución

Aplica cuando: se agrega una dependencia nueva a un proyecto que corre como ESM (`"type": "module"`), sobre todo si es más vieja o no declara exports duales (ESM+CJS) en su `package.json`.

`import { autoUpdater } from 'electron-updater'` tipaba bien y compilaba sin error (TypeScript, con los `@types` del paquete, no distingue si el runtime real va a aceptar esa forma) pero falló al arrancar la app real: "Named export 'autoUpdater' not found. The requested module 'electron-updater' is a CommonJS module...". Solo apareció probando en vivo (`electron .`), ningún `tsc`/test lo iba a atrapar, porque el problema es de interop ESM↔CJS en tiempo de ejecución de Node/Electron, no de tipos. Fix: `import pkg from 'electron-updater'; const { autoUpdater } = pkg` (el mensaje de error de Node ya sugiere exactamente esto).

**Para la próxima vez:** agregar una dependencia nueva y usarla con `import { algo } from 'paquete'` no es suficiente verificación si el proyecto corre bajo ESM — hace falta levantar la app de verdad al menos una vez después de agregarla, antes de dar por buena la integración, sobre todo con paquetes que no son explícitamente "ESM-first". `tsc` en verde no prueba que el módulo cargue en tiempo de ejecución.

---

# `electron-builder --publish` usa la versión de `package.json` para nombrar la release, no el tag que disparó el workflow — y puede crearla dos veces por una carrera interna

Aplica cuando: se arma un workflow de release con `electron-builder --publish` hacia GitHub Releases, disparado por un tag de git.

Empujando un tag de prueba real (no una suposición) contra el repo real, aparecieron dos problemas en los logs del propio run: (1) con `package.json` en una versión distinta al tag empujado, `electron-builder` no encontró ninguna release que correspondiera al tag y creó una **"untagged"** nueva en su lugar — arma el nombre/versión de la release a partir de `package.json`, nunca lee el tag de git real; (2) `--publish always` sube cada artefacto con su propio "publisher" en paralelo, y cada uno decide por su cuenta si la release ya existe — se vieron literalmente dos líneas de log `"creating GitHub release"` para el mismo tag, en el mismo segundo: cada publisher pensó que tenía que crearla.

**Para la próxima vez:** si hace falta que la release coincida exactamente con el tag que disparó el workflow, derivar la versión del tag (`${GITHUB_REF_NAME#v}`) y escribirla directo en `package.json` del checkout temporal con `npm pkg set version=...` — **no** con el flag `-c.extraMetadata.version=...` de `electron-builder`: en un runner de Windows, donde el shell por default es PowerShell (no bash), ese flag se parsea distinto y `electron-builder` lo confunde con un path de config inexistente. Y para evitar que publique solo: pasar `--publish never` explícito — ni "omitir `--publish`" ni "no incluir el flag" alcanza, porque `electron-builder` tiene un default de "implicit publishing" que publica igual cuando detecta un tag de git con `GH_TOKEN` presente (lo loguea como advertencia, y lo va a quitar en su v27, pero hasta entonces publica solo si no se lo prohíbe explícitamente). Con `--publish never`, crear la release + subir los artefactos en un solo paso atómico con `gh release create` (que no paraleliza su propia subida de archivos, a diferencia del publisher interno de `electron-builder`).

Un último detalle, encontrado probando el ciclo completo con una instancia vieja real (no alcanza con revisar que la release quede bien formada): si se suben los artefactos con `gh release create` en vez del publisher propio de `electron-builder`, hay que renombrarlos primero reemplazando espacios por guiones (`Dossier Setup X.exe` → `Dossier-Setup-X.exe`). GitHub reemplaza los espacios por **puntos** al subir un asset, pero `latest.yml` (que arma `electron-builder`) y `electron-updater` esperan **guiones** — con el nombre original, `electron-updater` detecta la actualización bien pero la descarga del instalador falla con 404 porque busca un nombre que no coincide con el que GitHub generó.

---

# `GIT_TERMINAL_PROMPT=0` no alcanza solo para que Git nunca pida credenciales de forma interactiva — GCM tiene su propio interruptor aparte

Aplica cuando: se invoca `git` (clone, fetch, push, lo que sea que pueda necesitar autenticación) y hace falta que nunca quede esperando una respuesta interactiva.

Al construir `cloneRepo` (07-quick-clone) se asumió que `GIT_TERMINAL_PROMPT=0` (ya usado en `core/features/git-credential` para `approve`/`fill`/`reject`) alcanzaba para que nunca quedara colgado esperando un prompt. Un test real (clonar contra un host sin credencial cacheada) se colgó igual 20 segundos — ese env var apaga el prompt de *Git*, pero el prompt de *GCM* (su propia ventana/CLI interactivo cuando no puede resolver la credencial en silencio) lo controlan dos config aparte: `credential.interactive=false` y `credential.guiPrompt=false`. `docs/adr/0004-modelo-de-credenciales-e-identidad.md` ya documentaba las tres juntas como la receta completa (punto 3) — se habían implementado las tres para `git-credential.ts`, pero al escribir código nuevo que también invoca Git con necesidad de credenciales, se copió solo la primera.

**Para la próxima vez:** cualquier invocación nueva de `git` que pueda necesitar una credencial (clone, fetch, push, lo que sea) necesita las tres, no solo `GIT_TERMINAL_PROMPT=0` — y conviene *probarlo* contra un caso real que fuerce el prompt (un host sin credencial cacheada), no asumir que alcanza porque "ya se usa en otro lado del proyecto". Un ADR que ya documenta la receta completa no sirve si el código nuevo solo copia una parte de memoria.

---

# El plugin de seguridad de `simple-git` bloquea `EDITOR` si se le pasa el `process.env` completo vía `.env(...)`

Aplica cuando: se usa `simple-git` y hace falta agregar una variable de entorno a la invocación (p. ej. `GIT_TERMINAL_PROMPT=0`).

Llamar `.env({ ...process.env, GIT_TERMINAL_PROMPT: '0' })` (para agregar una variable sin perder el resto del entorno heredado) disparó el error "Use of 'EDITOR' is not permitted without enabling allowUnsafeEditor" — un plugin de seguridad propio de `simple-git` que revisa el objeto pasado a `.env(...)` y bloquea si contiene `EDITOR` (común en cualquier shell de desarrollo), para evitar que una operación de Git intente abrir un editor interactivo sin que el código lo espere. No hace falta pelear contra esto ni habilitar `allowUnsafeEditor`: usar la sobrecarga de un solo par clave/valor (`.env('GIT_TERMINAL_PROMPT', '0')`) evita el chequeo por completo — `simple-git` ya hereda `process.env` del proceso padre por sí solo, no hace falta spreadearlo a mano.

## Promoción a la carpeta global (`~/sfp/`)

Una lección solo sube a `~/sfp/` si es recurrente (guía: ~3 apariciones **independientes**, no solo releída 3 veces), general, aplicable a otros proyectos además de este, de coste razonable y validada por ti. Nunca de forma automática por un agente.
