import { useStore } from '@nanostores/preact'
import { useState } from 'preact/hooks'
import { $principal, checkSecretStore, showToast } from './store.ts'
import { CloneDialog } from './CloneDialog.tsx'
import { GithubLinkDialog } from './GithubLinkDialog.tsx'
import { GitlabLinkDialog } from './GitlabLinkDialog.tsx'

type OpenDialog = 'github' | 'gitlab' | 'clone' | null

export function AddButtons() {
  const { accounts } = useStore($principal)
  const [open, setOpen] = useState<OpenDialog>(null)
  const [checking, setChecking] = useState(false)
  const close = () => setOpen(null)

  /** docs/product.md: bloquea el flujo de vincular con un aviso claro si el
      almacén de secretos no puede guardar/leer de verdad, en vez de dejar
      que la vinculación falle recién al final (defensivo — en la práctica,
      en Windows, casi nunca da `healthy: false`). */
  async function openLinkDialog(dialog: 'github' | 'gitlab'): Promise<void> {
    setChecking(true)
    try {
      const health = await checkSecretStore()
      if (!health.healthy) {
        showToast(
          `No se puede vincular una cuenta ahora mismo: ${health.detail ?? 'el almacén de credenciales no respondió.'}`,
        )
        return
      }
      setOpen(dialog)
    } catch (err) {
      // checkSecretStoreHealth (core) nunca lanza — esto solo cubriría un
      // fallo del propio IPC (hallazgo de revisión), no un almacén roto.
      showToast(err instanceof Error ? err.message : 'No se pudo verificar el almacén de credenciales.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div class="add-buttons">
      <div class="btn-row-split">
        <button
          class="btn-add btn-gh"
          disabled={checking}
          onClick={() => void openLinkDialog('github')}
        >
          <svg width="14" height="14">
            <use href="#icon-github" />
          </svg>
          GitHub
        </button>
        <button
          class="btn-add btn-gl"
          disabled={checking}
          onClick={() => void openLinkDialog('gitlab')}
        >
          <svg width="14" height="14" style={{ color: '#fc6d26' }}>
            <use href="#icon-gitlab" />
          </svg>
          GitLab
        </button>
      </div>
      <button class="btn-add btn-clone-full" onClick={() => setOpen('clone')}>
        <svg width="14" height="14">
          <use href="#icon-download-cloud" />
        </svg>
        Clonar repositorio
      </button>

      {open === 'github' && <GithubLinkDialog onClose={close} onLinked={close} />}
      {open === 'gitlab' && <GitlabLinkDialog onClose={close} onLinked={close} />}
      {open === 'clone' && <CloneDialog accounts={accounts} onClose={close} onCloned={close} />}
    </div>
  )
}
