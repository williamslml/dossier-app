import { atom } from 'nanostores'
import type {
  Account,
  ConflictRecord,
  DossierState,
  IdentityConflictAction,
  OrphanedCredential,
  Rule,
  Settings,
} from '../../../../preload/index.ts'

export interface PrincipalState {
  accounts: Account[]
  displayName: string
  version: string
  loading: boolean
}

export const $principal = atom<PrincipalState>({
  accounts: [],
  displayName: 'Dossier',
  version: '',
  loading: true,
})

export function applyState(state: DossierState): void {
  $principal.set({ ...state, loading: false })
}

const TOAST_DURATION_MS = 3_000

/** Mensaje efímero (p. ej. "Cuenta vinculada"); `null` = no hay nada que mostrar. */
export const $toastMessage = atom<string | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function showToast(message: string): void {
  clearTimeout(toastTimer)
  $toastMessage.set(message)
  toastTimer = setTimeout(() => $toastMessage.set(null), TOAST_DURATION_MS)
}

export async function loadState(): Promise<void> {
  applyState(await window.dossier.getState())
}

export const $screen = atom<'principal' | 'ajustes'>('principal')

export const $settings = atom<Settings>({
  theme: 'sistema',
  launchAtStartup: false,
})

// S3.3 (design.md): una sola fuente de verdad para aplicar el tema — nunca
// clases sueltas por componente.
function applyTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? 'oscuro' : 'claro'
}

export async function loadSettings(): Promise<void> {
  const { shouldUseDarkColors, ...settings } = await window.dossier.getSettings()
  $settings.set(settings)
  applyTheme(shouldUseDarkColors)
}

export async function updateSettings(partial: Partial<Settings>): Promise<void> {
  const { shouldUseDarkColors, ...settings } = await window.dossier.setSettings(partial)
  $settings.set(settings)
  applyTheme(shouldUseDarkColors)
}

/** S2.4: suscripción al cambio externo de tema (Windows, en modo "sistema"). */
export function subscribeThemeUpdates(): () => void {
  return window.dossier.onThemeUpdated((dark) => applyTheme(dark))
}

export const $pins = atom<Rule[]>([])

export async function loadPins(): Promise<void> {
  $pins.set(await window.dossier.listPins())
}

/** Puede rechazar con el mensaje de `FolderOverlapError` (06-motor-de-identidad) — el llamador lo muestra tal cual. */
export async function pinFolder(path: string, accountId: string): Promise<void> {
  await window.dossier.pinFolder({ path, accountId })
  await loadPins()
}

export async function unpinFolder(path: string): Promise<void> {
  await window.dossier.unpinFolder(path)
  await loadPins()
}

/** S11.1: puede avisar con `blockedHooks` si alguna carpeta ya tenía un
    hook ajeno (nunca se pisa) — el llamador decide cómo mostrarlo. */
export async function setEnforced(
  path: string,
  enforced: boolean,
): Promise<{ blockedHooks: string[] }> {
  const { blockedHooks } = await window.dossier.setEnforced({ path, enforced })
  await loadPins()
  return { blockedHooks }
}

export const $identityConflicts = atom<ConflictRecord[]>([])

export async function loadIdentityConflicts(): Promise<void> {
  $identityConflicts.set(await window.dossier.listIdentityConflicts())
}

/** S11.4: `main` empuja la lista actualizada cada vez que la ventana se
    muestra — nunca hay que pedirla de nuevo a mano. */
export function subscribeIdentityConflicts(): () => void {
  return window.dossier.onIdentityConflictsUpdated((conflicts) => $identityConflicts.set(conflicts))
}

export async function resolveIdentityConflict(
  repoPath: string,
  action: IdentityConflictAction,
): Promise<void> {
  await window.dossier.resolveIdentityConflict({ repoPath, action })
  await loadIdentityConflicts()
  if (action === 'aplicar') await loadPins()
}

/** Q4: deja la carpeta clonada ya fijada a la cuenta elegida — recarga
    `$pins` para que se vea al toque en el diálogo de esa cuenta. Puede
    rechazar con el mensaje real de Git o con `FolderOverlapError`, el
    llamador los muestra tal cual (mismo patrón que `pinFolder`). */
export async function cloneRepo(url: string, destPath: string, accountId: string): Promise<void> {
  await window.dossier.cloneRepo({ url, destPath, accountId })
  await loadPins()
}

export const $orphanedCredentials = atom<OrphanedCredential[]>([])

export async function loadOrphanedCredentials(): Promise<void> {
  $orphanedCredentials.set(await window.dossier.listOrphanedCredentials())
}

export async function removeOrphanedCredential(host: string, username: string): Promise<void> {
  await window.dossier.removeOrphanedCredential({ host, username })
  await loadOrphanedCredentials()
}
