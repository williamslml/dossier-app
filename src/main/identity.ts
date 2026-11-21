import { simpleGit } from 'simple-git'
import { brand } from '../../core/index.ts'

/**
 * M3: resuelve la ruta real del config global, usando Git mismo en vez de
 * adivinar `~/.gitconfig` (puede estar en otro lado por `GIT_CONFIG_GLOBAL`
 * o una configuración XDG) — verificado con `git config --global --list
 * --show-origin` real antes de escribir esto (docs/specs/.../design.md).
 */
/** Git cita la ruta al estilo `.gitconfig` (comillas + `\\` si tiene
    backslashes, típico de Windows) cuando hace falta escapar algo —
    confirmado comparando la salida real contra la ruta real pasada. */
function unquoteGitPath(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\\\/g, '\\')
  }
  return raw
}

export async function resolveGlobalConfigPath(env?: Record<string, string>): Promise<string> {
  // `allowUnsafeConfigPaths` solo se habilita cuando se pasa un `env`
  // explícito (siempre de prueba, nunca en producción real) — mismo
  // criterio que ya usa core/features/gitconfig/gitconfig.test.ts.
  const git = env ? simpleGit({ unsafe: { allowUnsafeConfigPaths: true } }).env(env) : simpleGit()

  let output: string
  try {
    output = await git.raw(['config', '--global', '--list', '--show-origin'])
  } catch {
    // M3.2: el archivo ni siquiera existe todavía (máquina nueva) — Git
    // trata esto como error duro con --show-origin, no como salida vacía
    // (verificado: un config global vacío/ausente hace que el comando
    // falle, no que devuelva ''). Mismo camino que un config vacío: forzar
    // su creación con una clave sentinela.
    await git.raw(['config', '--global', `${brand.gitConfigMarker}.initialized`, 'true'])
    return resolveGlobalConfigPath(env)
  }

  const firstLine = output.split('\n')[0] ?? ''
  const match = /^file:(.+?)\t/.exec(firstLine)
  if (match?.[1]) return unquoteGitPath(match[1])
  // Config global existente pero sin ninguna clave todavía (caso borde,
  // menos común que el anterior pero posible).
  await git.raw(['config', '--global', `${brand.gitConfigMarker}.initialized`, 'true'])
  return resolveGlobalConfigPath(env)
}
