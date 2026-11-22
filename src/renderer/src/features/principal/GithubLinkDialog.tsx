import { useEffect, useRef, useState } from 'preact/hooks'
import type { GithubVerification } from '../../../../preload/index.ts'
import { applyState, showToast } from './store.ts'

type Step =
  | { kind: 'form' }
  | { kind: 'waiting'; verification: GithubVerification }
  | { kind: 'error'; message: string }

type CliImport = { username: string; name: string; email: string | undefined }

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

  // docs/product.md: "sincronizar cuentas previas a Dossier" (b) — ofrece
  // la sesión de `gh` CLI si hay una, nunca la usa sin que el usuario la
  // confirme acá (igual que escribir la etiqueta y tocar "Vincular").
  const [cliImport, setCliImport] = useState<CliImport | null>(null)
  const [importingCli, setImportingCli] = useState(false)

  useEffect(() => {
    // Hallazgo de revisión: un token de `gh` ya inválido (expirado,
    // revocado) hace que esto rechace (C1.4, nunca se oculta el error de
    // la API) — acá no hay nada que vincular todavía, así que se trata
    // como "no hay nada para ofrecer", nunca como un error de diálogo.
    window.dossier
      .checkGithubCliImport()
      .then(setCliImport)
      .catch(() => setCliImport(null))
  }, [])

  async function handleImportCli(): Promise<void> {
    const trimmed = label.trim()
    if (!trimmed) return
    setImportingCli(true)
    try {
      applyState(await window.dossier.importGithubCliAccount(trimmed))
      showToast(`${trimmed} vinculada`)
      onLinked()
    } catch (err) {
      setStep({
        kind: 'error',
        message: err instanceof Error ? err.message : 'No se pudo importar la cuenta.',
      })
    } finally {
      setImportingCli(false)
    }
  }

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

            {cliImport && (
              <div class="cli-import-banner">
                <span>
                  Ya tenés sesión de <strong>gh</strong> CLI con <strong>{cliImport.username}</strong>.
                </span>
                <button
                  type="button"
                  class="btn-add btn-secondary"
                  disabled={!label.trim() || importingCli}
                  onClick={() => void handleImportCli()}
                >
                  {importingCli ? 'Vinculando…' : 'Usar esta cuenta'}
                </button>
              </div>
            )}
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
