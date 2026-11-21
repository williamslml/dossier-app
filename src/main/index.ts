import { fileURLToPath } from 'node:url'
import { app, ipcMain, Menu } from 'electron'
import { menubar } from 'electron-menubar'
import log from 'electron-log/main.js'
import { z } from 'zod'
import { brand, createAccountsStore, createStateStore, type Account } from '../../core/index.ts'
import { IPC } from '../shared/ipc-channels.ts'
import { notify, registerNotificationClickHandler } from './notify.ts'

// ADR 0005: AppUserModelID coincide con el appId de electron-builder.
app.setAppUserModelId(brand.appId)

const accountsStore = createAccountsStore()
const stateStore = createStateStore()

interface DossierState {
  accounts: Account[]
  activeId: string | undefined
  displayName: string
}

function getState(): DossierState {
  return {
    accounts: accountsStore.list(),
    activeId: stateStore.getActiveId(),
    displayName: brand.displayName,
  }
}

const selectAccountSchema = z.object({ id: z.string().min(1) })

// S3.3 (ADR 0006): validar origen/esquema de cada handler antes de tocar core.
ipcMain.handle(IPC.getState, () => getState())
ipcMain.handle(IPC.selectAccount, (_event, payload: unknown) => {
  const { id } = selectAccountSchema.parse(payload)
  stateStore.setActiveId(id)
  return getState()
})

// index acepta una URL file:// — new URL(relativo, import.meta.url) ya la
// produce bien formada (import.meta.url ya es file://), sin pasar por una
// ruta de sistema de archivos intermedia.
const rendererUrl =
  process.env.ELECTRON_RENDERER_URL ?? new URL('../renderer/index.html', import.meta.url).href

// preload/icon sí necesitan una ruta real de archivo: fileURLToPath, no
// `.pathname` a mano — en Windows `.pathname` deja un "/C:/..." inválido.
const preloadPath = fileURLToPath(new URL('../preload/index.mjs', import.meta.url))

// Ícono de marca (resources/, generado con scripts/generate-icons.mjs).
// Necesario explícito en el tray: sin él, electron-menubar recurre a un
// __dirname interno que no existe en ESM y crashea.
const trayIcon = fileURLToPath(new URL('../../resources/tray-icon.png', import.meta.url))
const windowIcon = fileURLToPath(new URL('../../resources/app-icon.png', import.meta.url))

const mb = menubar({
  index: rendererUrl,
  icon: trayIcon,
  tooltip: brand.displayName,
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
  mb.hideWindow()
})

log.initialize()

mb.on('ready', () => {
  log.info('bandeja lista')

  // ADR 0007: un único manejador global de clics en notificaciones, que
  // funciona incluso con arranque en frío (la app no corría cuando se
  // clickeó el aviso).
  registerNotificationClickHandler(() => mb.showWindow())

  // S4.2: menú mínimo (Abrir/Salir); el resto se completa en changes siguientes.
  mb.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir', click: () => mb.showWindow() },
      { type: 'separator' },
      // Verificación manual de S7 (tasks.md): el módulo de notificaciones
      // (notify.ts) ya está completo, pero este change no tiene todavía
      // ningún flujo real que lo dispare (vincular cuenta, clonar, etc.
      // siguen deshabilitados a propósito — S5.5). Se mantiene esta entrada
      // para poder probarlo hasta que un change futuro lo conecte a un
      // evento real.
      {
        label: 'Probar notificación',
        click: () =>
          notify({
            title: brand.displayName,
            body: 'Notificación de prueba — todavía no hay un evento real conectado.',
          }),
      },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() },
    ]),
  )

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
})
