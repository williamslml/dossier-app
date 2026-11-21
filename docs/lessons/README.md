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

# `electron-menubar`: `after-create-window` ya ocurre con la URL cargada; para enganchar `did-finish-load` hay que usar `before-load`

Aplica cuando: quieras detectar si el renderer cargó bien, usando los eventos de `electron-menubar`.

El evento `after-create-window` de la librería se dispara **después** de que `loadURL` ya corrió — enganchar `did-finish-load` ahí llega tarde casi siempre (la carga de un archivo local es casi instantánea). Hay que escuchar en `before-load` (ventana ya creada, `loadURL` todavía no se llamó) para no perderse el evento. Además, `electron-menubar` crea la `BrowserWindow` de forma perezosa, solo al mostrarla (`showWindow()`) — para una verificación headless automatizada hay que forzar `showWindow()`, no alcanza con esperar a que la bandeja esté lista.

---

# `verify.sh` de SFP: en Windows, Python puede reportar un campo como "vacío" sin estarlo

Aplica cuando: se corre cualquier script de la skill `spec-first-protocol` que lee `.sfp/manifest.json` con Python (no `jq`), en Windows.

`mget` (en `lib.sh`) usa `print()` de Python para devolver el valor de un campo. Si ese valor tiene un carácter fuera de ASCII (en nuestro caso, `→` dentro de `structure.rationale`) y la consola de Python no está en modo UTF-8 (el default en Windows suele ser `cp1252`), `print()` lanza `UnicodeEncodeError`, el proceso termina con error antes de imprimir nada, y `mget` devuelve una cadena vacía sin ningún aviso — `verify.sh` lo reporta como "AVISO: structure.rationale vacío", aunque el campo tiene contenido real. Fix: correr estos scripts con `PYTHONUTF8=1` por delante (mismo patrón que ya usa `integrations.json` para el `undo` de `rtk`). No es un problema del manifiesto ni hay que vaciar los campos de evitar tildes/flechas para "ser compatibles" — es un bug de codificación del entorno, se soluciona con la variable de entorno.

# El campo `verify_command` del manifiesto debe ser *solo* el comando, nada de prosa

Aplica cuando: se escribe o edita `structure.verify_command` en `.sfp/manifest.json`.

Quedó guardado como `"pnpm typecheck && pnpm lint && pnpm test (ya existen; perfil feature-first por ADR 0001)"` — la aclaración entre paréntesis viajó pegada al comando. `verify.sh --run-verify` ejecuta ese string literal con `sh -c`, así que la paréntesis rompe la sintaxis y el chequeo falla con un error que no tiene nada que ver con el proyecto. Cualquier nota explicativa sobre un campo ejecutable va en otro lado (un comentario fuera del JSON, o el texto que acompaña al ítem en el plan/reporte), nunca concatenada al valor que un script va a correr tal cual.

## Promoción a la carpeta global (`~/sfp/`)

Una lección solo sube a `~/sfp/` si es recurrente (guía: ~3 apariciones **independientes**, no solo releída 3 veces), general, aplicable a otros proyectos además de este, de coste razonable y validada por ti. Nunca de forma automática por un agente.
