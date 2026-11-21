import { useRef, useState } from 'preact/hooks'
import type { GithubVerification } from '../../../../preload/index.ts'
import { applyState, showToast } from './store.ts'

type Step =
  | { kind: 'form' }
  | { kind: 'waiting'; verification: GithubVerification }
  | { kind: 'error'; message: string }

export function GithubLinkDialog({
  onClose,
  onLinked,
}: {
  onClose: () => void
  onLinked: () => void
}) {
  const [label, setLabel] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [copied, setCopied] = useState(false)
  const unsubscribe = useRef<(() => void) | null>(null)

  async function handleSubmit(event: Event) {
    event.preventDefault()
    const trimmed = label.trim()
    try {
      unsubscribe.current = window.dossier.onGithubVerification((verification) => {
        setStep({ kind: 'waiting', verification })
        // Apenas hay código, se abre el navegador solo — el botón de abajo
        // queda para volver a abrirlo si cerraron la pestaña.
        void window.dossier.openExternal(verification.verification_uri)
      })
      applyState(await window.dossier.startGithubLink(trimmed))
      unsubscribe.current?.()
      showToast(`${trimmed} vinculada`)
      onLinked()
    } catch (err) {
      unsubscribe.current?.()
      setStep({
        kind: 'error',
        message: err instanceof Error ? err.message : 'No se pudo vincular la cuenta.',
      })
    }
  }

  function handleClose() {
    unsubscribe.current?.()
    onClose()
  }

  return (
    <div class="dialog-overlay" onClick={handleClose}>
      <div class="dialog-card" onClick={(event) => event.stopPropagation()}>
        <div class="dialog-header">
          <span class="dialog-title">Vincular cuenta de GitHub</span>
          <button class="icon-action-btn" title="Cerrar" onClick={handleClose}>
            <svg width="13" height="13">
              <use href="#icon-x" />
            </svg>
          </button>
        </div>

        {step.kind === 'form' && (
          <form class="dialog-form" onSubmit={handleSubmit}>
            <div class="dialog-field">
              <label for="gh-label">Etiqueta</label>
              <input
                id="gh-label"
                class="dialog-input"
                placeholder="Personal, Trabajo..."
                value={label}
                onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <button class="btn-add btn-primary" type="submit" disabled={!label.trim()}>
              Vincular
            </button>
          </form>
        )}

        {step.kind === 'waiting' && (
          <>
            <p class="dialog-hint">Ingresá este código en GitHub para autorizar la cuenta.</p>
            <div class="device-code-row">
              <span class="device-code">{step.verification.user_code}</span>
              <button
                class="icon-action-btn"
                title="Copiar código"
                onClick={async () => {
                  await navigator.clipboard.writeText(step.verification.user_code)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                <svg width="13" height="13">
                  <use href={copied ? '#icon-check' : '#icon-copy'} />
                </svg>
              </button>
            </div>
            <button
              class="btn-add btn-primary"
              onClick={() => void window.dossier.openExternal(step.verification.verification_uri)}
            >
              Abrir GitHub
            </button>
          </>
        )}

        {step.kind === 'error' && (
          <>
            <p class="dialog-error">{step.message}</p>
            <button class="btn-add btn-secondary" onClick={() => setStep({ kind: 'form' })}>
              Reintentar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
