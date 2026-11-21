import { spawn } from 'node:child_process'

export type GitCredentialAction = 'approve' | 'fill' | 'reject'

export interface RunGitCredentialOptions {
  /** docs/adr/0006-seguridad.md: ninguna llamada debe quedar colgada. */
  timeoutMs?: number
}

/**
 * Protocolo `git credential` (approve/fill/reject) vía child_process — no es
 * algo que `simple-git` envuelva (design.md R3). No toca el config global
 * real del usuario: usa `-c` para desactivar cualquier interacción
 * (docs/adr/0004-modelo-de-credenciales-e-identidad.md).
 */
export function runGitCredential(
  action: GitCredentialAction,
  input: Record<string, string>,
  options: RunGitCredentialOptions = {},
): Promise<Record<string, string>> {
  const timeoutMs = options.timeoutMs ?? 5_000

  return new Promise((resolve, reject) => {
    const child = spawn(
      'git',
      [
        '-c',
        'credential.interactive=false',
        '-c',
        'credential.guiPrompt=false',
        'credential',
        action,
      ],
      {
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error(`git credential ${action} superó el timeout de ${timeoutMs}ms sin salir`))
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(`git credential ${action} salió con código ${code}: ${stderr.trim()}`))
        return
      }
      resolve(parseCredentialOutput(stdout))
    })

    const body =
      Object.entries(input)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n\n'
    child.stdin.write(body)
    child.stdin.end()
  })
}

function parseCredentialOutput(stdout: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of stdout.split('\n')) {
    const idx = line.indexOf('=')
    if (idx === -1) continue
    result[line.slice(0, idx)] = line.slice(idx + 1)
  }
  return result
}
