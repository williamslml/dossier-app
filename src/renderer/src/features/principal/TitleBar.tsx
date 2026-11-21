export function TitleBar({ displayName }: { displayName: string }) {
  return (
    <div class="title-bar">
      <div class="title-bar-left">
        <svg width="15" height="15">
          <use href="#icon-git-branch" />
        </svg>
        <span>{displayName}</span>
      </div>
      <div class="title-bar-right">
        <span class="vault-badge" title="Credenciales cifradas en el llavero del sistema operativo">
          <svg width="10" height="10">
            <use href="#icon-shield-lock" />
          </svg>
          Bóveda
        </span>
        <button
          class="icon-action-btn"
          title="Cerrar (la app sigue en la bandeja)"
          onClick={() => window.dossier.hideWindow()}
        >
          <svg width="13" height="13">
            <use href="#icon-x" />
          </svg>
        </button>
      </div>
    </div>
  )
}
