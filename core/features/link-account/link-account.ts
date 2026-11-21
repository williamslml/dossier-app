import type { AccountsStore, Account } from '../accounts/accounts.ts'
import type { GithubVerification, LinkedAccount } from '../providers/github/github.ts'
import { linkGithub as defaultLinkGithub } from '../providers/github/github.ts'
import { linkGitlab as defaultLinkGitlab } from '../providers/gitlab/gitlab.ts'
import { runGitCredential as defaultRunGitCredential } from '../git-credential/git-credential.ts'

type GitCredential = typeof defaultRunGitCredential
type LinkGithub = typeof defaultLinkGithub
type LinkGitlab = typeof defaultLinkGitlab

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
