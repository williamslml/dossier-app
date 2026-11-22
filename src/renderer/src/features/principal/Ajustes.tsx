import { useStore } from '@nanostores/preact'
import { useEffect, useState } from 'preact/hooks'
import {
  $doctorChecks,
  $doctorLoading,
  $orphanedCredentials,
  $principal,
  $settings,
  loadOrphanedCredentials,
  removeOrphanedCredential,
  runDoctorCheck,
  updateSettings,
} from './store.ts'
import type { Theme } from '../../../../preload/index.ts'

const THEME_LABEL: Record<Theme, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  sistema: 'Sistema',
}

const THEME_ICON: Record<Theme, string> = {
  claro: '#icon-sun',
  oscuro: '#icon-moon',
  sistema: '#icon-monitor',
}

function MantenimientoCredenciales() {
  const orphans = useStore($orphanedCredentials)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadOrphanedCredentials()
  }, [])

  function orphanKey(o: { host: string; username: string }): string {
    return `${o.host}:${o.username}`
  }

  async function handleRemove(host: string, username: string) {
    setError(null)
    try {
      await removeOrphanedCredential(host, username)
      setConfirming(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar la credencial.')
    }
  }

  // El estado de sincronización ya se ve en el footer, en todas las
  // pantallas — no hace falta repetirlo acá. Esta sección solo aparece
  // cuando hay algo que limpiar.
  if (orphans.length === 0) return null

  return (
    <section class="settings-section">
      <h3>Credenciales huérfanas</h3>
      {error && <p class="dialog-error">{error}</p>}
      <div class="pins-list">
        {orphans.map((orphan) => (
          <div class="pin-row" key={orphanKey(orphan)}>
            <div class="pin-info">
              <span class="pin-path">{orphan.username}</span>
              <span class="pin-account">{orphan.host}</span>
            </div>
            {confirming === orphanKey(orphan) ? (
              <div class="pin-add-actions">
                <button type="button" class="btn-secondary" onClick={() => setConfirming(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  onClick={() => void handleRemove(orphan.host, orphan.username)}
                >
                  Borrar
                </button>
              </div>
            ) : (
              <button
                type="button"
                class="icon-action-btn"
                title="Borrar credencial huérfana"
                onClick={() => setConfirming(orphanKey(orphan))}
              >
                <svg width="13" height="13">
                  <use href="#icon-x" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** M-Doctor (docs/product.md): un chequeo a pedido por carpeta fijada —
    nunca reactivo como la guardia de identidad, nunca escribe nada. */
function Doctor() {
  const checks = useStore($doctorChecks)
  const loading = useStore($doctorLoading)

  useEffect(() => {
    void runDoctorCheck()
  }, [])

  return (
    <section class="settings-section">
      <div class="doctor-header">
        <h3>Doctor</h3>
        <button
          type="button"
          class="btn-secondary doctor-recheck"
          disabled={loading}
          onClick={() => void runDoctorCheck()}
        >
          Verificar de nuevo
        </button>
      </div>
      {loading && checks.length === 0 ? (
        <p class="doctor-empty">Verificando…</p>
      ) : checks.length === 0 ? (
        <p class="doctor-empty">No hay carpetas fijadas todavía.</p>
      ) : (
        <div class="pins-list">
          {checks.map((check) => (
            <div class="pin-row" key={check.path}>
              <div class="pin-info">
                <span class="pin-path" title={check.path}>
                  {check.path}
                </span>
                <span class="pin-account">
                  {check.accountLabel}
                  {!check.hasRepo && ' · sin repo todavía'}
                </span>
                {!check.ok && check.detail && <span class="doctor-detail">{check.detail}</span>}
              </div>
              <svg
                width="14"
                height="14"
                class={check.ok ? 'doctor-icon-ok' : 'doctor-icon-error'}
              >
                <use href={check.ok ? '#icon-check' : '#icon-x'} />
              </svg>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function Ajustes() {
  const settings = useStore($settings)
  const { version } = useStore($principal)

  return (
    <div class="container ajustes-screen">
      <section class="settings-section">
        <h3>Apariencia</h3>
        <div class="theme-options">
          {(['claro', 'oscuro', 'sistema'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              class={`theme-option ${settings.theme === theme ? 'selected' : ''}`}
              onClick={() => void updateSettings({ theme })}
            >
              <svg width="18" height="18">
                <use href={THEME_ICON[theme]} />
              </svg>
              {THEME_LABEL[theme]}
            </button>
          ))}
        </div>
      </section>

      <section class="settings-section">
        <h3>Inicio</h3>
        <div class="settings-group">
          <label class="settings-toggle-row">
            <span>Abrir Dossier al iniciar Windows</span>
            <input
              type="checkbox"
              class="toggle-switch"
              checked={settings.launchAtStartup}
              onChange={(event) =>
                void updateSettings({ launchAtStartup: event.currentTarget.checked })
              }
            />
          </label>
          <div class="shortcut-row">
            <div class="shortcut-row-text">
              <span class="shortcut-row-title">Atajo global</span>
              <span class="shortcut-row-hint">Abre u oculta la ventana desde cualquier lado</span>
            </div>
            <div class="keycaps">
              <span class="key">Ctrl</span>
              <span>+</span>
              <span class="key">Shift</span>
              <span>+</span>
              <span class="key">D</span>
            </div>
          </div>
        </div>
      </section>

      <MantenimientoCredenciales />
      <Doctor />

      <div class="about-row">
        <span class="about-row-label">Acerca de</span>
        <span class="about-row-value">Dossier {version ? `v${version}` : ''}</span>
      </div>
    </div>
  )
}
