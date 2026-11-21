import { useStore } from '@nanostores/preact'
import { useEffect, useState } from 'preact/hooks'
import { $pins, loadPins, pinFolder, setEnforced, unpinFolder } from './store.ts'
import type { Account } from '../../../../preload/index.ts'

export function AccountFoldersDialog({
  account,
  onClose,
}: {
  account: Account
  onClose: () => void
}) {
  const pins = useStore($pins).filter((rule) => rule.accountId === account.id)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardWarning, setGuardWarning] = useState<string | null>(null)

  useEffect(() => {
    void loadPins()
  }, [])

  async function handleToggleEnforced(path: string, enforced: boolean) {
    setGuardWarning(null)
    const { blockedHooks } = await setEnforced(path, enforced)
    if (blockedHooks.length > 0) {
      setGuardWarning(
        `Ya había un hook propio en esta carpeta (${blockedHooks.join(', ')}) — no se pisó, pero la guardia no queda activa del todo.`,
      )
    }
  }

  async function handlePickFolder() {
    const path = await window.dossier.pickFolder()
    if (path) {
      setPendingPath(path)
      setError(null)
    }
  }

  async function handleConfirmPin() {
    if (!pendingPath) return
    try {
      await pinFolder(pendingPath, account.id)
      setPendingPath(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo fijar la carpeta.')
    }
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog-card" onClick={(event) => event.stopPropagation()}>
        <div class="dialog-header">
          <span class="dialog-title">Carpetas de {account.label}</span>
          <button class="icon-action-btn" title="Cerrar" onClick={onClose}>
            <svg width="13" height="13">
              <use href="#icon-x" />
            </svg>
          </button>
        </div>

        <div class="pins-list">
          {pins.length === 0 && (
            <p class="settings-about">
              Ningún proyecto usa esta cuenta todavía. Agregá la carpeta donde lo guardaste.
            </p>
          )}
          {guardWarning && <p class="dialog-error">{guardWarning}</p>}
          {pins.map((rule) => (
            <div class="settings-group" key={rule.path}>
              <div class="pin-row">
                <span class="pin-path" title={rule.path}>
                  {rule.path}
                </span>
                <button
                  type="button"
                  class="icon-action-btn"
                  title="Quitar"
                  onClick={() => void unpinFolder(rule.path)}
                >
                  <svg width="13" height="13">
                    <use href="#icon-x" />
                  </svg>
                </button>
              </div>
              <label class="settings-toggle-row">
                <span>Guardia de identidad</span>
                <input
                  type="checkbox"
                  class="toggle-switch"
                  checked={rule.enforced}
                  onChange={(event) =>
                    void handleToggleEnforced(rule.path, event.currentTarget.checked)
                  }
                />
              </label>
            </div>
          ))}
        </div>

        {pendingPath ? (
          <div class="pin-add-form">
            <p class="settings-about" title={pendingPath}>
              {pendingPath}
            </p>
            {error && <p class="dialog-error">{error}</p>}
            <div class="pin-add-actions">
              <button
                type="button"
                class="btn-secondary"
                onClick={() => {
                  setPendingPath(null)
                  setError(null)
                }}
              >
                Cancelar
              </button>
              <button type="button" class="btn-primary" onClick={() => void handleConfirmPin()}>
                Fijar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" class="theme-option" onClick={() => void handlePickFolder()}>
            + Agregar carpeta
          </button>
        )}
      </div>
    </div>
  )
}
