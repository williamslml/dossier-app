import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels.ts'
import type { Account } from '../../core/index.ts'

export type { Account }

export interface DossierState {
  accounts: Account[]
  activeId: string | undefined
  displayName: string
}

export interface DossierApi {
  getState(): Promise<DossierState>
  selectAccount(id: string): Promise<DossierState>
  hideWindow(): Promise<void>
}

// S3.2 (ADR 0006): contextIsolation activo — nada se expone salvo esto.
const api: DossierApi = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  selectAccount: (id: string) => ipcRenderer.invoke(IPC.selectAccount, id),
  hideWindow: () => ipcRenderer.invoke(IPC.hideWindow),
}

contextBridge.exposeInMainWorld('dossier', api)
