import { atom } from 'nanostores'
import type { Account } from '../../../../preload/index.ts'

export interface PrincipalState {
  accounts: Account[]
  activeId: string | undefined
  displayName: string
  loading: boolean
}

export const $principal = atom<PrincipalState>({
  accounts: [],
  activeId: undefined,
  displayName: 'Dossier',
  loading: true,
})

export async function loadState(): Promise<void> {
  const state = await window.dossier.getState()
  $principal.set({ ...state, loading: false })
}

export async function selectAccount(id: string): Promise<void> {
  const state = await window.dossier.selectAccount(id)
  $principal.set({ ...state, loading: false })
}
