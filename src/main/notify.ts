import { fileURLToPath } from 'node:url'
import { Notification } from 'electron'
import { brand } from '../../core/index.ts'

const icon = fileURLToPath(new URL('../../resources/tray-icon.png', import.meta.url))

export interface NotifyOptions {
  title: string
  body: string
  /** ADR 0007: avisos importantes permanecen en el Centro de notificaciones. */
  important?: boolean
}

/**
 * `Notification` nativa de Electron (ADR 0003/0007) — nunca
 * `electron-windows-notifications` (obsoleto, requiere addons nativos).
 * El clic en el aviso se maneja por separado, una sola vez, con
 * `Notification.handleActivation()` (ver `registerNotificationClickHandler`
 * más abajo) — es el mecanismo que funciona incluso con arranque en frío
 * (ADR 0007), a diferencia de escuchar `'click'` en esta instancia.
 * Nota: en modo sin empaquetar (sin instalador NSIS con AppUserModelID +
 * ToastActivatorCLSID), Windows puede no mostrar el toast aunque el código
 * esté bien — decisión abierta de `docs/product.md` §7.4, no es un bug.
 */
export function notify({ title, body, important }: NotifyOptions): Notification {
  const notification = new Notification({
    title,
    body,
    icon,
    groupId: brand.slug,
    groupTitle: brand.displayName,
    ...(important ? { urgency: 'critical' as const, timeoutType: 'never' as const } : {}),
  })

  notification.show()
  return notification
}

/**
 * Registra el manejador único y global de clics (ADR 0007): se llama una
 * sola vez al iniciar la app. Cubre los cuatro casos que documenta Electron
 * (instancia en memoria, recolectada, persistida de una sesión anterior, o
 * arranque en frío disparado por el clic) sin tener que distinguirlos.
 */
export function registerNotificationClickHandler(onClick: () => void): void {
  Notification.handleActivation(onClick)
}
