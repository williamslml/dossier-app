import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, dialog, globalShortcut, ipcMain, Menu, nativeTheme, shell } from 'electron'
import { menubar } from 'electron-menubar'
import log from 'electron-log/main.js'
// electron-updater es CommonJS puro — bajo ESM solo expone un default
// export, el import nombrado falla en tiempo de ejecución aunque los tipos
// lo permitan (hallazgo real: probado en vivo, no solo compilado).
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg
import { z } from 'zod'
import {
  brand,
  buildHookScript,
  checkSecretStoreHealth,
  clearConflict,
  cloneRepo,
  createAccountsStore,
  createRulesStore,
  createSettingsStore,
  ensureActiveInclude,
  findOverlap,
  getActiveConfigPath,
  getConflictPath,
  getCredentialStatus,
  getProfilePath,
  installHook,
  findImportableGithubCliAccount,
  findImportableGitlabCliAccount,
  linkGithubAccount,
  linkGitlabAccount,
  removeLinkedAccount,
  saveLinkedAccount,
  readConflicts,
  renderIncludeIfBlock,
  removeIncludeIfBlock,
  uninstallHook,
  updateRegion,
  validateCloneUrl,
  writeAccountProfile,
  findOrphans,
  FolderOverlapError,
  listGithubAccounts,
  runDoctor,
  runGitCredential,
  type Account,
  type HookName,
  type Theme,
} from '../../core/index.ts'
import { IPC } from '../shared/ipc-channels.ts'
import { notify, registerNotificationClickHandler } from './notify.ts'
import { resolveGlobalConfigPath } from './identity.ts'

// ADR 0005: AppUserModelID coincide con el appId de electron-builder.
app.setAppUserModelId(brand.appId)

const accountsStore = createAccountsStore()
const settingsStore = createSettingsStore()
const rulesStore = createRulesStore()

// S2.3 (requirements.md): traduce nuestro Theme ('claro'/'oscuro'/'sistema')
// al que entiende Electron. Se aplica una vez al iniciar, con lo guardado.
const THEME_SOURCE: Record<Theme, 'system' | 'light' | 'dark'> = {
  sistema: 'system',
  claro: 'light',
  oscuro: 'dark',
}
const THEME_LABEL: Record<Theme, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  sistema: 'Sistema',
}
nativeTheme.themeSource = THEME_SOURCE[settingsStore.get().theme]

// docs/adr/0004: archivos de identidad en `~/.<dataDir>/`, independiente de
// dónde `conf` guarde los JSON (nunca fue el mismo lugar).
const dataDir = join(homedir(), `.${brand.dataDir}`)
const globalConfigPath = await resolveGlobalConfigPath()

// M4.3 (motor de identidad): asegura el [include] de la cuenta activa una
// sola vez al iniciar — el [include] en sí no cambia nunca.
updateRegion(globalConfigPath, (region) =>
  ensureActiveInclude(region, getActiveConfigPath(dataDir)),
)

interface DossierState {
  accounts: Account[]
  displayName: string
  version: string
}

function getState(): DossierState {
  return {
    accounts: accountsStore.list(),
    displayName: brand.displayName,
    version: app.getVersion(),
  }
}

