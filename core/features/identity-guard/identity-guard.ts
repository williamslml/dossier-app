import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type HookName = 'pre-commit' | 'pre-push'
export type InstallResult = 'instalado' | 'ya-existe-ajeno'

/** S11.2: marca propia al inicio del hook — distingue "lo instaló Dossier,
    se puede volver a escribir" de "hay otra cosa ahí, no tocar". */
export const HOOK_MARKER = '# dossier:identity-guard v1\n'

export interface ConflictRecord {
  repoPath: string
  expectedEmail: string
  actualEmail: string
  hook: HookName
  at: string
}

function hashRepoPath(repoPath: string): string {
  return createHash('sha1').update(repoPath).digest('hex')
}

export function getConflictsDir(dataDir: string): string {
  return join(dataDir, 'identity-conflicts')
}

export function getConflictPath(dataDir: string, repoPath: string): string {
  return join(getConflictsDir(dataDir), `${hashRepoPath(repoPath)}.json`)
}

/** Para embeber un valor dentro de comillas dobles de un script de shell
    (POSIX sh, el que trae Git Bash) sin romper la sintaxis ni disparar
    expansión de variables/comandos que no corresponden. */
function escapeForDoubleQuotedShell(value: string): string {
  return (
    value
      // Esto escapa sintaxis de shell, no una ruta de Windows — no aplica la
      // regla de "usá path.join" del resto del proyecto.
      // eslint-disable-next-line no-restricted-syntax
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
  )
}

/**
 * S11.3/S11.4: script de shell (portable, Git Bash) que compara la
 * identidad real de este repo (`git config user.email`, ya resuelta por
 * Git mismo — incluye `includeIf`) contra la esperada para esta carpeta.
 * Si coincide, sale en silencio con código 0. Si no, escribe un registro
 * de conflicto en JSON y termina con código distinto de cero y un mensaje
 * en texto plano explicando el desajuste — sin depender de que Dossier
 * esté corriendo.
 */
export function buildHookScript(params: {
  repoPath: string
  expectedEmail: string
  conflictPath: string
  hook: HookName
}): string {
  const repoPath = escapeForDoubleQuotedShell(params.repoPath)
  const expectedEmail = escapeForDoubleQuotedShell(params.expectedEmail)
  const conflictPath = escapeForDoubleQuotedShell(params.conflictPath)

  // El shebang tiene que ser la primera línea literal del archivo — si no,
  // Git (al menos en Windows) no encuentra el intérprete y falla con
  // "cannot spawn ...: No such file or directory" en vez de correr el
  // script. La marca de Dossier va en la línea siguiente, como comentario.
  return `#!/bin/sh
${HOOK_MARKER}# Generado por Dossier. No lo edites a mano: se reescribe solo si cambiás
# la cuenta o la guardia de esta carpeta desde la app.
expected_email="${expectedEmail}"
actual_email="$(git config user.email 2>/dev/null)"

if [ "$actual_email" = "$expected_email" ]; then
  exit 0
fi

# Escapa comillas/backslashes de un valor leído en tiempo real (la
# identidad real), para que el JSON que se escribe abajo sea válido.
json_escape() {
  printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g'
}

mkdir -p "$(dirname "${conflictPath}")"
cat > "${conflictPath}" <<DOSSIER_EOF
{"repoPath":"$(json_escape "${repoPath}")","expectedEmail":"$(json_escape "$expected_email")","actualEmail":"$(json_escape "$actual_email")","hook":"${params.hook}","at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
DOSSIER_EOF

if [ -z "$actual_email" ]; then
  echo "Dossier: esta carpeta está fijada a ${expectedEmail}, pero no hay ninguna identidad de Git configurada acá." >&2
else
  echo "Dossier: esta carpeta está fijada a ${expectedEmail}, pero tu identidad de Git acá es '$actual_email'." >&2
fi
echo "Abrí Dossier para aplicar la cuenta correcta, o cambiá 'git config user.email' manualmente." >&2
exit 1
`
}

/** S11.2: nunca pisa un hook que no instaló Dossier — lo detecta por la
    marca al inicio del archivo. */
export function installHook(repoPath: string, hookName: HookName, script: string): InstallResult {
  const hooksDir = join(repoPath, '.git', 'hooks')
  const hookPath = join(hooksDir, hookName)

  if (existsSync(hookPath) && !readFileSync(hookPath, 'utf8').includes(HOOK_MARKER)) {
    return 'ya-existe-ajeno'
  }

  mkdirSync(hooksDir, { recursive: true })
  writeFileSync(hookPath, script, { mode: 0o755 })
  return 'instalado'
}

/** Al apagar la guardia de una carpeta: borra el hook, pero solo si lo
    instaló Dossier — nunca toca uno ajeno, igual que installHook. */
export function uninstallHook(repoPath: string, hookName: HookName): void {
  const hookPath = join(repoPath, '.git', 'hooks', hookName)
  if (!existsSync(hookPath)) return
  if (!readFileSync(hookPath, 'utf8').includes(HOOK_MARKER)) return
  rmSync(hookPath)
}

/** S11.4: `main` relee esto cada vez que la ventana se muestra — nunca un
    watcher, la diferencia de inmediatez no importa (ver design.md). */
export function readConflicts(dataDir: string): ConflictRecord[] {
  const dir = getConflictsDir(dataDir)
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      try {
        return [JSON.parse(readFileSync(join(dir, name), 'utf8')) as ConflictRecord]
      } catch {
        return []
      }
    })
}

/** S11.5: limpia el registro después de Aplicar/Bloquear, sin tocar
    `rules.json` ni la identidad real del repo. */
export function clearConflict(dataDir: string, repoPath: string): void {
  const path = getConflictPath(dataDir, repoPath)
  if (existsSync(path)) rmSync(path)
}
