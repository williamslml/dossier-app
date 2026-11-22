import { useState } from 'preact/hooks'
import { cloneRepo, showToast } from './store.ts'
import type { Account } from '../../../../preload/index.ts'

type Step = { kind: 'form' } | { kind: 'clonando' } | { kind: 'error'; message: string }

/** Q3.2: solo se puede calcular si la URL ya es parseable — mientras no lo
    sea, no hay ningún host con el que filtrar cuentas. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

export function CloneDialog({
  accounts,
  onClose,
  onCloned,
}: {
  accounts: Account[]
  onClose: () => void
  onCloned: () => void
}) {
  const [url, setUrl] = useState('')
  const [accountId, setAccountId] = useState('')
  const [destPath, setDestPath] = useState<string | null>(null)
  const [step, setStep] = useState<Step>({ kind: 'form' })

  const host = hostOf(url)
  // Q3.2/Q3.3: solo cuentas del mismo host que la URL — nunca preseleccionada
  // sola, aunque haya una sola opción (el usuario elige a propósito).
  const matchingAccounts = host ? accounts.filter((a) => a.host === host) : []

  async function handlePickFolder() {
    const path = await window.dossier.pickFolder()
    if (path) setDestPath(path)
  }

  async function handleSubmit(event: Event) {
    event.preventDefault()
    if (!destPath || !accountId) return
    setStep({ kind: 'clonando' })
    try {
      await cloneRepo(url.trim(), destPath, accountId)
      const account = accounts.find((a) => a.id === accountId)
      showToast(`${account?.label ?? 'Repositorio'} clonado`)
      onCloned()
    } catch (err) {
      setStep({
        kind: 'error',
        message: err instanceof Error ? err.message : 'No se pudo clonar el repositorio.',
      })
    }
  }

  const canSubmit = url.trim().length > 0 && !!accountId && !!destPath
  // Hallazgo de revisión: no hay forma de cancelar un clone en curso — si
  // se cerraba el diálogo mientras clonaba, un error quedaba sin mostrar
  // (el componente ya desmontado no puede setear su propio estado). Más
  // simple que agregar cancelación: no dejar cerrar hasta que termine.
  const closeDisabled = step.kind === 'clonando'

  return (
    <div class="dialog-overlay" onClick={closeDisabled ? undefined : onClose}>
      <div class="dialog-card" onClick={(event) => event.stopPropagation()}>
        <div class="dialog-header">
          <span class="dialog-title">Clonar repositorio</span>
          <button
            class="icon-action-btn"
            title={closeDisabled ? 'Esperá a que termine de clonar' : 'Cerrar'}
            disabled={closeDisabled}
            onClick={onClose}
          >
            <svg width="13" height="13">
              <use href="#icon-x" />
            </svg>
          </button>
        </div>

        <form class="dialog-form" onSubmit={(event) => void handleSubmit(event)}>
          <div class="dialog-field">
            <label for="clone-url">URL del repositorio</label>
            <input
              id="clone-url"
              class="dialog-input"
              placeholder="https://github.com/usuario/repo.git"
              value={url}
              disabled={step.kind === 'clonando'}
              onInput={(event) => {
                setUrl((event.target as HTMLInputElement).value)
                setAccountId('')
              }}
              required
            />
          </div>

          <div class="dialog-field">
            <label for="clone-account">Cuenta</label>
            <select
              id="clone-account"
              class="dialog-input"
              value={accountId}
              disabled={step.kind === 'clonando' || matchingAccounts.length === 0}
              onChange={(event) => setAccountId(event.currentTarget.value)}
            >
              <option value="">{host ? 'Elegir cuenta…' : 'Ingresá una URL primero'}</option>
              {matchingAccounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
            {host && matchingAccounts.length === 0 && (
              <p class="settings-about">Ninguna cuenta vinculada tiene el host "{host}".</p>
            )}
          </div>

          <div class="pin-row">
            <div class="pin-info">
              <span class="pin-account">Carpeta destino</span>
              <span class="pin-path" title={destPath ?? ''}>
                {destPath ?? 'Sin elegir'}
              </span>
            </div>
            <button
              type="button"
              class="theme-option"
              disabled={step.kind === 'clonando'}
              onClick={() => void handlePickFolder()}
            >
              Elegir…
            </button>
          </div>

          {step.kind === 'error' && <p class="dialog-error">{step.message}</p>}

          <button
            class="btn-add btn-primary"
            type="submit"
            disabled={!canSubmit || step.kind === 'clonando'}
          >
            {step.kind === 'clonando' ? 'Clonando…' : 'Clonar'}
          </button>
        </form>
      </div>
    </div>
  )
}