const startGithubLinkSchema = z.object({ label: z.string().min(1) })
const linkGitlabSchema = z.object({
  label: z.string().min(1),
  host: z.string().min(1),
  token: z.string().min(1),
})
// Nunca abrir cualquier esquema (p. ej. file://): solo el enlace de
// verificación de un Device Flow, siempre http(s) (L2, design.md).
const openExternalSchema = z.object({ url: z.string().url().startsWith('https://') })
const setSettingsSchema = z.object({
  theme: z.enum(['claro', 'oscuro', 'sistema']).optional(),
  launchAtStartup: z.boolean().optional(),
})
const pinFolderSchema = z.object({ path: z.string().min(1), accountId: z.string().min(1) })
const unpinFolderSchema = z.object({ path: z.string().min(1) })
const cloneRepoSchema = z.object({
  url: z.string().min(1),
  destPath: z.string().min(1),
  accountId: z.string().min(1),
})
const removeOrphanedCredentialSchema = z.object({
  host: z.string().min(1),
  username: z.string().min(1),
})
const setEnforcedSchema = z.object({ path: z.string().min(1), enforced: z.boolean() })
const renameAccountSchema = z.object({ id: z.string().min(1), label: z.string().trim().min(1) })
const setSigningKeySchema = z.object({
  id: z.string().min(1),
  format: z.enum(['openpgp', 'ssh']),
  keyId: z.string().trim().min(1),
})
const clearSigningKeySchema = z.object({ id: z.string().min(1) })
const removeAccountSchema = z.object({ id: z.string().min(1) })
const resolveIdentityConflictSchema = z.object({
  repoPath: z.string().min(1),
  action: z.enum(['aplicar', 'bloquear', 'reconectar']),
})

// S2.1: `launchAtStartup` sale siempre de Windows, nunca de lo guardado —
// evita que se desincronice del registro real si algo cambia por fuera.
// `shouldUseDarkColors` es el estado real (en modo "sistema", lo decide
// Windows) — el renderer no debería adivinarlo a partir del string de tema.
function getSettingsForRenderer() {
  return {
    ...settingsStore.get(),
    launchAtStartup: app.getLoginItemSettings().openAtLogin,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  }
}

// S3.3 (ADR 0006): validar origen/esquema de cada handler antes de tocar core.
ipcMain.handle(IPC.getState, () => getState())

ipcMain.handle(IPC.startGithubLink, async (event, payload: unknown) => {
  const { label } = startGithubLinkSchema.parse(payload)
  const account = await linkGithubAccount(accountsStore, label, (verification) => {
    event.sender.send(IPC.githubVerification, verification)
  })
  notify({ title: brand.displayName, body: `${account.label} vinculada` })
  return getState()
})

ipcMain.handle(IPC.linkGitlab, async (_event, payload: unknown) => {
  const { label, host, token } = linkGitlabSchema.parse(payload)
  const account = await linkGitlabAccount(accountsStore, label, host, token)
  notify({ title: brand.displayName, body: `${account.label} vinculada` })
  return getState()
})

ipcMain.handle(IPC.renameAccount, (_event, payload: unknown) => {
  const { id, label } = renameAccountSchema.parse(payload)
  accountsStore.rename(id, label)
  return getState()
})

// docs/product.md: la clave de firma es parte del perfil de la cuenta
// (nunca un switch global) — regenerar el perfil es lo que de verdad la
// activa para cualquier carpeta ya fijada a esta cuenta.
ipcMain.handle(IPC.setSigningKey, async (_event, payload: unknown) => {
  const { id, format, keyId } = setSigningKeySchema.parse(payload)
  const account = accountsStore.setSigningKey(id, { format, keyId })
  await writeAccountProfile(dataDir, account)
  return getState()
})

ipcMain.handle(IPC.clearSigningKey, async (_event, payload: unknown) => {
  const { id } = clearSigningKeySchema.parse(payload)
  const account = accountsStore.clearSigningKey(id)
  await writeAccountProfile(dataDir, account)
  return getState()
})

// docs/product.md: desvincular una cuenta también desfija sus carpetas y
// saca su includeIf — nunca deja una carpeta apuntando a un perfil que ya
// no corresponde a nada. El token en GCM no se borra acá: desvincular y
// revocar son dos decisiones distintas (la cuenta queda como huérfana,
// limpiable a propósito desde Ajustes, S9 de 05-ajustes).
ipcMain.handle(IPC.removeAccount, (_event, payload: unknown) => {
  const { id } = removeAccountSchema.parse(payload)
  removeLinkedAccount({ rulesStore, accountsStore, dataDir, globalConfigPath }, id)
  return getState()
})

ipcMain.handle(IPC.openExternal, (_event, payload: unknown) => {
  const { url } = openExternalSchema.parse(payload)
  return shell.openExternal(url)
})

