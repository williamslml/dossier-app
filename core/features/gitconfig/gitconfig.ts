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
  // Git resuelve el gitdir por su ruta REAL al hacer el match de includeIf,
  // y eso cubre dos formas distintas de ruta "no canónica" (ver
  // docs/lessons/README.md):
  //   1. Symlinks/junctions (p. ej. macOS: /var/... es symlink de
  //      /private/var/...).
  //   2. En Windows, el alias de nombre corto 8.3 (p. ej. `RUNNER~1` en
  //      vez de `runneradmin`, visto en los runners de GitHub Actions).
  // `realpathSync` (la versión JS) resuelve (1) pero NO (2): hace falta
  // `realpathSync.native`, que usa la API nativa de Windows y resuelve
  // ambas — confirmado reproduciendo un alias 8.3 real localmente.
  const withoutTrailingSlash = gitdirPattern.replace(/[/\\]+$/, '')
  const realPattern = `${realpathSync.native(withoutTrailingSlash)}/`
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
