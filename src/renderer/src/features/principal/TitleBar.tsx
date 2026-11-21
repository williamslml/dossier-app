interface TitleBarProps {
  displayName: string
  screen: 'principal' | 'ajustes'
  onOpenSettings: () => void
  onBack: () => void
}

export function TitleBar({ displayName, screen, onOpenSettings, onBack }: TitleBarProps) {
  return (
    <div class="title-bar">
      <div class="title-bar-left">
        <svg width="18" height="18">
          <use href="#icon-git-branch" />
        </svg>
        <div class="title-bar-text">
          <span class="title-bar-name">{displayName}</span>
          <span class="title-bar-subtitle">Administración de identidades Git</span>
        </div>
      </div>
      <div class="title-bar-right">
        {screen === 'ajustes' ? (
          <button class="icon-action-btn" title="Volver" onClick={onBack}>
            <svg width="15" height="15">
              <use href="#icon-arrow-left" />
            </svg>
          </button>
        ) : (
          <button class="icon-action-btn" title="Ajustes" onClick={onOpenSettings}>
            <svg width="15" height="15">
              <use href="#icon-settings" />
            </svg>
          </button>
        )}
        <button
          class="icon-action-btn"
          title="Minimizar"
          onClick={() => window.dossier.minimizeWindow()}
        >
          <svg width="13" height="13">
            <use href="#icon-minus" />
          </svg>
        </button>
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
