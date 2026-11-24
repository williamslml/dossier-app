import { useStore } from '@nanostores/preact'
import { useEffect, useState } from 'preact/hooks'
import type { Account } from '../../../../preload/index.ts'
import { $pins, loadPins, removeAccount, showToast } from './store.ts'

/** docs/product.md: desvincular es destructivo (desfija carpetas, saca el
    includeIf) — exige confirmación explícita, nunca un solo clic. El token
    sigue en GCM a propósito: desvincular y revocar son dos decisiones
    distintas (la revocación ya existe, "Credenciales huérfanas" en Ajustes). */
export function RemoveAccountDialog({
  account,
  onClose,
  onRemoved,
}: {
  account: Account
  onClose: () => void
  onRemoved: () => void
}) {
  const pinnedCount = useStore($pins).filter((rule) => rule.accountId === account.id).length
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadPins()
  }, [])

  async function handleConfirm(): Promise<void> {
    setRemoving(true)
    try {
      await removeAccount(account.id)
      showToast(`${account.label} desvinculada`)
      onRemoved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular la cuenta.')
      setRemoving(false)
    }
  }

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog-card" onClick={(event) => event.stopPropagation()}>
        <div class="dialog-header">
          <span class="dialog-title">Desvincular {account.label}</span>
          <button class="icon-action-btn" title="Cerrar" onClick={onClose}>
            <svg width="13" height="13">
              <use href="#icon-x" />
            </svg>
          </button>
        </div>

        <p class="dialog-hint">
          {pinnedCount > 0
            ? `También desfija ${pinnedCount} ${pinnedCount === 1 ? 'carpeta' : 'carpetas'} que ${pinnedCount === 1 ? 'usa' : 'usan'} esta cuenta. `
            : ''}
          El token sigue guardado en Windows Credential Manager — podés borrarlo desde Ajustes
          ("Credenciales huérfanas") si ya no lo necesitás.
        </p>
        {error && <p class="dialog-error">{error}</p>}
        <div class="pin-add-actions">
          <button type="button" class="btn-secondary" disabled={removing} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            class="btn-primary"
            disabled={removing}
            onClick={() => void handleConfirm()}
          >
            {removing ? 'Desvinculando…' : 'Desvincular'}
          </button>
        </div>
      </div>
    </div>
  )
}
