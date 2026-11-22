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
  callback: (error: Error | null, stdout: string) => void,
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
