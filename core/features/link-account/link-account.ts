import type { AccountsStore, Account } from '../accounts/accounts.ts'
import {
  findGithubCliToken as defaultFindGithubCliToken,
  findGitlabCliToken as defaultFindGitlabCliToken,
} from '../cli-import/cli-import.ts'
import type { GithubVerification, LinkedAccount } from '../providers/github/github.ts'
import {
  fetchGithubUser as defaultFetchGithubUser,
  linkGithub as defaultLinkGithub,
} from '../providers/github/github.ts'
import { linkGitlab as defaultLinkGitlab } from '../providers/gitlab/gitlab.ts'
import {
  runGitCredential as defaultRunGitCredential,
  listGcmGitCredentials as defaultListGcmGitCredentials,
} from '../git-credential/git-credential.ts'

type GitCredential = typeof defaultRunGitCredential
type LinkGithub = typeof defaultLinkGithub
type LinkGitlab = typeof defaultLinkGitlab
type FetchGithubUser = typeof defaultFetchGithubUser
type FindGithubCliToken = typeof defaultFindGithubCliToken
type FindGitlabCliToken = typeof defaultFindGitlabCliToken
type ListGcmGitCredentials = typeof defaultListGcmGitCredentials

const FILL_RETRY_ATTEMPTS = 3
const FILL_RETRY_DELAY_MS = 400

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Hallazgo real (docs/lessons/README.md): con una cuenta real ya
 * autorizada, guardar el token puede funcionar pero el primer `fill`
 * inmediatamente después fallar una vez — reintentar un par de veces con
 * una pausa corta lo resuelve.
 */
async function fillWithRetry(
  gitCredential: GitCredential,
  input: Record<string, string>,
): Promise<Record<string, string>> {
  let lastError: unknown
  for (let attempt = 1; attempt <= FILL_RETRY_ATTEMPTS; attempt++) {
    try {
      return await gitCredential('fill', input)
    } catch (err) {
      lastError = err
      if (attempt < FILL_RETRY_ATTEMPTS) await wait(FILL_RETRY_DELAY_MS)
    }
  }
  throw lastError
}

/**
 * ADR 0004, "Flujo de guardado y borrado de tokens": guarda el token con
 * `approve`, lo confirma con `fill` y **solo entonces** crea la cuenta — si
 * `fill` no devuelve el mismo token, no se crea nada a medias. Mismo camino
 * para GitHub y GitLab (`runGitCredential` habla directo con el binario de
 * GCM — docs/lessons/README.md — así que no hace falta un caso especial
 * por proveedor).
 */
export async function saveLinkedAccount(
  accountsStore: AccountsStore,
  linked: LinkedAccount,
  label: string,
  host: string,
  gitCredential: GitCredential = defaultRunGitCredential,
): Promise<Account> {
  await gitCredential('approve', {
    protocol: 'https',
    host,
    username: linked.username,
    password: linked.token,
  })

  const filled = await fillWithRetry(gitCredential, {
    protocol: 'https',
    host,
    username: linked.username,
  })

  if (filled.password !== linked.token) {
    throw new Error('No se pudo confirmar el token guardado en el gestor de credenciales.')
  }

  return accountsStore.create({
    provider: linked.provider,
    host,
    label,
    username: linked.username,
    name: linked.name,
    email: linked.email ?? '',
  })
}

/**
 * GitHub no tiene host configurable (ADR 0003/0004): siempre `github.com`,
 * a diferencia de GitLab.
 */
export function linkGithubAccount(
  accountsStore: AccountsStore,
  label: string,
  onVerification: (verification: GithubVerification) => void,
  linkGithub: LinkGithub = defaultLinkGithub,
  gitCredential: GitCredential = defaultRunGitCredential,
): Promise<Account> {
  return linkGithub(onVerification).then((linked) =>
    saveLinkedAccount(accountsStore, linked, label, 'github.com', gitCredential),
  )
}

/**
 * docs/product.md: "sincronizar cuentas previas a Dossier" (b) — si `gh`
 * CLI ya tiene una sesión cacheada para una cuenta que todavía no está en
 * `accountsStore`, la confirma de verdad contra `GET /user` (nunca confía
 * ciegamente en lo que imprime el CLI) y devuelve la cuenta lista para
 * vincular. Nunca crea nada acá — eso lo decide el llamador (requiere
 * confirmación explícita, nunca automática).
 */
