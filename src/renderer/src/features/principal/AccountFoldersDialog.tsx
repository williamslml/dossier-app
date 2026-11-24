import { useStore } from '@nanostores/preact'
import { useEffect, useState } from 'preact/hooks'
import {
  $pins,
  clearSigningKey,
  loadPins,
  pinFolder,
  setEnforced,
  setSigningKey,
  unpinFolder,
} from './store.ts'
import type { Account } from '../../../../preload/index.ts'

/** docs/product.md: la clave de firma es parte del perfil de la cuenta, se
    asigna junto a las carpetas que se van a vincular — nunca un switch
    global aparte. Dossier no genera ni importa claves, solo referencia una
    ya existente (el usuario la crea con `ssh-keygen`/`gpg --gen-key`). */
function SigningKeySection({ account }: { account: Account }) {
  const [format, setFormat] = useState<'openpgp' | 'ssh'>('openpgp')
  const [keyIdDraft, setKeyIdDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAssign(event: Event): Promise<void> {
    event.preventDefault()
    const trimmed = keyIdDraft.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      await setSigningKey(account.id, format, trimmed)
      setKeyIdDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar la clave.')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await clearSigningKey(account.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la clave.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="settings-group">
      <span class="pin-account">Clave de firma de commits</span>
      {account.signingKey ? (
        <div class="pin-row">
          <span class="pin-path" title={account.signingKey.keyId}>
            {account.signingKey.keyId}
          </span>
          <span class="pin-account">
            {account.signingKey.format === 'ssh' ? 'SSH' : 'OpenPGP'}
          </span>
          <button
            type="button"
            class="icon-action-btn"
            title="Quitar clave"
            disabled={saving}
            onClick={() => void handleClear()}
          >
            <svg width="13" height="13">
              <use href="#icon-x" />
            </svg>
          </button>
        </div>
      ) : (
        <form class="pin-add-form" onSubmit={(e) => void handleAssign(e)}>
          <select
            class="dialog-input"
            value={format}
            onInput={(e) => setFormat((e.target as HTMLSelectElement).value as 'openpgp' | 'ssh')}
          >
            <option value="openpgp">OpenPGP (fingerprint)</option>
            <option value="ssh">SSH (ruta a la clave pública)</option>
          </select>
          <input
            class="dialog-input"
            placeholder={format === 'ssh' ? '~/.ssh/id_ed25519.pub' : 'Fingerprint de la clave'}
            value={keyIdDraft}
            onInput={(e) => setKeyIdDraft((e.target as HTMLInputElement).value)}
          />
          {error && <p class="dialog-error">{error}</p>}
          <button type="submit" class="btn-add btn-secondary" disabled={saving || !keyIdDraft.trim()}>
            {saving ? 'Asignando…' : 'Asignar clave'}
          </button>
        </form>
      )}
    </div>
  )
}

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

        <SigningKeySection account={account} />

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
