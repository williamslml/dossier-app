import type { CredentialStatus } from '../../../../preload/index.ts'
import { recheckCredentials } from './store.ts'

const GIT_FOR_WINDOWS_URL = 'https://git-scm.com/downloads/win'

/** docs/product.md, tabla de riesgos: 3 estados posibles, nunca solo
    "sincronizado/no". Lectura nada más — ningún botón acá reordena la
    cadena de `credential.helper`, solo la vuelve a leer o lleva a instalar
    Git for Windows (que trae GCM incluido). */
function describe(status: CredentialStatus | null): { label: string; variant: 'ok' | 'warn' | 'error' } {
  if (!status) return { label: 'Verificando…', variant: 'warn' }
  if (!status.gcmConfigured) return { label: 'GCM no detectado', variant: 'error' }
  if (status.otherHelperBeforeGcm) return { label: 'Otro gestor puede interferir', variant: 'warn' }
  return { label: 'Sincronizado', variant: 'ok' }
}

export function Footer({ status }: { status: CredentialStatus | null }) {
  const { label, variant } = describe(status)

  function handleClick(): void {
    if (!status?.gcmConfigured) {
      void window.dossier.openExternal(GIT_FOR_WINDOWS_URL)
    }
    void recheckCredentials()
  }

  return (
    <div class="app-footer">
      <span class="footer-helper">
        <svg width="11" height="11">
          <use href="#icon-lock" />
        </svg>
        Windows Credential Manager
      </span>
      <button
        class="footer-status"
        type="button"
        title={
          status?.gcmConfigured === false
            ? 'Git Credential Manager no está en la cadena de credential.helper — clic para instalar Git for Windows y reintentar'
            : 'Clic para volver a verificar'
        }
        onClick={handleClick}
      >
        <span class={`status-dot status-dot--${variant}`} aria-hidden="true" />
        {label}
      </button>
    </div>
  )
}