export async function findImportableGithubCliAccount(
  accountsStore: AccountsStore,
  findToken: FindGithubCliToken = defaultFindGithubCliToken,
  fetchUser: FetchGithubUser = defaultFetchGithubUser,
): Promise<LinkedAccount | undefined> {
  const token = await findToken()
  if (!token) return undefined

  const linked = await fetchUser(token)
  const alreadyLinked = accountsStore
    .list()
    .some((a) => a.host === 'github.com' && a.username === linked.username)
  return alreadyLinked ? undefined : linked
}

/**
 * docs/product.md: "sincronizar cuentas previas a Dossier" (b), para
 * GitLab — mismo criterio que la versión de GitHub: nunca confía en lo
 * que imprime el CLI, confirma el token contra `GET /api/v4/user` antes de
 * ofrecerlo. `host` es el que el usuario ya escribió en el diálogo (acá no
 * hay un host fijo como `github.com`).
 */
export async function findImportableGitlabCliAccount(
  accountsStore: AccountsStore,
  host: string,
  findToken: FindGitlabCliToken = defaultFindGitlabCliToken,
  linkGitlab: LinkGitlab = defaultLinkGitlab,
): Promise<LinkedAccount | undefined> {
  const token = await findToken(host)
  if (!token) return undefined

  const linked = await linkGitlab(host, token)
  const alreadyLinked = accountsStore.list().some((a) => a.host === host && a.username === linked.username)
  return alreadyLinked ? undefined : linked
}

/**
 * docs/product.md: "sincronizar cuentas previas a Dossier" (a) — a
 * diferencia de (b), acá no hay CLI que avise de una sesión: GCM mismo ya
 * puede tener guardada una credencial para este host, de alguna vez que se
 * usó `git` común contra él, antes de instalar Dossier (`listGcmGitCredentials`
 * la encuentra por enumeración nativa de Windows, no por texto de `cmdkey`).
 * Puede haber más de un username guardado para el mismo host — a diferencia
 * de (b), donde solo existe la sesión activa de un CLI — así que devuelve
 * todos los candidatos verificados, nunca eligiendo uno por su cuenta. El
 * username que GCM tenía guardado es solo una pista para saber a quién
 * preguntarle el token (vía `fill`); la identidad real que se ofrece es
 * siempre la que confirma la API (`linkGitlab`), igual que en (b) — nunca
 * se confía en la etiqueta guardada. Un candidato cuyo token ya no sirve
 * (vencido, revocado) se descarta en silencio: no debe impedir que aparezcan
 * los demás.
 */
export async function findImportableGcmAccountsForHost(
  accountsStore: AccountsStore,
  host: string,
  listCredentials: ListGcmGitCredentials = defaultListGcmGitCredentials,
  gitCredential: GitCredential = defaultRunGitCredential,
  linkGitlab: LinkGitlab = defaultLinkGitlab,
): Promise<LinkedAccount[]> {
  const candidates = (await listCredentials()).filter((c) => c.host === host)
  const knownUsernames = new Set(
    accountsStore
      .list()
      .filter((a) => a.host === host)
      .map((a) => a.username),
  )

  const results: LinkedAccount[] = []
  for (const candidate of candidates) {
    if (knownUsernames.has(candidate.username)) continue
    try {
      const filled = await gitCredential('fill', {
        protocol: 'https',
        host,
        username: candidate.username,
      })
      if (!filled.password) continue
      const linked = await linkGitlab(host, filled.password)
      if (!knownUsernames.has(linked.username) && !results.some((r) => r.username === linked.username)) {
        results.push(linked)
      }
    } catch {
      continue
    }
  }
  return results
}

export function linkGitlabAccount(
  accountsStore: AccountsStore,
  label: string,
  host: string,
  token: string,
  linkGitlab: LinkGitlab = defaultLinkGitlab,
  gitCredential: GitCredential = defaultRunGitCredential,
): Promise<Account> {
  return linkGitlab(host, token).then((linked) =>
    saveLinkedAccount(accountsStore, linked, label, host, gitCredential),
  )
}
