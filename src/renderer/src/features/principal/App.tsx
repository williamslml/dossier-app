import { useStore } from '@nanostores/preact'
import { useEffect, useState } from 'preact/hooks'
import {
  $credentialStatus,
  $principal,
  $screen,
  $toastMessage,
  loadCredentialStatus,
  loadIdentityConflicts,
  loadSettings,
  loadState,
  subscribeIdentityConflicts,
  subscribeThemeUpdates,
} from './store.ts'
import { TitleBar } from './TitleBar.tsx'
import { AccountCard } from './AccountCard.tsx'
import { AccountFoldersDialog } from './AccountFoldersDialog.tsx'
import { AddButtons } from './AddButtons.tsx'
import { IdentityConflicts } from './IdentityConflicts.tsx'
import { StatusToast } from './StatusToast.tsx'
import { Footer } from './Footer.tsx'
import { Ajustes } from './Ajustes.tsx'

export function App() {
  const state = useStore($principal)
  const toastMessage = useStore($toastMessage)
  const screen = useStore($screen)
  const credentialStatus = useStore($credentialStatus)
  const [foldersForAccountId, setFoldersForAccountId] = useState<string | null>(null)
  const foldersAccount = state.accounts.find((a) => a.id === foldersForAccountId)

  useEffect(() => {
    void loadState()
    void loadSettings()
    void loadIdentityConflicts()
    void loadCredentialStatus()
    return subscribeThemeUpdates()
  }, [])

  useEffect(subscribeIdentityConflicts, [])

  if (screen === 'ajustes') {
    return (
      <div class="app-window">
        <TitleBar
          displayName={state.displayName}
          screen={screen}
          onOpenSettings={() => $screen.set('ajustes')}
          onBack={() => $screen.set('principal')}
        />
        <Ajustes />
        <Footer status={credentialStatus} />
      </div>
    )
  }

  return (
    <div class="app-window">
      <TitleBar
        displayName={state.displayName}
        screen={screen}
        onOpenSettings={() => $screen.set('ajustes')}
        onBack={() => $screen.set('principal')}
      />
      <div class="container">
        <IdentityConflicts />
        <div class="sessions-area">
          {/* S5.3: el prototipo no admitía cero cuentas; acá sí. */}
          {state.loading ? null : state.accounts.length === 0 ? (
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg width="22" height="22">
                  <use href="#icon-user" />
                </svg>
              </div>
              <span>Vinculá tu primera cuenta</span>
              <span class="empty-state-hint">Con GitHub o GitLab, abajo</span>
            </div>
          ) : (
            <>
              <div class="sessions-header">
                <span>Sesiones activas</span>
                <span class="sessions-count">
                  {state.accounts.length} {state.accounts.length === 1 ? 'perfil' : 'perfiles'}
                </span>
              </div>
              <div class="account-list">
                {state.accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onManageFolders={setFoldersForAccountId}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <AddButtons />
        {toastMessage && <StatusToast message={toastMessage} />}
        {foldersAccount && (
          <AccountFoldersDialog
            account={foldersAccount}
            onClose={() => setFoldersForAccountId(null)}
          />
        )}
      </div>
      <Footer status={credentialStatus} />
    </div>
  )
}
