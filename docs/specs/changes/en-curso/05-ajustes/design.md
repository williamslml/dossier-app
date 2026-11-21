# Design — Ajustes

## `core/features/settings/`

Mismo molde que `core/features/accounts` (Conf, leer-modificar-escribir):

```ts
import Conf from 'conf'

export type Theme = 'claro' | 'oscuro' | 'sistema'

export interface Settings {
  theme: Theme
  launchAtStartup: boolean
}

export interface SettingsStore {
  get(): Settings
  update(partial: Partial<Settings>): Settings
}

const DEFAULTS: Settings = { theme: 'sistema', launchAtStartup: false }

export function createSettingsStore(options?: { cwd?: string }): SettingsStore {
  const conf = new Conf<Settings>({
    projectName: 'dossier',
    configName: 'settings',
    defaults: DEFAULTS,
    ...(options?.cwd ? { cwd: options.cwd } : {}),
  })

  return {
    get(): Settings {
      return { theme: conf.get('theme'), launchAtStartup: conf.get('launchAtStartup') }
    },
    update(partial: Partial<Settings>): Settings {
      if (partial.theme !== undefined) conf.set('theme', partial.theme)
      if (partial.launchAtStartup !== undefined) conf.set('launchAtStartup', partial.launchAtStartup)
      return this.get()
    },
  }
}
```

`launchAtStartup` sí se guarda acá (para no perder la preferencia si `app.setLoginItemSettings` fallara alguna vez), pero `main` nunca confía en este valor para _leer_ el estado real — ver abajo.

## `main` — traducción de tema y arranque con Windows

Implementado (`src/main/index.ts`) con una diferencia respecto al primer borrador: `getSettings`/`setSettings` también devuelven `shouldUseDarkColors` (el estado real que decide Electron, no algo que el renderer deba adivinar a partir del string de tema — necesario para modo "sistema"):

```ts
import { nativeTheme } from 'electron'

const THEME_SOURCE: Record<Theme, 'system' | 'light' | 'dark'> = {
  sistema: 'system',
  claro: 'light',
  oscuro: 'dark',
}

const settingsStore = createSettingsStore()
nativeTheme.themeSource = THEME_SOURCE[settingsStore.get().theme]

function getSettingsForRenderer() {
  return {
    ...settingsStore.get(),
    launchAtStartup: app.getLoginItemSettings().openAtLogin, // real, no el guardado
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  }
}

const setSettingsSchema = z.object({
  theme: z.enum(['claro', 'oscuro', 'sistema']).optional(),
  launchAtStartup: z.boolean().optional(),
})

ipcMain.handle(IPC.getSettings, () => getSettingsForRenderer())

ipcMain.handle(IPC.setSettings, (_event, payload: unknown) => {
  const partial = setSettingsSchema.parse(payload)
  if (partial.launchAtStartup !== undefined) {
    app.setLoginItemSettings({ openAtLogin: partial.launchAtStartup }) // si lanza, no se guarda
  }
  if (partial.theme !== undefined) {
    nativeTheme.themeSource = THEME_SOURCE[partial.theme]
  }
  settingsStore.update({
    ...(partial.theme !== undefined ? { theme: partial.theme } : {}),
    ...(partial.launchAtStartup !== undefined ? { launchAtStartup: partial.launchAtStartup } : {}),
  }) // exactOptionalPropertyTypes: nunca pasar `undefined` explícito
  return getSettingsForRenderer()
})

// S2.4 / S10.2: también dispara al reconstruir el menú de la bandeja (S10)
nativeTheme.on('updated', () => {
  mb.window?.webContents.send(IPC.themeUpdated, nativeTheme.shouldUseDarkColors)
})
```

`app.setLoginItemSettings` en Windows no lanza en los casos documentados por Electron; si en la práctica se descubre un caso real de fallo silencioso, se anota como lección (`docs/lessons/`), no se agrega manejo especulativo ahora.

## Renderer — vista en vez de ventana nueva

La ventana de Dossier es chica (estilo "menubar", `docs/adr/0007-frontend.md`) — Ajustes no abre una ventana de Electron nueva, reemplaza el contenido de `App.tsx` igual que ya hacen los diálogos de vincular cuenta, pero ocupando toda la pantalla en vez de un modal:

```tsx
// store.ts — un atom más
export const $screen = atom<'principal' | 'ajustes'>('principal')

// App.tsx
{screen === 'principal' ? <PantallaPrincipal /> : <Ajustes onVolver={() => $screen.set('principal')} />}
```

