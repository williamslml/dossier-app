import { useState } from 'preact/hooks'
import { GithubLinkDialog } from './GithubLinkDialog.tsx'
import { GitlabLinkDialog } from './GitlabLinkDialog.tsx'

type OpenDialog = 'github' | 'gitlab' | null

export function AddButtons() {
  const [open, setOpen] = useState<OpenDialog>(null)
  const close = () => setOpen(null)

  return (
    <div class="add-buttons">
      <div class="btn-row-split">
        <button class="btn-add btn-gh" onClick={() => setOpen('github')}>
          <svg width="14" height="14">
            <use href="#icon-github" />
          </svg>
          GitHub
        </button>
        <button class="btn-add btn-gl" onClick={() => setOpen('gitlab')}>
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
        Clonar repositorio
      </button>

      {open === 'github' && <GithubLinkDialog onClose={close} onLinked={close} />}
      {open === 'gitlab' && <GitlabLinkDialog onClose={close} onLinked={close} />}
    </div>
  )
}
