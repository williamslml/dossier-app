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
  // Git exige "/" en el patrón de gitdir incluso en Windows: normalizar aquí
  // (no responsabilidad del llamador) evita que un path.join con "\" rompa
  // el match en silencio — lo descubrió el propio test R4 al fallar primero.
  const normalizedPattern = gitdirPattern.split('\\').join('/')
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
