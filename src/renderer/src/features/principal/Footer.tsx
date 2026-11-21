export function Footer({ synced }: { synced: boolean }) {
  return (
    <div class="app-footer">
      <span class="footer-helper">
        <svg width="11" height="11">
          <use href="#icon-lock" />
        </svg>
        Windows Credential Manager
      </span>
      <span class="footer-status">
        <span class={`status-dot ${synced ? 'status-dot--ok' : ''}`} aria-hidden="true" />
        {synced ? 'Sincronizado' : 'Esperando credencial'}
      </span>
    </div>
  )
}
