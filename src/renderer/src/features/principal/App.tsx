import { useStore } from '@nanostores/preact'
import { useEffect } from 'preact/hooks'
import { $principal, loadState, selectAccount } from './store.ts'
import { TitleBar } from './TitleBar.tsx'
import { ActiveBanner } from './ActiveBanner.tsx'
import { AccountCard } from './AccountCard.tsx'
import { AddButtons } from './AddButtons.tsx'
import { StatusToast } from './StatusToast.tsx'
import { Footer } from './Footer.tsx'

export function App() {
  const state = useStore($principal)

  useEffect(() => {
    void loadState()
  }, [])

  const active = state.accounts.find((a) => a.id === state.activeId)

  return (
    <div class="app-window">
      <TitleBar displayName={state.displayName} />
      <div class="container">
        <ActiveBanner active={active} />

        {/* S5.3: el prototipo no admitía cero cuentas; acá sí. */}
        {state.loading ? null : state.accounts.length === 0 ? (
          <div class="empty-state">
            <svg width="28" height="28">
              <use href="#icon-git-branch" />
            </svg>
            <span>Todavía no vinculaste ninguna cuenta.</span>
          </div>
        ) : (
          <div class="account-list">
            {state.accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                selected={account.id === state.activeId}
                onSelect={(id) => void selectAccount(id)}
              />
            ))}
          </div>
        )}

        <AddButtons />
        <StatusToast message="Sincronizado con el gestor de credenciales de Git." />
      </div>
      <Footer />
    </div>
  )
}
