import { randomUUID } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'

export type GitCredentialAction = 'approve' | 'fill' | 'reject'

export interface RunGitCredentialOptions {
  /** docs/adr/0006-seguridad.md: ninguna llamada debe quedar colgada. */
  timeoutMs?: number
}

/**
 * Hallazgo real (docs/lessons/README.md): `git credential <acción>` (el
 * despachador genérico de git hacia el credential helper configurado)
 * falla para `github.com` con `fill` — GCM tiene su propio proveedor para
 * ese host y el despachador genérico no lo resuelve bien, aunque la
 * credencial esté guardada de verdad. Invocar el binario de GCM
 * directamente (`git credential-manager store/get/erase`, mismo protocolo
 * por `stdin`) sí funciona, para cualquier host. Se usa siempre esta vía,
 * no solo para GitHub — es más simple que tener dos caminos.
 */
const GCM_ACTION: Record<GitCredentialAction, string> = {
  approve: 'store',
  fill: 'get',
  reject: 'erase',
}

/** Construye los argumentos de `git credential-manager <acción>` — función
 * pura, separada de `runGitCredential` para poder probarla sin lanzar un
 * proceso. */
export function buildGitCredentialArgs(action: GitCredentialAction): string[] {
  return ['credential-manager', GCM_ACTION[action], '--no-ui']
}

/**
 * Protocolo de credenciales de Git (approve/fill/reject, aquí mapeado a los
 * comandos nativos de GCM store/get/erase) vía child_process — no es algo
 * que `simple-git` envuelva (design.md R3). No toca el config global real
 * del usuario (docs/adr/0004-modelo-de-credenciales-e-identidad.md).
 */
export function runGitCredential(
  action: GitCredentialAction,
  input: Record<string, string>,
  options: RunGitCredentialOptions = {},
): Promise<Record<string, string>> {
  const timeoutMs = options.timeoutMs ?? 5_000

  return new Promise((resolve, reject) => {
    const child = spawn('git', buildGitCredentialArgs(action), {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

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

/** S9.1 (05-ajustes): `git-credential-manager github list` imprime un
    username por línea — verificado contra el binario real (`--help`) y
    evidencia pública de su salida (docs/specs/.../05-ajustes/design.md).
    Función pura, separada del spawn, para poder probarla sin GCM real. */
export function parseGithubListOutput(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Lista las cuentas de GitHub que GCM ya conoce — no hay equivalente para
    GitLab ni otros hosts (sin grupo de proveedor propio en GCM). */
export function listGithubAccounts(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['credential-manager', 'github', 'list', '--no-ui'], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `git credential-manager github list salió con código ${code}: ${stderr.trim()}`,
          ),
        )
        return
      }
      resolve(parseGithubListOutput(stdout))
    })
  })
}

export interface CredentialStatus {
  /** `true` si la cadena de `credential.helper` incluye GCM ('manager', o
      la legada 'manager-core'). Sin esto, la app no puede guardar tokens
      (docs/product.md, tabla de riesgos). */
  gcmConfigured: boolean
  /** Cadena cruda de helpers configurados, en orden — vacía si no hay
      ninguno (nunca se lanza por esto, es justo el caso a informar). */
  helpers: string[]
  /** `true` si algún otro helper aparece antes que GCM en la cadena — podría
      responder primero con la cuenta o el token equivocado. Informativo
      nada más: nunca se reordena la cadena del usuario sin su consentimiento. */
  otherHelperBeforeGcm: boolean
}

/** Separa la salida cruda de `git config --get-all credential.helper` en una
    lista, un helper por línea — función pura, testeable sin Git real. */
export function parseCredentialHelperChain(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** docs/adr/0004: la app depende de que GCM esté en la cadena de
    `credential.helper`. Lectura nada más — nunca reordena ni modifica la
    cadena real del usuario. */
export function getCredentialStatus(): Promise<CredentialStatus> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['config', '--get-all', 'credential.helper'],
      { encoding: 'utf8' },
      (err, stdout) => {
        // Código de salida != 0 cuando la clave no existe en absoluto (sin
        // ningún helper configurado) — no es un error para este chequeo, es
        // justo el caso "GCM no instalado/configurado" que hay que avisar.
        const helpers = err ? [] : parseCredentialHelperChain(stdout)
        const gcmIndex = helpers.findIndex((h) => /manager/.test(h))
        resolve({
          gcmConfigured: gcmIndex !== -1,
          helpers,
          otherHelperBeforeGcm: gcmIndex > 0,
        })
      },
    )
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

export interface CachedGcmCredential {
  host: string
  username: string
}

/**
 * docs/product.md: "sincronizar cuentas vinculadas antes de tener Dossier"
 * (a) — enumera, de solo lectura, las credenciales que GCM ya tiene
 * guardadas para cualquier host de Git (`git:https://<host>`), vía la API
 * nativa de Windows (`CredEnumerate`, `advapi32.dll`), nunca parseando el
 * texto localizado de `cmdkey /list` (sale distinto según el idioma de
 * Windows — "Destino"/"Target", etc. — probado a mano contra esta máquina
 * en español antes de elegir este camino). `CredEnumerate` nunca expone la
 * contraseña/token (no se marshalea `CredentialBlob`), solo el nombre del
 * destino y el username — igual de "no secreto" que `credential.helper`.
 *
 * Hallazgo real: `spawn('powershell.exe', ...)` desde Node resuelve el
 * Windows PowerShell 5.1 del sistema (no el pwsh 7+ de una sesión
 * interactiva) — probado a mano antes de asumirlo. `ConvertTo-Json
 * -AsArray` no existe ahí (parámetro agregado en 6.2+), y pasar `$results`
 * por el pipe a `ConvertTo-Json` sin eso colapsa un array de un solo
 * elemento a un objeto suelto (el caso real de "un único candidato" que
 * `findImportableGcmAccountsForHost` necesita distinguir de "varios"). Se
 * usa `-InputObject` en vez del pipe — confirmado con 0, 1 y 3 resultados
 * contra el binario real que de verdad se termina invocando — porque evita
 * el colapso sin depender de un parámetro que no existe en PS 5.1.
 */