ipcMain.handle(IPC.getSettings, () => getSettingsForRenderer())

// docs/adr/0004: solo informa — nunca reordena ni modifica la cadena real
// de credential.helper del usuario. `recheckCredentials` es el mismo
// chequeo, disparado a pedido (p. ej. tras instalar GCM) en vez de al cargar.
ipcMain.handle(IPC.getCredentialStatus, () => getCredentialStatus())
ipcMain.handle(IPC.recheckCredentials, () => getCredentialStatus())

// M-Doctor (docs/product.md): un chequeo por carpeta fijada, a pedido —
// nunca escribe nada, solo lee.
ipcMain.handle(IPC.runDoctor, () => runDoctor(rulesStore, accountsStore, dataDir))

// docs/product.md: chequeo defensivo antes de vincular una cuenta nueva —
// bloquea el flujo con un aviso claro si el almacén de secretos no puede
// guardar/leer de verdad, en vez de dejar que falle recién al final.
ipcMain.handle(IPC.checkSecretStore, () => checkSecretStoreHealth())

// docs/product.md: "sincronizar cuentas previas a Dossier" (b) — nunca se
// envía el token al renderer, solo los campos seguros para mostrar; vincular
// de verdad (importGithubCliAccount) vuelve a chequear del lado de main, no
// confía en lo que el renderer recuerde de la primera llamada.
ipcMain.handle(IPC.checkGithubCliImport, async () => {
  const linked = await findImportableGithubCliAccount(accountsStore)
  if (!linked) return null
  return { username: linked.username, name: linked.name, email: linked.email }
})

const importGithubCliAccountSchema = z.object({ label: z.string().min(1) })
ipcMain.handle(IPC.importGithubCliAccount, async (_event, payload: unknown) => {
  const { label } = importGithubCliAccountSchema.parse(payload)
  const linked = await findImportableGithubCliAccount(accountsStore)
  if (!linked) {
    throw new Error('Ya no hay ninguna sesión de gh CLI para importar.')
  }
  const account = await saveLinkedAccount(accountsStore, linked, label, 'github.com')
  notify({ title: brand.displayName, body: `${account.label} vinculada` })
  return getState()
})

const checkGitlabCliImportSchema = z.object({ host: z.string().min(1) })
ipcMain.handle(IPC.checkGitlabCliImport, async (_event, payload: unknown) => {
  const { host } = checkGitlabCliImportSchema.parse(payload)
  const linked = await findImportableGitlabCliAccount(accountsStore, host)
  if (!linked) return null
  return { username: linked.username, name: linked.name, email: linked.email }
})

const importGitlabCliAccountSchema = z.object({ label: z.string().min(1), host: z.string().min(1) })
ipcMain.handle(IPC.importGitlabCliAccount, async (_event, payload: unknown) => {
  const { label, host } = importGitlabCliAccountSchema.parse(payload)
  const linked = await findImportableGitlabCliAccount(accountsStore, host)
  if (!linked) {
    throw new Error('Ya no hay ninguna sesión de glab CLI para importar en ese host.')
  }
  const account = await saveLinkedAccount(accountsStore, linked, label, host)
  notify({ title: brand.displayName, body: `${account.label} vinculada` })
  return getState()
})

// S10.3: una sola función aplica el cambio (IPC o menú de la bandeja) —
// nunca dos caminos separados que puedan desincronizarse.
function applySettings(partial: { theme?: Theme | undefined; launchAtStartup?: boolean | undefined }) {
  // S2.2: si `app.setLoginItemSettings` lanzara, no queremos guardar un
  // estado que no sea real — se aplica antes de persistir.
  if (partial.launchAtStartup !== undefined) {
    app.setLoginItemSettings({ openAtLogin: partial.launchAtStartup })
  }
  if (partial.theme !== undefined) {
    nativeTheme.themeSource = THEME_SOURCE[partial.theme]
  }
  settingsStore.update({
    ...(partial.theme !== undefined ? { theme: partial.theme } : {}),
    ...(partial.launchAtStartup !== undefined ? { launchAtStartup: partial.launchAtStartup } : {}),
  })
  const updated = getSettingsForRenderer()
  // S10.2: el menú se reconstruye en cada cambio, no solo al iniciar —
  // si no, queda desactualizado apenas algo cambia desde la ventana.
  refreshTrayMenu()
  return updated
}

