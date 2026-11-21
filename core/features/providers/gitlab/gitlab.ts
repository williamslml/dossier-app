import type { LinkedAccount } from '../github/github.ts'

interface GitlabUser {
  username: string
  id: number
  name: string
  email?: string | null
  public_email?: string | null
}

/**
 * docs/product.md §3.2: PAT validado contra GET /api/v4/user; host
 * configurable desde el día uno (soporte para instancias autoalojadas,
 * nunca hardcodeado a gitlab.com — design.md P2.4).
 */
export async function linkGitlab(host: string, token: string): Promise<LinkedAccount> {
  // `host` admite incluir el protocolo (p. ej. para pruebas locales por
  // HTTP); si no lo trae, se asume HTTPS — nunca se fuerza gitlab.com.
  const base = /^https?:\/\//.test(host) ? host : `https://${host}`
  const response = await fetch(`${base}/api/v4/user`, {
    headers: { 'PRIVATE-TOKEN': token },
  })

  if (!response.ok) {
    throw new Error('Token de GitLab inválido o sin permiso')
  }

  const user = (await response.json()) as GitlabUser

  return {
    provider: 'gitlab',
    username: user.username,
    id: user.id,
    name: user.name,
    email: user.email ?? user.public_email ?? undefined,
    token,
  }
}