const LIST_GIT_CREDENTIALS_SCRIPT = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class DossierCredEnum {
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool CredEnumerate(string filter, int flags, out int count, out IntPtr pCredentials);
  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr buffer);
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
    public int Persist; public int AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
}
'@
Add-Type -TypeDefinition $code
$count = 0
$ptr = [IntPtr]::Zero
$ok = [DossierCredEnum]::CredEnumerate("git:*", 0, [ref]$count, [ref]$ptr)
$results = @()
if ($ok) {
  for ($i = 0; $i -lt $count; $i++) {
    $credPtr = [System.Runtime.InteropServices.Marshal]::ReadIntPtr([IntPtr]::Add($ptr, $i * [IntPtr]::Size))
    $cred = [System.Runtime.InteropServices.Marshal]::PtrToStructure($credPtr, [type][DossierCredEnum+CREDENTIAL])
    if ($cred.UserName) {
      $results += [PSCustomObject]@{ target = $cred.TargetName; username = $cred.UserName }
    }
  }
  [DossierCredEnum]::CredFree($ptr)
}
ConvertTo-Json -InputObject $results -Compress
`.trim()

/**
 * Hallazgo real (probado en vivo, no solo con JSON inventado a mano): con
 * más de una credencial guardada para el mismo host, GCM distingue la
 * segunda (y siguientes) con el username embebido en el target
 * (`git:https://<username>@<host>`), no solo `git:https://<host>` —
 * justo el caso real de "varias cuentas en el mismo host" que le importa a
 * esta función. El username real sigue viniendo del campo `UserName` del
 * propio PowerShell (nunca del target) — esto solo afecta a qué parte del
 * target es el host.
 */
const TARGET_PATTERN = /^git:https:\/\/(?:[^@/]+@)?(.+)$/

/** Función pura (separada del spawn) para poder probar el parseo con
    distintas formas de salida sin invocar PowerShell de verdad. */
export function parseGcmGitCredentialsOutput(stdout: string): CachedGcmCredential[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []

  const result: CachedGcmCredential[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const { target, username } = entry as Record<string, unknown>
    if (typeof target !== 'string' || typeof username !== 'string' || username === '') continue
    const match = TARGET_PATTERN.exec(target)
    if (match?.[1]) result.push({ host: match[1], username })
  }
  return result
}

const LIST_GIT_CREDENTIALS_TIMEOUT_MS = 5_000

/** Nunca lanza: PowerShell ausente (no debería pasar en Windows real),
    `CredEnumerate` fallando, cualquier salida irreconocible, o que el
    proceso no termine a tiempo (docs/adr/0006-seguridad.md: ninguna
    llamada debe quedar colgada, mismo criterio que `runGitCredential`) dan
    `[]` — "no se encontró nada para ofrecer", nunca un error que bloquee
    vincular una cuenta por el camino normal. */
export function listGcmGitCredentials(): Promise<CachedGcmCredential[]> {
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', LIST_GIT_CREDENTIALS_SCRIPT],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      resolve([])
    }, LIST_GIT_CREDENTIALS_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.on('error', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve([])
    })
    child.on('close', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(parseGcmGitCredentialsOutput(stdout))
    })
  })
}

export interface SecretStoreHealth {
  healthy: boolean
  /** Ausente cuando `healthy` es `true`. */
  detail?: string
}

/** docs/product.md: "detección de almacén de secretos ausente" — defensivo
    (en Windows, GCM usa Windows Credential Manager; prácticamente siempre
    disponible, pero esto no asume nada, lo prueba de verdad). Guarda un
    valor descartable en un host reservado `.invalid` (nunca resuelve, no
    choca con cuentas reales), lo relee y confirma que sea el mismo, y
    siempre lo borra al final — nunca deja basura de prueba, pase lo que
    pase. */
export interface CheckSecretStoreHealthOptions {
  /** Solo para tests: fuerza el host/username/password de prueba, para
      poder confirmar la limpieza desde afuera con un `fill` aparte después
      (hallazgo de revisión: el test original solo inferia la limpieza de
      forma indirecta, corriendo el chequeo dos veces). */
  credential?: { host: string; username: string; password: string }
}

export async function checkSecretStoreHealth(
  options: CheckSecretStoreHealthOptions = {},
): Promise<SecretStoreHealth> {
  const host = options.credential?.host ?? 'dossier-health-check.invalid'
  const username = options.credential?.username ?? `health-${randomUUID().slice(0, 8)}`
  const password = options.credential?.password ?? `probe-${randomUUID().slice(0, 8)}`
  const credential = { protocol: 'https', host, username }

  try {
    await runGitCredential('approve', { ...credential, password })
    const filled = await runGitCredential('fill', credential)
    if (filled.password !== password) {
      return {
        healthy: false,
        detail: 'El almacén de credenciales devolvió un valor distinto del que se le pidió guardar.',
      }
    }
    return { healthy: true }
  } catch (err) {
    return {
      healthy: false,
      detail: err instanceof Error ? err.message : String(err),
    }
  } finally {
    await runGitCredential('reject', credential).catch(() => {})
  }
}
