import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device'

/**
 * OAuth App de Dossier en GitHub, Device Flow habilitado. No es secreto:
 * Device Flow es un cliente público por diseño (docs/adr/0003-stack-fundacional-y-sin-backend.md),
 * el propio `@octokit/auth-oauth-device` asume que el client_id viaja con la app.
 */
const GITHUB_OAUTH_CLIENT_ID = 'Ov23liZi9KS6Wf5C1aJ5'

const NOREPLY_CUTOFF = new Date('2017-07-18T00:00:00Z')

export interface GithubVerification {
  verification_uri: string
  user_code: string
  expires_in: number
  interval: number
}

export interface LinkedAccount {
  provider: 'github' | 'gitlab'
  username: string
  id: string | number
  name: string
  email: string | undefined
  token: string
}

/**
 * docs/product.md §3.2: GitHub usa `ID+usuario@users.noreply.github.com`
 * para cuentas creadas desde el 18-07-2017; antes, `usuario@users.noreply.github.com`.
 */
export function deriveNoreplyEmail(login: string, id: number, createdAt: string): string {
  const created = new Date(createdAt)
  if (created >= NOREPLY_CUTOFF) {
    return `${id}+${login}@users.noreply.github.com`
  }
  return `${login}@users.noreply.github.com`
}

interface GithubUser {
  login: string
  id: number
  name: string | null
  created_at: string
}

export async function linkGithub(
  onVerification: (verification: GithubVerification) => void,
): Promise<LinkedAccount> {
  const auth = createOAuthDeviceAuth({
    clientType: 'oauth-app',
    clientId: GITHUB_OAUTH_CLIENT_ID,
    scopes: ['repo'],
    onVerification,
  })

  const { token } = await auth({ type: 'oauth' })

  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'dossier-app',
      Accept: 'application/vnd.github+json',
    },
  })
  if (!response.ok) {
    throw new Error(`GET /user de GitHub falló con estado ${response.status}`)
  }
  const user = (await response.json()) as GithubUser

  return {
    provider: 'github',
    username: user.login,
    id: user.id,
    name: user.name ?? user.login,
    email: deriveNoreplyEmail(user.login, user.id, user.created_at),
    token,
  }
}