`TitleBar.tsx` cambia el ícono del botón de engranaje por una flecha cuando `screen === 'ajustes'`, y ya no queda `disabled`.

**Tema aplicado en CSS:** un atributo en `<html>`, no clases por componente:

```ts
document.documentElement.dataset.theme = shouldUseDarkColors ? 'oscuro' : 'claro'
```

`index.html` ya tiene sus colores como variables CSS en `:root` (confirmar al implementar si ya existen o hay que extraerlas primero — si el CSS actual tiene colores sueltos por selector en vez de variables, extraerlos es parte de este change, no un cambio aparte, porque sin eso no hay manera de tener un tema oscuro real). Bloque oscuro:

```css
:root[data-theme='oscuro'] {
  --bg: #0a0a0a;
  --fg: #ededed;
  /* … el resto de los tokens que ya use :root */
}
```

El valor inicial de `data-theme` sale de `getSettings()` al cargar (`loadState`, mismo lugar donde ya se pide `getState()`); los cambios posteriores, de elegir una opción en Ajustes (S3.2, aplicación inmediata) o del evento `themeUpdated` (cambio externo en modo "sistema").

## Preload

```ts
getSettings: () => ipcRenderer.invoke(IPC.getSettings),
setSettings: (partial: Partial<Settings>) => ipcRenderer.invoke(IPC.setSettings, partial),
onThemeUpdated: (callback: (dark: boolean) => void) => {
  const listener = (_event: unknown, dark: boolean) => callback(dark)
  ipcRenderer.on(IPC.themeUpdated, listener)
  return () => ipcRenderer.removeListener(IPC.themeUpdated, listener)
},
```

Mismo patrón que `onGithubVerification` (change 04) para la suscripción con des-suscripción.

## Decisión a confirmar al implementar (Parte 1)

Si `index.html` hoy no tiene los colores como variables CSS (`:root`), extraerlos es la primera tarea de `tasks.md` de este change, antes de poder construir el tema oscuro — se verifica leyendo el archivo actual al empezar a implementar, no se asume acá.

---

# Parte 2 (ampliación)

## S5 — Reglas por carpeta en Ajustes

**Ya construido en `06-motor-de-identidad`** (`main/index.ts`): `IPC.listPins`/`IPC.pinFolder`/`IPC.unpinFolder`, con `rulesStore.pin(path, accountId)` (no `.create` — nombre real de `RulesStore`), `writeAccountProfile` + `renderIncludeIfBlock` + `updateRegion` para la región delimitada. Acá solo falta:

1. `IPC.pickFolder` (no existe todavía en ningún change) — `dialog.showOpenDialog`.
2. Exponer `pinFolder`/`unpinFolder`/`listPins`/`pickFolder` en el preload (`DossierApi`) — `06-motor-de-identidad` los deja en `main`, pero no tocó `preload` (fuera de su alcance, sin UI que los necesitara todavía).
3. La pantalla en sí: **no vive en Ajustes.** `AccountCard.tsx` (pantalla principal) suma un botón "Carpetas de esta cuenta" por tarjeta, que abre `AccountFoldersDialog.tsx` (nuevo, modal — mismo patrón visual que `GithubLinkDialog`/`GitlabLinkDialog`) ya con la cuenta fijada: lista de sus carpetas + agregar (solo pide la carpeta, la cuenta ya se sabe) + mensaje claro si la promesa de `pinFolder` rechaza con `FolderOverlapError`. **Corregido tras feedback de uso real:** el diseño original ponía esto en Ajustes pidiendo primero la carpeta y después la cuenta (desplegable) — confundía, porque uno ya está viendo la cuenta cuando quiere agregarle una carpeta.

## S6 — Clave de firma al cambiar de cuenta

`Settings` gana `applySigningKeyOnSwitch: boolean`. La clave en sí **no** vive en `Settings` (es por cuenta, no global) — se agrega a `Account` (`core/features/accounts`) como campo opcional:

```ts
export interface Account {
  // … campos existentes
  signingKey?: { format: 'openpgp' | 'ssh'; keyId: string }
}
```

El handler de `IPC.selectAccount` ya existe (`06-motor-de-identidad`) y ya llama `setActiveAccount(dataDir, account)` — acá se amplía esa misma llamada, no se agrega un camino paralelo:

```ts
ipcMain.handle(IPC.selectAccount, async (_event, payload: unknown) => {
  const { id } = selectAccountSchema.parse(payload)
  stateStore.setActiveId(id)
  const account = accountsStore.list().find((a) => a.id === id)
  if (account) {
    await setActiveAccount(dataDir, account) // ya existe, 06-motor-de-identidad
    if (settingsStore.get().applySigningKeyOnSwitch && account.signingKey) {
      await writeSigningKey(dataDir, account) // nuevo acá, misma idea que writeAccountProfile
    }
  }
  return getState()
})
```

