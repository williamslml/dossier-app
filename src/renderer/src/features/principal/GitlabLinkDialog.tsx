import { useEffect, useRef, useState } from 'preact/hooks'
import { applyState, showToast } from './store.ts'

type CliImport = { username: string; name: string; email: string | undefined }

// Funciona igual para gitlab.com que para un servidor autoalojado: usa el
// host que haya puesto el usuario, nunca gitlab.com fijo (ADR, soporte de
// autoalojados desde el día uno). Scope `api` (decisión del usuario, no
// `write_repository`): cubre también glab CLI, Docker Registry,
// extensiones de editor y automatizaciones (p. ej. el servidor MCP de
// GitLab) que necesitan la API además del simple push/pull — ver
// docs/adr/0006-seguridad.md.
function buildTokenUrl(host: string): string {
  const base = /^https?:\/\//.test(host) ? host : `https://${host}`
  return `${base}/-/user_settings/personal_access_tokens?name=Dossier&scopes=api`
}

export function GitlabLinkDialog({
  onClose,
  onLinked,
}: {
  onClose: () => void
  onLinked: () => void
}) {
  const [label, setLabel] = useState('')
  const [host, setHost] = useState('gitlab.com')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [showToken, setShowToken] = useState(false)

  // docs/product.md: "sincronizar cuentas previas a Dossier" (b) — ofrece
  // la sesión de `glab` CLI para el host que el usuario ya escribió acá,
  // nunca la usa sin un clic explícito. A diferencia de GitHub (host fijo
  // `github.com`), acá el host lo decide el usuario, así que se vuelve a
  // chequear cada vez que termina de editarlo, no solo al montar.
  const [cliImport, setCliImport] = useState<CliImport | null>(null)
  const [importingCli, setImportingCli] = useState(false)
  // Hallazgo de revisión: dos chequeos pueden solaparse (el usuario pierde
  // foco del campo, edita, y vuelve a perder foco antes de que resuelva el
  // primero) — si el de un dominio viejo tarda más, podría pisar el
  // resultado ya correcto del dominio actual. Esta ref guarda cuál es el
  // dominio vigente; una respuesta para un dominio que ya no es el actual
  // se descarta en vez de aplicarse.
  const latestHostChecked = useRef('')

  async function checkCliImport(forHost: string): Promise<void> {
    const trimmed = forHost.trim()
    latestHostChecked.current = trimmed
    if (!trimmed) {
      setCliImport(null)
      return
    }
    let result: CliImport | null
    try {
      result = await window.dossier.checkGitlabCliImport(trimmed)
    } catch {
      result = null
    }
    if (latestHostChecked.current === trimmed) {
      setCliImport(result)
    }
  }

  useEffect(() => {
    void checkCliImport(host)
  }, [])

  async function handleImportCli(): Promise<void> {
    const trimmedLabel = label.trim()
    const trimmedHost = host.trim()
    if (!trimmedLabel || !trimmedHost) return
    setImportingCli(true)
    try {
      applyState(await window.dossier.importGitlabCliAccount(trimmedLabel, trimmedHost))
      showToast(`${trimmedLabel} vinculada`)
      onLinked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar la cuenta.')
    } finally {
      setImportingCli(false)
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault()
    setLinking(true)
    setError(null)
    try {
      applyState(await window.dossier.linkGitlab({ label: label.trim(), host: host.trim(), token }))
      showToast(`${label.trim()} vinculada`)
      onLinked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular la cuenta.')
      setLinking(false)
    }
  }

  const canSubmit = !linking && label.trim() && host.trim() && token.trim()

  return (
    <div class="dialog-overlay" onClick={onClose}>
      <div class="dialog-card" onClick={(event) => event.stopPropagation()}>
        <div class="dialog-header">
          <span class="dialog-title">Vincular cuenta de GitLab</span>
          <button class="icon-action-btn" title="Cerrar" onClick={onClose}>
            <svg width="13" height="13">
              <use href="#icon-x" />
            </svg>
          </button>
        </div>

        <form class="dialog-form" onSubmit={handleSubmit}>
          <div class="dialog-field">
            <label for="gl-label">Etiqueta</label>
            <input
              id="gl-label"
              class="dialog-input"
              placeholder="Personal, Cliente..."
              value={label}
              onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
              required
            />
          </div>
          <div class="dialog-field">
            <label for="gl-host">Dominio</label>
            <input
              id="gl-host"
              class="dialog-input"
              value={host}
              onInput={(e) => {
                setHost((e.target as HTMLInputElement).value)
                // Cambiar el dominio después de pedir el token invalida ese
                // enlace (era para el dominio anterior) — se vuelve al paso
                // de crear uno nuevo, sin tener que cerrar el diálogo.
                setShowToken(false)
                // El resultado anterior era para el dominio viejo — se
                // vuelve a chequear recién cuando termine de editar.
                setCliImport(null)
              }}
              onBlur={(e) => void checkCliImport((e.target as HTMLInputElement).value)}
              required
            />
          </div>

          {cliImport && !showToken && (
            <div class="cli-import-banner">
              <span>
                Ya tenés sesión de <strong>glab</strong> CLI con <strong>{cliImport.username}</strong>{' '}
                en este dominio.
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

          {!showToken && (
            <>
              <button
                type="button"
                class="btn-add btn-secondary"
                onClick={() => {
                  void window.dossier.openExternal(buildTokenUrl(host))
                  setShowToken(true)
                }}
              >
                Crear un token
              </button>
            </>
          )}

          {showToken && (
            <>
              <div class="dialog-field">
                <label for="gl-token">Token de acceso personal</label>
                <input
                  id="gl-token"
                  type="password"
                  class="dialog-input"
                  placeholder="glpat-..."
                  value={token}
                  onInput={(e) => setToken((e.target as HTMLInputElement).value)}
                  required
                />
              </div>
              {error && <p class="dialog-error">{error}</p>}
              <button class="btn-add btn-primary" type="submit" disabled={!canSubmit}>
                {linking ? 'Vinculando...' : 'Vincular'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
