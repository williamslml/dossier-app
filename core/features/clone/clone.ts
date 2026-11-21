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
    ya vinculada. Se corre antes de pasarle nada a Git. */
export function validateCloneUrl(url: string, knownHosts: string[]): void {
  if (!url.startsWith('https://')) {
    throw new InvalidCloneUrlError(url, 'solo se admite https://')
  }

  let host: string
  try {
    host = new URL(url).host
  } catch {
    throw new InvalidCloneUrlError(url, 'no es una URL válida')
  }

  if (!knownHosts.includes(host)) {
    throw new InvalidCloneUrlError(url, `ninguna cuenta vinculada tiene el host "${host}"`)
  }
}

/**
 * Q1.1/Q1.2: clona con `-c credential.<host>.username=<username>` — un
 * override puntual de esta sola invocación (nunca toca `~/.gitconfig` ni
 * `active.gitconfig`), para que GCM resuelva la credencial de la cuenta
 * elegida sin importar cuál esté activa. `git.raw([...])`, no el
 * `.clone()` de simple-git, para que el `-c` quede exactamente antes de
 * `clone` (mismo patrón que el resto de `core`, ver design.md).
 */
export async function cloneRepo(
  url: string,
  destPath: string,
  account: CloneAccount,
): Promise<void> {
  const git = simpleGit()
  await git.raw([
    '-c',
    `credential.${account.host}.username=${account.username}`,
    'clone',
    url,
    destPath,
  ])
}
