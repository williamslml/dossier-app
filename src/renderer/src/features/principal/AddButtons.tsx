export function AddButtons() {
  return (
    <div class="add-buttons">
      <div class="btn-row-split">
        <button class="btn-add btn-gh" disabled title="Próximamente">
          <svg width="14" height="14">
            <use href="#icon-github" />
          </svg>
          GitHub
        </button>
        <button class="btn-add btn-gl" disabled title="Próximamente">
          <svg width="14" height="14" style={{ color: '#fc6d26' }}>
            <use href="#icon-gitlab" />
          </svg>
          GitLab
        </button>
      </div>
      <button class="btn-add btn-clone-full" disabled title="Próximamente">
        <svg width="14" height="14">
          <use href="#icon-download-cloud" />
        </svg>
        Clonar repositorio con perfil...
      </button>
    </div>
  )
}
