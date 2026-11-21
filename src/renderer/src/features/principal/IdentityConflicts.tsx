import { useState } from 'preact/hooks'
import { useStore } from '@nanostores/preact'
import { $identityConflicts, resolveIdentityConflict } from './store.ts'
import type { ConflictRecord, IdentityConflictAction } from '../../../../preload/index.ts'

function folderName(repoPath: string): string {
  return (
    repoPath
      .replace(/[/\\]+$/, '')
      .split(/[/\\]/)
      .pop() ?? repoPath
  )
}

function ConflictCard({ conflict }: { conflict: ConflictRecord }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleAction(action: IdentityConflictAction) {
    setBusy(true)
    setError(null)
    try {
      await resolveIdentityConflict(conflict.repoPath, action)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver el conflicto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="dialog-error conflict-card">
      <p>
        <strong title={conflict.repoPath}>{folderName(conflict.repoPath)}</strong> se commiteó como{' '}
        <strong>{conflict.actualEmail || '(sin identidad configurada)'}</strong>, pero está fijada a{' '}
        <strong>{conflict.expectedEmail}</strong>.
      </p>
      {error && <p>{error}</p>}
      <div class="pin-add-actions">
        <button
          type="button"
          class="btn-secondary"
          disabled={busy}
          onClick={() => void handleAction('bloquear')}
        >
          Bloquear
        </button>
        <button
          type="button"
          class="btn-secondary"
          disabled={busy}
          onClick={() => void handleAction('reconectar')}
        >
          Reconectar
        </button>
        <button
          type="button"
          class="btn-primary"
          disabled={busy}
          onClick={() => void handleAction('aplicar')}
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}

/** S11.5: notificación en pantalla para cada conflicto de identidad
    pendiente — `main` empuja la lista actualizada cada vez que la ventana
    se muestra (store.ts, subscribeIdentityConflicts). */
export function IdentityConflicts() {
  const conflicts = useStore($identityConflicts)
  if (conflicts.length === 0) return null

  return (
    <div class="conflict-list">
      {conflicts.map((conflict) => (
        <ConflictCard key={conflict.repoPath} conflict={conflict} />
      ))}
    </div>
  )
}
