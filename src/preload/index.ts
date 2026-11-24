import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels.ts'
import type {
  Account,
  ConflictRecord,
  CredentialStatus,
  DoctorCheck,
  GithubVerification,
  OrphanedCredential,
  Rule,
  SecretStoreHealth,
  Settings,
  Theme,
} from '../../core/index.ts'

export type {
  Account,
  ConflictRecord,
  CredentialStatus,
  DoctorCheck,
  GithubVerification,
  OrphanedCredential,
  Rule,
  SecretStoreHealth,
  Settings,
  Theme,
}

export type IdentityConflictAction = 'aplicar' | 'bloquear' | 'reconectar'

export interface DossierState {
  accounts: Account[]
  displayName: string
  version: string
}

export interface DossierApi {
  getState(): Promise<DossierState>
  hideWindow(): Promise<void>
  minimizeWindow(): Promise<void>
  startGithubLink(label: string): Promise<DossierState>
  /** Devuelve una función para des-suscribirse (design.md). */
  onGithubVerification(callback: (verification: GithubVerification) => void): () => void
  linkGitlab(data: { label: string; host: string; token: string }): Promise<DossierState>
  renameAccount(data: { id: string; label: string }): Promise<DossierState>
  setSigningKey(data: { id: string; format: 'openpgp' | 'ssh'; keyId: string }): Promise<DossierState>
  clearSigningKey(id: string): Promise<DossierState>
  removeAccount(id: string): Promise<DossierState>
  openExternal(url: string): Promise<void>
  getSettings(): Promise<Settings & { shouldUseDarkColors: boolean }>
  setSettings(partial: Partial<Settings>): Promise<Settings & { shouldUseDarkColors: boolean }>
  /** Devuelve una función para des-suscribirse (design.md, S4.1). */
  onThemeUpdated(callback: (shouldUseDarkColors: boolean) => void): () => void
  listPins(): Promise<Rule[]>
  pickFolder(): Promise<string | null>
  pinFolder(data: { path: string; accountId: string }): Promise<Rule>
  unpinFolder(path: string): Promise<void>
  listOrphanedCredentials(): Promise<OrphanedCredential[]>
  removeOrphanedCredential(data: { host: string; username: string }): Promise<void>
  setEnforced(data: {
    path: string
    enforced: boolean
  }): Promise<{ rule: Rule; blockedHooks: string[] }>
  listIdentityConflicts(): Promise<ConflictRecord[]>
  /** Devuelve una función para des-suscribirse. */
  onIdentityConflictsUpdated(callback: (conflicts: ConflictRecord[]) => void): () => void
  resolveIdentityConflict(data: { repoPath: string; action: IdentityConflictAction }): Promise<void>
  cloneRepo(data: { url: string; destPath: string; accountId: string }): Promise<Rule>
  getCredentialStatus(): Promise<CredentialStatus>
  recheckCredentials(): Promise<CredentialStatus>
  runDoctor(): Promise<DoctorCheck[]>
  checkSecretStore(): Promise<SecretStoreHealth>
  checkGithubCliImport(): Promise<{ username: string; name: string; email: string | undefined } | null>
  importGithubCliAccount(label: string): Promise<DossierState>
  checkGitlabCliImport(
    host: string,
  ): Promise<{ username: string; name: string; email: string | undefined } | null>
  importGitlabCliAccount(label: string, host: string): Promise<DossierState>
}

// S3.2 (ADR 0006): contextIsolation activo — nada se expone salvo esto.
const api: DossierApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  hideWindow: () => ipcRenderer.invoke(IPC.hideWindow),
  minimizeWindow: () => ipcRenderer.invoke(IPC.minimizeWindow),
  startGithubLink: (label: string) => ipcRenderer.invoke(IPC.startGithubLink, { label }),
  onGithubVerification: (callback: (verification: GithubVerification) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, verification: GithubVerification) =>
      callback(verification)
    ipcRenderer.on(IPC.githubVerification, listener)
    return () => ipcRenderer.removeListener(IPC.githubVerification, listener)
  },
  linkGitlab: (data) => ipcRenderer.invoke(IPC.linkGitlab, data),
  renameAccount: (data: { id: string; label: string }) =>
    ipcRenderer.invoke(IPC.renameAccount, data),
  setSigningKey: (data: { id: string; format: 'openpgp' | 'ssh'; keyId: string }) =>
    ipcRenderer.invoke(IPC.setSigningKey, data),
  clearSigningKey: (id: string) => ipcRenderer.invoke(IPC.clearSigningKey, { id }),
  removeAccount: (id: string) => ipcRenderer.invoke(IPC.removeAccount, { id }),
  openExternal: (url: string) => ipcRenderer.invoke(IPC.openExternal, { url }),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setSettings: (partial: Partial<Settings>) => ipcRenderer.invoke(IPC.setSettings, partial),
  onThemeUpdated: (callback: (shouldUseDarkColors: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, shouldUseDarkColors: boolean) =>
      callback(shouldUseDarkColors)
    ipcRenderer.on(IPC.themeUpdated, listener)
    return () => ipcRenderer.removeListener(IPC.themeUpdated, listener)
  },
  listPins: () => ipcRenderer.invoke(IPC.listPins),
  pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
  pinFolder: (data: { path: string; accountId: string }) => ipcRenderer.invoke(IPC.pinFolder, data),
  unpinFolder: (path: string) => ipcRenderer.invoke(IPC.unpinFolder, { path }),
  listOrphanedCredentials: () => ipcRenderer.invoke(IPC.listOrphanedCredentials),
  removeOrphanedCredential: (data: { host: string; username: string }) =>
    ipcRenderer.invoke(IPC.removeOrphanedCredential, data),
  setEnforced: (data: { path: string; enforced: boolean }) =>
    ipcRenderer.invoke(IPC.setEnforced, data),
  listIdentityConflicts: () => ipcRenderer.invoke(IPC.listIdentityConflicts),
  onIdentityConflictsUpdated: (callback: (conflicts: ConflictRecord[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, conflicts: ConflictRecord[]) =>
      callback(conflicts)
    ipcRenderer.on(IPC.identityConflictsUpdated, listener)
    return () => ipcRenderer.removeListener(IPC.identityConflictsUpdated, listener)
  },
  resolveIdentityConflict: (data: { repoPath: string; action: IdentityConflictAction }) =>
    ipcRenderer.invoke(IPC.resolveIdentityConflict, data),
  cloneRepo: (data: { url: string; destPath: string; accountId: string }) =>
    ipcRenderer.invoke(IPC.cloneRepo, data),
  getCredentialStatus: () => ipcRenderer.invoke(IPC.getCredentialStatus),
  recheckCredentials: () => ipcRenderer.invoke(IPC.recheckCredentials),
  runDoctor: () => ipcRenderer.invoke(IPC.runDoctor),
  checkSecretStore: () => ipcRenderer.invoke(IPC.checkSecretStore),
  checkGithubCliImport: () => ipcRenderer.invoke(IPC.checkGithubCliImport),
  importGithubCliAccount: (label: string) =>
    ipcRenderer.invoke(IPC.importGithubCliAccount, { label }),
  checkGitlabCliImport: (host: string) => ipcRenderer.invoke(IPC.checkGitlabCliImport, { host }),
  importGitlabCliAccount: (label: string, host: string) =>
    ipcRenderer.invoke(IPC.importGitlabCliAccount, { label, host }),
}

contextBridge.exposeInMainWorld('dossier', api)
