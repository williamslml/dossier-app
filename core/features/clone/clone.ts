import { simpleGit } from 'simple-git'

export interface CloneAccount {
  host: string
  username: string
}

/** Q2: la URL no pasó la validación antes de llegar a Git — nunca se
    confía en que Git rechace algo peligroso por su cuenta. */
export class InvalidCloneUrlError extends Error {
  constructor(
    readonly url: string,
    reason: string,
  ) {
    super(`"${url}" no es una URL válida para clonar: ${reason}`)
    this.name = 'InvalidCloneUrlError'
  }
}

/** Q2.1/Q2.2: solo `https://`, y el host tiene que ser el de alguna cuenta
    ya vinculada. Se corre antes de pasarle nada a Git.
    Hallazgo de revisión: una URL con usuario/contraseña embebidos
    (`https://token@host/...`) pasaba el resto de la validación (el host
    post-"@" es el real, conocido) y terminaba tal cual en el argv del
    proceso de `git clone` — expone el secreto a otros procesos de la
    sesión mientras dura el clone (ADR 0006: nunca un token en argumentos
    de proceso). Se rechaza antes de llegar ahí. */
export function validateCloneUrl(url: string, knownHosts: string[]): void {
  if (!url.startsWith('https://')) {
    throw new InvalidCloneUrlError(url, 'solo se admite https://')
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new InvalidCloneUrlError(url, 'no es una URL válida')
  }

  if (parsed.username || parsed.password) {
    throw new InvalidCloneUrlError(url, 'no puede llevar usuario/contraseña embebidos')
  }

  // `parsed.host` siempre viene en minúsculas (normalización del propio
  // estándar de URL) — el host guardado de una cuenta puede no estarlo
  // (se tipea a mano al vincular GitLab autoalojado, sin normalizar).
  const normalizedKnownHosts = knownHosts.map((h) => h.toLowerCase())
  if (!normalizedKnownHosts.includes(parsed.host)) {
    throw new InvalidCloneUrlError(url, `ninguna cuenta vinculada tiene el host "${parsed.host}"`)
  }
}

/** Un clone puede tardar (repos grandes) — un timeout de duración total
    sería incorrecto. `block` mata el proceso si pasa este tiempo SIN
    ninguna salida nueva (no desde que arrancó) — exactamente el síntoma de
    quedarse esperando un prompt que nunca va a llegar, sin cortar un clone
    lento pero activo. */
const BLOCK_TIMEOUT_MS = 30_000

/**
 * Q1.1/Q1.2: clona con `-c credential.<host>.username=<username>` — un
 * override puntual de esta sola invocación (nunca toca `~/.gitconfig` ni
 * `active.gitconfig`), para que GCM resuelva la credencial de la cuenta
 * elegida sin importar cuál esté activa. `git.raw([...])`, no el
 * `.clone()` de simple-git, para que el `-c` quede exactamente antes de
 * `clone` (mismo patrón que el resto de `core`, ver design.md).
 *
 * Hallazgo de revisión: faltaba desactivar la interactividad — a
 * diferencia de `core/features/git-credential` (que sí lo hace para
 * approve/fill/reject), esta llamada podía quedarse esperando un prompt
 * para siempre si GCM no resolvía la credencial en silencio (ADR
 * 0004/0006: nunca interactivo). `GIT_TERMINAL_PROMPT=0` por sí solo NO
 * alcanza (confirmado con un test real que se colgó igual): ese env var
 * apaga el prompt de *Git*, pero el prompt de *GCM* (su propia ventana/CLI
 * interactivo) lo controlan `credential.interactive=false` y
 * `credential.guiPrompt=false` — las tres juntas son la receta completa
 * que ya documenta ADR 0004 punto 3, no solo la primera. Más un timeout de
 * bloqueo como red de contención.
 */
export async function cloneRepo(
  url: string,
  destPath: string,
  account: CloneAccount,
): Promise<void> {
  const git = simpleGit({ timeout: { block: BLOCK_TIMEOUT_MS } }).env('GIT_TERMINAL_PROMPT', '0')
  await git.raw([
    '-c',
    `credential.${account.host}.username=${account.username}`,
    '-c',
    'credential.interactive=false',
    '-c',
    'credential.guiPrompt=false',
    'clone',
    url,
    destPath,
  ])
}