`writeSigningKey` agrega `user.signingkey`/`gpg.format` al **mismo** `active.gitconfig` que `setActiveAccount` ya escribe (`getActiveConfigPath(dataDir)`, `core/features/identity`) — nunca un archivo aparte, nunca `~/.gitconfig` global, nunca `credential.*`. Si la cuenta activa está, además, fijada a alguna carpeta propia (caso borde: la cuenta activa coincide con una cuenta fijada), ese perfil (`getProfilePath`) también necesitaría la clave — decisión a confirmar al implementar si eso hace falta para el criterio de éxito de `proposal.md`, o si alcanza con `active.gitconfig`.

## S7 — Comportamiento al clonar — revertido, ver requirements.md

## S8 — Atajo de teclado global

```ts
import { globalShortcut } from 'electron'

app.whenReady().then(() => {
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    mb.window ? mb.showWindow() : undefined
  })
})
app.on('will-quit', () => globalShortcut.unregisterAll())
```

Combinación fija (`Ctrl+Shift+D`, de "Dossier") para esta primera versión — configurable queda para un change futuro si hace falta (`docs/product.md`, decisión abierta). Elegida por ser poco común en otras apps de Windows/navegadores (a diferencia de `Ctrl+Shift+N`/`Ctrl+Shift+T`, muy usadas).

## S9 — Mantenimiento de credenciales

**Verificado contra el binario real** (`git-credential-manager.exe --help`, instalación real de Git for Windows en esta máquina — el primer intento con `git credential-manager --help` no devolvía salida capturable; el binario real está en `mingw64/bin/git-credential-manager.exe`, invocado directo): GCM **no** tiene un "listar todo" genérico — los comandos de nivel superior son `get`/`store`/`erase`/`configure`/`unconfigure`/`diagnose` más dos grupos específicos de proveedor (`azure-repos`, `github`). **Pero sí existe `github list`** ("List all known GitHub accounts") — listado real, solo para cuentas de GitHub. No hay equivalente para GitLab (usa el almacén genérico, sin un grupo de proveedor propio) ni para ningún otro host.

Esto cambia el diseño de S9: en vez de un único camino, son dos, según el proveedor:

```ts
// core/features/credential-maintenance/credential-maintenance.ts (nuevo)
import { runGitCredential } from '../git-credential/git-credential.ts'
import type { Account, AccountsStore } from '../accounts/accounts.ts'

export interface OrphanedCredential {
  host: string
  username: string
}

// GitHub: GCM sabe listar sus propias cuentas (`github list`) — comparar
// contra accounts.json encuentra huérfanas reales, no solo las que
// Dossier causó al borrar una cuenta.
export async function listGithubOrphans(accountsStore: AccountsStore): Promise<OrphanedCredential[]> {
  const knownUsernames = new Set(
    accountsStore.list().filter((a) => a.host === 'github.com').map((a) => a.username),
  )
  const registered = await listGcmGithubAccounts() // `git-credential-manager github list`, parseado
  return registered
    .filter((username) => !knownUsernames.has(username))
    .map((username) => ({ host: 'github.com', username }))
}

// GitLab y cualquier otro host: sin listado real posible — el único
// camino es lo que accounts.json recuerde de una cuenta ya borrada
// (ver S9, decisión ya tomada: guardar host+username al borrar, no
// descartarlo, para poder ofrecer limpiar su credencial después).
export function listRememberedOrphans(deletedAccounts: OrphanedCredential[]): OrphanedCredential[] {
  return deletedAccounts
}
```

**Alcance real de S9, ahora confirmado, no supuesto:**

- Cuentas de **GitHub**: detección real de huérfanas, comparando `github list` contra `accounts.json`.
- Cuentas de **GitLab** (y cualquier otro host futuro): sin forma de listar — el alcance queda acotado a lo que `accounts.json` ya conoció y perdió (una cuenta borrada, con su `host`+`username` guardado antes de descartarla del todo).
- En los dos casos, borrar sigue usando `runGitCredential('reject', …)` (ya existe) — nunca un escaneo de `cmdkey /list` ni de ningún almacén fuera de lo que GCM/Dossier ya reconocen como propio.

## S10 — Menú de la bandeja