ipcMain.handle(IPC.setSettings, (_event, payload: unknown) => {
  const partial = setSettingsSchema.parse(payload)
  return applySettings(partial)
})

function refreshTrayMenu(): void {
  mb.setContextMenu(buildTrayMenu(getSettingsForRenderer()))
}

// Hallazgo real (feedback directo probando la app, 09-cambio-de-cuenta-
// bandeja): se probó un submenú "Cuentas vinculadas" en la bandeja para
// cambiar la cuenta por defecto de carpetas sin fijar. El usuario lo usa
// en vivo y pide sacarlo — en su flujo real todo está fijado, el concepto
// de "cuenta por defecto" no aporta nada ahí, y cualquier forma de
// marcarla (radio, texto "en uso") sugiere una exclusividad que no
// corresponde ("activa" para el usuario = "vinculada", todas a la vez).
// También se sacó "Inicio con Windows" de acá: sigue disponible en
// Ajustes, no hace falta duplicarlo en un menú que ahora es mínimo.
// Menú final, deliberadamente simple: Abrir / Tema / Salir.
function buildTrayMenu(settings: ReturnType<typeof getSettingsForRenderer>) {
  return Menu.buildFromTemplate([
    { label: 'Abrir', click: () => mb.showWindow() },
    { type: 'separator' },
    {
      label: 'Tema',
      submenu: (['claro', 'oscuro', 'sistema'] as const).map((theme) => ({
        label: THEME_LABEL[theme],
        type: 'radio',
        checked: settings.theme === theme,
        click: () => applySettings({ theme }),
      })),
    },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ])
}

ipcMain.handle(IPC.listPins, () => rulesStore.list())

