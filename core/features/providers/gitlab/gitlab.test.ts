import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { linkGitlab } from './gitlab.ts'

// P2 (requirements.md): servidor HTTP efímero local que simula
// /api/v4/user — nunca gitlab.com real ni un token verdadero.

let server: Server
let host: string
let lastAuthHeader: string | undefined

function startTestServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<string> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      lastAuthHeader = req.headers['private-token'] as string | undefined
      handler(req, res)
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        resolve(`http://127.0.0.1:${address.port}`)
      }
    })
  })
}

afterEach(() => {
  server?.close()
})

describe('linkGitlab (P2)', () => {
  beforeEach(async () => {
    lastAuthHeader = undefined
  })

  it('200 completo devuelve username/id/name/email (P2.1-P2.2)', async () => {
    host = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          username: 'jperez.empresa',
          id: 42,
          name: 'Juan Pérez',
          email: 'jperez@empresa.gitlab.invalid',
        }),
      )
    })

    const account = await linkGitlab(host, 'glpat-token-de-prueba')

    expect(account).toEqual({
      provider: 'gitlab',
      username: 'jperez.empresa',
      id: 42,
      name: 'Juan Pérez',
      email: 'jperez@empresa.gitlab.invalid',
      token: 'glpat-token-de-prueba',
    })
    expect(lastAuthHeader).toBe('glpat-token-de-prueba')
  })

  it('200 sin email ni public_email devuelve undefined, sin inventar un patrón (P2.2)', async () => {
    host = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ username: 'sin-email', id: 7, name: 'Sin Email' }))
    })

    const account = await linkGitlab(host, 'glpat-token-de-prueba')
    expect(account.email).toBeUndefined()
  })

  it('usa public_email si email no viene (P2.2)', async () => {
    host = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          username: 'con-public',
          id: 8,
          name: 'Con Public',
          public_email: 'p@x.invalid',
        }),
      )
    })

    const account = await linkGitlab(host, 'glpat-token-de-prueba')
    expect(account.email).toBe('p@x.invalid')
  })

  it('401 lanza un error claro sin filtrar el token (P2.3)', async () => {
    host = await startTestServer((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: '401 Unauthorized' }))
    })

    await expect(linkGitlab(host, 'glpat-secreto-no-debe-aparecer')).rejects.toThrow(
      /inválido o sin permiso/,
    )
    try {
      await linkGitlab(host, 'glpat-secreto-no-debe-aparecer')
    } catch (err) {
      expect(String(err)).not.toContain('glpat-secreto-no-debe-aparecer')
    }
  })

  it('el host es un parámetro real, no hardcodeado (P2.4)', async () => {
    const hostA = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ username: 'de-host-a', id: 1, name: 'A' }))
    })
    const accountA = await linkGitlab(hostA, 'token-a')
    expect(accountA.username).toBe('de-host-a')
    server.close()

    const hostB = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ username: 'de-host-b', id: 2, name: 'B' }))
    })
    const accountB = await linkGitlab(hostB, 'token-b')
    expect(accountB.username).toBe('de-host-b')
  })
})
