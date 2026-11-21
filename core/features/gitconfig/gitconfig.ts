import { realpathSync } from 'node:fs'
import { simpleGit } from 'simple-git'

/**
 * `git config --file` vía simple-git, sin parsear `.ini` a mano
 * (docs/adr/0004-modelo-de-credenciales-e-identidad.md). Escribe el bloque
 * de identidad + cuenta de credencial de un perfil.
 */
export async function writeProfileConfig(
  profilePath: string,
  values: Record<string, string>,
): Promise<void> {
  const git = simpleGit()
  for (const [key, value] of Object.entries(values)) {
    await git.raw(['config', '--file', profilePath, key, value])
  }
}

/**
 * Añade un bloque `includeIf "gitdir/i:<gitdirPattern>"` al config global
 * indicado, apuntando al `profilePath`. Se usa `--add` para no sobrescribir
 * bloques ya presentes: la región crece al final, de menos a más específico
 * (docs/adr/0004-modelo-de-credenciales-e-identidad.md).
 */
export async function writeIncludeIf(
  globalConfigPath: string,
  gitdirPattern: string,
  profilePath: string,
): Promise<void> {
  // Git resuelve el gitdir por su ruta REAL (sin symlinks) al hacer el match
  // de includeIf. Si la carpeta se alcanza por una ruta no canónica (p. ej.
  // os.tmpdir() en macOS: /var/... es symlink de /private/var/...; algunos
  // runners de Windows tienen el mismo problema con TEMP), el match falla en
  // silencio — encontrado en CI (ver docs/lessons/README.md), reproducido
  // localmente con una junction en gitconfig.test.ts. Resolver con realpath
  // antes de normalizar, no solo la barra invertida de Windows.
  const withoutTrailingSlash = gitdirPattern.replace(/[/\\]+$/, '')
  const realPattern = `${realpathSync(withoutTrailingSlash)}/`
  const normalizedPattern = realPattern.split('\\').join('/')
  const git = simpleGit()
  await git.raw([
    'config',
    '--file',
    globalConfigPath,
    '--add',
    `includeIf.gitdir/i:${normalizedPattern}.path`,
    profilePath,
  ])
}