ipcMain.handle(IPC.pickFolder, async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle(IPC.pinFolder, async (_event, payload: unknown) => {
  const { path, accountId } = pinFolderSchema.parse(payload)
  const account = accountsStore.list().find((a) => a.id === accountId)
  if (!account) throw new Error('Cuenta no encontrada')
  await writeAccountProfile(dataDir, account) // M6.1, idempotente si ya existe
  const rule = rulesStore.pin(path, accountId) // puede lanzar FolderOverlapError, sin capturar acá
  const block = await renderIncludeIfBlock(`${path}/`, getProfilePath(dataDir, accountId))
  updateRegion(globalConfigPath, (region) => `${region}\n${block}`.trim())
  return rule
})

// Q1-Q5 (07-quick-clone): orden exacto — cuenta → validar URL → chequear
// solapamiento → clonar → Auto-Pin. El chequeo de solapamiento corre ANTES
// del clone (Q5.1): un clone que termina en disco no se puede "deshacer"
// tan simple como rechazarlo antes de empezar.
// Hallazgo al implementar: `cloneRepo` es una sola llamada esperada de
// punta a punta (sin progreso granular, ver proposal.md) — un evento de
// progreso aparte no agregaba nada que la propia promesa del `invoke` no
// diera ya (el renderer ya sabe que está "clonando" apenas llama, y
// "error"/"listo" los da el resultado de la promesa). Se sacó esa
// complejidad en vez de dejarla sin usar.
ipcMain.handle(IPC.cloneRepo, async (_event, payload: unknown) => {
  const { url, destPath, accountId } = cloneRepoSchema.parse(payload)
  const account = accountsStore.list().find((a) => a.id === accountId)
  if (!account) throw new Error('Cuenta no encontrada')

  const knownHosts = [...new Set(accountsStore.list().map((a) => a.host))]
  validateCloneUrl(url, knownHosts)

  // Hallazgo de revisión: validateCloneUrl solo confirma que el host de la
  // URL tiene ALGUNA cuenta vinculada, nunca que sea la MISMA que accountId
  // — ese filtro vivía solo del lado del cliente (CloneDialog.tsx). Sin
  // este chequeo acá, un accountId de otro host dejaría el override de
  // credencial sin efecto (Git nunca lo consulta para un host distinto) y
  // el Auto-Pin fijaría la carpeta a la cuenta equivocada.
  if (new URL(url).host !== account.host.toLowerCase()) {
    throw new Error('La cuenta elegida no es del mismo host que la URL.')
  }

  const overlap = findOverlap(rulesStore.list(), destPath)
  if (overlap) throw new FolderOverlapError(destPath, overlap.path)

  await cloneRepo(url, destPath, account)

  // Q4: mismo camino que IPC.pinFolder, no uno paralelo.
  await writeAccountProfile(dataDir, account)
  const rule = rulesStore.pin(destPath, account.id)
  const block = await renderIncludeIfBlock(`${destPath}/`, getProfilePath(dataDir, account.id))
  updateRegion(globalConfigPath, (region) => `${region}\n${block}`.trim())

  return rule
})

ipcMain.handle(IPC.unpinFolder, (_event, payload: unknown) => {
  const { path } = unpinFolderSchema.parse(payload)
  rulesStore.unpin(path) // M6.2
  updateRegion(globalConfigPath, (region) => removeIncludeIfBlock(region, `${path}/`))
})

const HOOK_NAMES: HookName[] = ['pre-commit', 'pre-push']

// S11.1/S11.2: instala o saca los hooks de Git de una carpeta — nunca pisa
// un hook que no sea el que Dossier puso (installHook/uninstallHook ya lo
// verifican); si alguno ya existe ajeno, se avisa en vez de fallar en
// silencio. El email esperado queda grabado en el script al instalarlo (no
// se relee de rules.json en cada commit), así que esta función hay que
// volver a llamarla cada vez que cambia la cuenta de una carpeta ya
// enforced — no solo al prender/apagar el interruptor (hallazgo de
// revisión: "Aplicar" dejaba el hook viejo apuntando a la cuenta anterior).
function uninstallHooks(path: string): void {
  for (const hook of HOOK_NAMES) uninstallHook(path, hook)
}

function installHooks(path: string, account: Account): HookName[] {
  const conflictPath = getConflictPath(dataDir, path)
  return HOOK_NAMES.filter((hook) => {
    const script = buildHookScript({
      repoPath: path,
      expectedEmail: account.email,
      conflictPath,
      hook,
    })
    return installHook(path, hook, script) === 'ya-existe-ajeno'
  })
}

ipcMain.handle(IPC.setEnforced, (_event, payload: unknown) => {
  const { path, enforced } = setEnforcedSchema.parse(payload)
  const rule = rulesStore.setEnforced(path, enforced)

  if (!enforced) {
    uninstallHooks(path)
    return { rule, blockedHooks: [] as HookName[] }
  }

  const account = accountsStore.list().find((a) => a.id === rule.accountId)
  if (!account) throw new Error('Cuenta no encontrada')
  return { rule, blockedHooks: installHooks(path, account) }
})

ipcMain.handle(IPC.listIdentityConflicts, () => readConflicts(dataDir))

// S11.5: las tres acciones de la notificación de conflicto.
ipcMain.handle(IPC.resolveIdentityConflict, async (_event, payload: unknown) => {
  const { repoPath, action } = resolveIdentityConflictSchema.parse(payload)
  const conflict = readConflicts(dataDir).find((c) => c.repoPath === repoPath)
  if (!conflict) return

  if (action === 'bloquear') {
    clearConflict(dataDir, repoPath)
    return
  }

  if (action === 'aplicar') {
    // La cuenta "que se usó" es la que tiene asignado el email real con el
    // que se hizo el commit/push que disparó el conflicto.
    const usedAccount = accountsStore.list().find((a) => a.email === conflict.actualEmail)
    if (!usedAccount) {
      throw new Error('Ninguna cuenta vinculada tiene ese email — vinculala primero.')
    }
    await writeAccountProfile(dataDir, usedAccount)
    const rule = rulesStore.pin(repoPath, usedAccount.id)
    const block = await renderIncludeIfBlock(
      `${repoPath}/`,
      getProfilePath(dataDir, usedAccount.id),
    )
    updateRegion(globalConfigPath, (region) => `${region}\n${block}`.trim())
    // Hallazgo de revisión: `pin` preserva `enforced` al reasignar cuenta,
    // pero el hook ya instalado tiene el email esperado grabado como texto
    // (no lo relee de rules.json en cada commit) — sin esto, el próximo
    // commit de `usedAccount` seguía sin coincidir con el hook viejo.
    if (rule.enforced) installHooks(repoPath, usedAccount)
    clearConflict(dataDir, repoPath)
    return
  }

  // Reconectar: la cuenta que la regla ya tiene asignada (no la que se usó
  // en el commit que falló) — vuelve a escribir su perfil y confirma que
  // GCM todavía puede devolver su credencial.
  const rule = rulesStore.list().find((r) => r.path === repoPath)
  const expectedAccount = rule && accountsStore.list().find((a) => a.id === rule.accountId)
  if (!expectedAccount) throw new Error('Esa carpeta ya no tiene una cuenta fijada.')

  await writeAccountProfile(dataDir, expectedAccount)
  await runGitCredential('fill', {
    protocol: 'https',
    host: expectedAccount.host,
    username: expectedAccount.username,
  })
  clearConflict(dataDir, repoPath)
})

ipcMain.handle(IPC.listOrphanedCredentials, async () => {
  // S9.1: si GCM no puede listar GitHub por algún motivo (versión vieja,
  // sin cuentas, etc.), se trata como "ninguna conocida" — es una limpieza
  // de mejor esfuerzo, no debe romper la pantalla de Ajustes. Se loguea
  // (sin datos sensibles) para que no quede en silencio total si falla.
  const githubAccounts = await listGithubAccounts().catch((err: unknown) => {
    log.error('no se pudo listar las cuentas de GitHub que GCM conoce', err)
    return []
  })
  return findOrphans(accountsStore, githubAccounts)
})

ipcMain.handle(IPC.removeOrphanedCredential, async (_event, payload: unknown) => {
  const { host, username } = removeOrphanedCredentialSchema.parse(payload)
  // Hallazgo de revisión: no confiar en que la UI solo ofrezca este botón
  // para entradas ya marcadas como huérfanas — `main` es la capa que de
  // verdad maneja credenciales (ADR 0006), así que revalida acá antes de
  // borrar nada, nunca un barrido genérico (proposal.md).
  const githubAccounts = await listGithubAccounts().catch((err: unknown) => {
    log.error('no se pudo listar las cuentas de GitHub que GCM conoce', err)
    return []
  })
  const isOrphan = findOrphans(accountsStore, githubAccounts).some(
    (o) => o.host === host && o.username === username,
  )
  if (!isOrphan) {
    throw new Error('Esa credencial ya no está huérfana — no se borró nada.')
  }
  await runGitCredential('reject', { protocol: 'https', host, username })
})

// index acepta una URL file:// — new URL(relativo, import.meta.url) ya la
// produce bien formada (import.meta.url ya es file://), sin pasar por una
// ruta de sistema de archivos intermedia.
const rendererUrl =
  process.env.ELECTRON_RENDERER_URL ?? new URL('../renderer/index.html', import.meta.url).href

// preload/icon sí necesitan una ruta real de archivo: fileURLToPath, no
// `.pathname` a mano — en Windows `.pathname` deja un "/C:/..." inválido.
const preloadPath = fileURLToPath(new URL('../preload/index.cjs', import.meta.url))

// Ícono de marca (resources/, generado con scripts/generate-icons.ts).
// Necesario explícito en el tray: sin él, electron-menubar recurre a un
// __dirname interno que no existe en ESM y crashea.
// Hallazgo real: la bandeja usa el .ico multi-tamaño (16 a 256px), no un PNG
// plano de 32px — Windows elige el tamaño justo según el DPI de la pantalla
// en vez de escalar uno solo, que es lo que hacía ver el ícono chico/borroso.
const trayIcon = fileURLToPath(new URL('../../resources/app-icon.ico', import.meta.url))
const windowIcon = fileURLToPath(new URL('../../resources/app-icon.png', import.meta.url))

const mb = menubar({
  index: rendererUrl,
  icon: trayIcon,
  tooltip: brand.displayName,
  // Hallazgo real: por defecto, electron-menubar oculta la ventana sola
  // apenas pierde el foco (pensado para un menú desplegable que se cierra
  // solo al hacer clic afuera) — pero minimizar también le hace perder el
  // foco, así que "Minimizar" terminaba ocultándola en vez de mandarla a
  // la barra de tareas. El usuario espera minimizar/cerrar como cualquier
  // app (cada botón hace lo suyo, sin cierre automático al desenfocar).
  hideOnBlur: false,
  browserWindow: {
    width: 390,
    height: 620,
    frame: false,
    resizable: false,
    icon: windowIcon,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  },
})

// Botón de cerrar del título (TitleBar.tsx): oculta la ventana, vuelve a
// la bandeja — no cierra la app (es una app de bandeja, no una ventana
// normal; "Salir" desde el menú de la bandeja sí la cierra de verdad).
ipcMain.handle(IPC.hideWindow, () => {
  // Hallazgo real: si la ventana está minimizada (barra de tareas),
  // mb.hideWindow() no la saca de ahí de verdad — electron-menubar llama
  // a `.hide()`, pero sobre una ventana minimizada eso no quita el ícono
  // de la barra de tareas en Windows. Restaurarla primero deja el estado
  // limpio (restaurada → oculta), que es el camino que sí funciona.
  if (mb.window?.isMinimized()) {
    mb.window.restore()
  }
  mb.hideWindow()
})

ipcMain.handle(IPC.minimizeWindow, () => {
  mb.window?.minimize()
})

// S2.4: cambia el tema elegido, o (en modo "sistema") cambia el tema de
// Windows — el renderer se suscribe una vez al cargar.
nativeTheme.on('updated', () => {
  mb.window?.webContents.send(IPC.themeUpdated, nativeTheme.shouldUseDarkColors)
})

log.initialize()

// S8.2: liberar el atajo global al salir — Electron no lo hace solo.
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// R3 (08-release-pipeline): nunca instala sola, ni descarga con prompts
// interactivos — solo descarga en segundo plano y espera un clic.
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = false

// R3.3/Q8 (hallazgo de revisión): un flag global que el manejador único de
// clics revisaba para decidir si instalar hacía que el clic en CUALQUIER
// otra notificación (incluida una vieja, persistida con `important: true`,
// clickeada días después) instalara la actualización sin que el usuario
// lo pidiera. Fix: el clic en la notificación de actualización se escucha
// en la instancia misma (`Notification.on('click', ...)`, válido mientras
// la app sigue corriendo, que es el caso normal — la descarga ya terminó),
// y el manejador global de `handleActivation` (más abajo) nunca instala
// nada por sí solo, solo muestra la ventana — camino seguro para cualquier
// otro clic, incluido un arranque en frío sobre esa misma notificación.
autoUpdater.on('update-downloaded', (info) => {
  notify({
    title: brand.displayName,
    body: `Versión ${info.version} lista para instalar — haz clic para reiniciar y actualizar.`,
  }).once('click', () => {
    autoUpdater.quitAndInstall() // R3.3: solo este clic, nunca otro
  })
})

autoUpdater.on('error', (err) => {
  // R3.4: nunca interrumpe el arranque normal de la app.
  log.error('autoUpdater falló', err)
})

mb.on('ready', () => {
  log.info('bandeja lista')

  // ADR 0007: un único manejador global de clics en notificaciones, que
  // funciona incluso con arranque en frío (la app no corría cuando se
  // clickeó el aviso) — nunca instala nada, solo muestra la ventana.
  registerNotificationClickHandler(() => {
    mb.showWindow()
  })

  // R3.1: chequea al iniciar — errores de red/GitHub cualquiera se
  // absorben en el handler de 'error' de arriba, nunca rompen el arranque.
  void autoUpdater.checkForUpdates().catch((err: unknown) => {
    log.error('no se pudo chequear actualizaciones', err)
  })

  // S8.2 (05-ajustes): atajo global para mostrar/ocultar la ventana sin
  // pasar por la bandeja. Combinación fija para esta primera versión —
  // elegida por ser poco común en otras apps de Windows/navegadores (a
  // diferencia de Ctrl+Shift+N/Ctrl+Shift+T, muy usadas).
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (mb.window?.isVisible()) {
      mb.hideWindow()
    } else {
      mb.showWindow()
    }
  })
  if (!shortcutRegistered) {
    log.error('no se pudo registrar el atajo global Ctrl+Shift+D (ya lo usa otra app)')
  }

  // S10: mismas opciones que Ajustes (tema, inicio con Windows), para
  // cambiarlas sin abrir la ventana. 09-cambio-de-cuenta-bandeja: más
  // "Cuenta activa".
  refreshTrayMenu()

  // Solo para pruebas manuales/verificación: electron-menubar crea la
  // ventana perezosamente, solo al mostrarla con un clic real en la bandeja.
  if (process.env.DOSSIER_SHOW_ON_START || process.env.DOSSIER_AUTO_QUIT) {
    mb.showWindow()
  }
  if (process.env.DOSSIER_AUTO_QUIT) {
    setTimeout(() => app.quit(), 2_000)
  }
})

