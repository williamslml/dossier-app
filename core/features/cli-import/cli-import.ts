import { execFile } from 'node:child_process'

/** Firma mínima que necesitamos de `execFile` — no el tipo real (muy
    sobrecargado) para poder inyectar un `exec` falso en los tests sin
    invocar nunca el `gh` real: su salida es un token verdadero, nunca debe
    aparecer en un test ni en un log (a diferencia de `git config`, que no
    es secreto). */
export type ExecFile = (
  command: string,
  args: string[],
  options: { encoding: 'utf8' },
  callback: (error: Error | null, stdout: string, stderr?: string) => void,
) => void

/**
 * `gh auth token` imprime el token cacheado por GitHub CLI si hay una
 * sesión activa — docs/product.md: "sincronizar cuentas previas a
 * Dossier" (b). Nunca lanza: `gh` ausente o sin sesión es "no hay nada que
 * importar", no un error — el llamador decide qué hacer con `undefined`.
 */
export function findGithubCliToken(exec: ExecFile = execFile): Promise<string | undefined> {
  return new Promise((resolve) => {
    exec('gh', ['auth', 'token'], { encoding: 'utf8' }, (err, stdout) => {
      if (err) {
        resolve(undefined)
        return
      }
      const token = stdout.trim()
      resolve(token === '' ? undefined : token)
    })
  })
}

/**
 * `glab auth status --show-token --hostname <host>` imprime el token
 * cacheado por GitLab CLI para ese host, si hay sesión — docs/product.md:
 * "sincronizar cuentas previas a Dossier" (b). Probado en vivo contra el
 * binario real (host `.invalid`, nunca una cuenta real), dos hallazgos
 * reales: (1) `glab` sale con código != 0 incluso cuando SÍ encuentra el
 * token (intenta confirmarlo contra la API; si el host no responde o el
 * token ya no es válido, igual imprime la línea "Token found in ...: X" y
 * recién después reporta el error) — nunca hay que confiar en el código de
 * salida; (2) esa línea sale por **stderr**, no por stdout (a diferencia
 * de `gh auth token`) — confirmado con un `execFile` real, no asumido por
 * cómo se ve combinado en una terminal. El texto exacto cambia según dónde
 * lo haya guardado `glab` (archivo en texto plano o el keyring real del
 * sistema operativo), pero el patrón "Token found in ...: <token>" es el
 * mismo en los dos casos.
 */
export function findGitlabCliToken(host: string, exec: ExecFile = execFile): Promise<string | undefined> {
  return new Promise((resolve) => {
    exec(
      'glab',
      ['auth', 'status', '--show-token', '--hostname', host],
      { encoding: 'utf8' },
      (_err, stdout, stderr) => {
        const combined = `${stdout ?? ''}\n${stderr ?? ''}`
        const match = /Token found in [^:]+:\s*(\S+)/.exec(combined)
        resolve(match?.[1])
      },
    )
  })
}