Una sola función construye el menú a partir de `Settings`, llamada desde `mb.on('ready')` (una vez) y desde dentro de `setSettings` (cada cambio):

```ts
function buildTrayMenu(settings: Settings) {
  return Menu.buildFromTemplate([
    { label: 'Abrir', click: () => mb.showWindow() },
    { type: 'separator' },
    {
      label: 'Tema',
      submenu: (['claro', 'oscuro', 'sistema'] as const).map((theme) => ({
        label: theme,
        type: 'radio',
        checked: settings.theme === theme,
        click: () => applySettings({ theme }), // misma función que usa el handler de IPC
      })),
    },
    {
      label: 'Inicio con Windows',
      type: 'checkbox',
      checked: settings.launchAtStartup,
      click: (item) => applySettings({ launchAtStartup: item.checked }),
    },
    { type: 'separator' },
    { label: 'Probar notificación', click: () => notify({ /* … */ }) },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ])
}

function applySettings(partial: Partial<Settings>) {
  // … misma lógica que hoy vive dentro de ipcMain.handle(IPC.setSettings, …)
  mb.tray?.setContextMenu(buildTrayMenu(getSettingsForRenderer()))
}
```

El handler de IPC `setSettings` pasa a llamar `applySettings` en vez de tener la lógica inline, para que el menú y la ventana nunca queden desincronizados.

## S11 — Guardia de identidad (hooks de Git)

**Tal como quedó implementado** (`core/features/identity-guard/identity-guard.ts`, con TDD completo incluyendo un test de integración que corre Git real):

```ts
export const HOOK_MARKER = '# dossier:identity-guard v1\n'

export function buildHookScript(params: {
  repoPath: string
  expectedEmail: string
  conflictPath: string
  hook: 'pre-commit' | 'pre-push'
}): string // ver el archivo real — compara `git config user.email` contra expectedEmail

export function installHook(repoPath: string, hookName: HookName, script: string): 'instalado' | 'ya-existe-ajeno'
export function uninstallHook(repoPath: string, hookName: HookName): void // solo si es el hook que Dossier puso
export function readConflicts(dataDir: string): ConflictRecord[]
export function clearConflict(dataDir: string, repoPath: string): void
```

**Hallazgo real de la implementación:** el shebang (`#!/bin/sh`) tiene que ser la primera línea _literal_ del archivo — la marca de Dossier va en la línea siguiente, nunca antes (si no, Git en Windows falla con "cannot spawn", ver `docs/lessons/README.md`).

**Decisión de diseño tomada al implementar:** el registro de conflicto **no** usa el paquete `conf` (ese es para procesos Node — el hook es un script de shell, no puede llamarlo), y **no** es un único archivo plano sino un archivo por carpeta en conflicto: `<dataDir>/identity-conflicts/<sha1(repoPath)>.json` — evita que el script de bash tenga que leer/mutar un array JSON existente (frágil en shell), cada hook solo escribe su propio archivo de punta a punta. `main` lee todo el directorio con `readFileSync`/`JSON.parse` y lo relee cada vez que la ventana se muestra (`mb.on('after-show', ...)`, ya existente para centrar la ventana) — nunca un watcher, la diferencia de inmediatez no importa acá.

**Wiring real:**

- `IPC.setEnforced` (`{ path, enforced }`): activa/desactiva — instala o saca ambos hooks (`pre-commit`+`pre-push`) para la cuenta ya asignada a esa regla, vía las funciones compartidas `installHooks`/`uninstallHooks` (`src/main/index.ts`). Devuelve `{ rule, blockedHooks }` — `blockedHooks` lista los hooks que no se pudieron instalar por ya existir uno ajeno (S11.2), para que la UI avise sin fallar la operación entera.
- `IPC.listIdentityConflicts` / evento `identityConflictsUpdated` (push en cada `after-show`): el renderer nunca necesita pedirlo de nuevo a mano.
- `IPC.resolveIdentityConflict` (`{ repoPath, action }`): implementa las tres acciones de S11.5. **Hallazgo de revisión, corregido:** la rama `aplicar` reasignaba la regla pero no reinstalaba los hooks — reutiliza la misma `installHooks` de arriba cuando `rule.enforced` sigue activo (ver requirements.md S11.3/S11.5).
- UI: el interruptor "Guardia de identidad" vive en `AccountFoldersDialog` (por carpeta, junto al botón de quitarla — S11.1). Los conflictos se muestran como tarjetas en la pantalla principal (`IdentityConflicts.tsx`), no como notificación nativa de Windows — ver la decisión de S11.5 en requirements.md sobre mostrar las tres acciones a la vez.