// Decisión explícita del usuario: ventana centrada en pantalla, no anclada
// a la bandeja. `windowPosition: 'center'` NO alcanza: electron-menubar
// recalcula y sobrescribe la posición con su propio anclaje a la bandeja
// en win32/linux en cada `applyWindowPosition()` (código de la librería,
// no documentado) — hay que forzar el centrado después de cada show.
mb.on('after-show', () => {
  mb.window?.center()
})

// S11.4: relee los conflictos cada vez que la ventana se muestra — nunca un
// watcher de archivos, la diferencia de inmediatez no importa acá (el
// usuario ya está mirando la ventana cuando puede pasar algo, ver design.md).
mb.on('after-show', () => {
  mb.window?.webContents.send(IPC.identityConflictsUpdated, readConflicts(dataDir))
})

// 'before-load': ventana ya creada, loadURL todavía no se llamó — a tiempo
// para engancharse antes de que la carga termine (a diferencia de
// 'after-create-window', que ya ocurre con la URL cargada).
mb.on('before-load', () => {
  mb.window?.webContents.on('did-finish-load', () => {
    log.info('renderer cargó sin error')
  })
  mb.window?.webContents.on('did-fail-load', (_event, code, description) => {
    log.error('renderer falló al cargar', code, description)
    notify({
      title: brand.displayName,
      body: 'La ventana no cargó correctamente. Abrí la app de nuevo o revisá los registros.',
      important: true,
    })
  })
  // Hallazgo real (docs/lessons/README.md): un preload roto (p. ej. un
  // SyntaxError de ESM bajo `sandbox: true`) no dispara `did-fail-load` — la
  // página carga igual, solo que sin `window.dossier`, y quedaba en silencio
  // total (ni electron-log ni la UI lo mostraban). `preload-error` es el
  // único evento que sí lo avisa.
  mb.window?.webContents.on('preload-error', (_event, preloadPath, error) => {
    log.error('preload falló al cargar', preloadPath, error)
    notify({
      title: brand.displayName,
      body: 'Hubo un problema interno al iniciar la app. Revisá los registros.',
      important: true,
    })
  })
})
