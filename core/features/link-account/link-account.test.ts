import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAccountsStore } from '../accounts/accounts.ts'
import type { AccountsStore } from '../accounts/accounts.ts'
import type { LinkedAccount } from '../providers/github/github.ts'
import { linkGithubAccount, linkGitlabAccount, saveLinkedAccount } from './link-account.ts'
import { runGitCredential } from '../git-credential/git-credential.ts'
import type { GithubVerification } from '../providers/github/github.ts'

// L1 (requirements.md): guardar en GCM + crear la cuenta, nunca una cuenta a
// medias si el guardado no se puede confirmar (ADR 0004). Mismo patrón que
// git-credential.test.ts: solo tiene sentido en Windows real, host reservado
// .invalid, sufijo aleatorio, limpieza garantizada.

const isWindows = process.platform === 'win32'
const HOST = 'sfp-link-account-test.invalid'
const suffix = randomUUID().slice(0, 8)

function hasManagerHelper(): boolean {
  try {
    const out = execFileSync('git', ['config', '--get-all', 'credential.helper'], {
      encoding: 'utf8',
    })
    return /manager/.test(out)
  } catch {
    return false
  }
}

let store: AccountsStore

beforeEach(() => {
  const cwd = mkdtempSync(join(tmpdir(), 'sfp-link-account-test-'))
  store = createAccountsStore({ cwd })
})

describe.skipIf(!isWindows)('saveLinkedAccount (L1, GCM real en Windows)', () => {
  it('guarda el token, lo confirma con fill y crea la cuenta', async () => {
    if (!hasManagerHelper()) {
      throw new Error(
        "credential.helper no incluye 'manager'/'manager-core' (docs/adr/0004-modelo-de-credenciales-e-identidad.md).",
      )
    }
    const username = `link-test-ok-${suffix}`
    const linked: LinkedAccount = {
      provider: 'github',
      username,
      id: 1,
      name: 'Cuenta de prueba',
      email: 'prueba@users.noreply.github.com',
      token: `link-token-ok-${suffix}`,
    }

    const account = await saveLinkedAccount(store, linked, 'Personal', HOST)

    expect(account.username).toBe(username)
    expect(account.host).toBe(HOST)
    expect(account.label).toBe('Personal')
    expect(store.list()).toHaveLength(1)

    await runGitCredential('reject', { protocol: 'https', host: HOST, username })
  })

  it('no crea la cuenta si no se puede confirmar el token guardado', async () => {
    const username = `link-test-fail-${suffix}`
    const linked: LinkedAccount = {
      provider: 'github',
      username,
      id: 2,
      name: 'Cuenta de prueba',
      email: undefined,
      token: `link-token-fail-${suffix}`,
    }
    // runGitCredential falso: 'approve' no hace nada real, 'fill' devuelve un
    // password distinto al que se pidió guardar — simula el hallazgo de ADR
    // 0004 ("approve sale 0 sin guardar"), que no se puede forzar de forma
    // determinística contra el GCM real.
    const fakeRunGitCredential = async (action: string): Promise<Record<string, string>> => {
      if (action === 'fill') return { password: 'token-equivocado' }
      return {}
    }

    await expect(
      saveLinkedAccount(store, linked, 'Personal', HOST, fakeRunGitCredential),
    ).rejects.toThrow()

    expect(store.list()).toHaveLength(0)
  })

  it('reintenta fill si falla de forma transitoria, antes de rendirse', async () => {
    const username = `link-test-retry-${suffix}`
    const linked: LinkedAccount = {
      provider: 'github',
      username,
      id: 5,
      name: 'Cuenta de prueba',
      email: undefined,
      token: `link-token-retry-${suffix}`,
    }
    let fillAttempts = 0
    const fakeRunGitCredential = async (action: string): Promise<Record<string, string>> => {
      if (action === 'fill') {
        fillAttempts += 1
        if (fillAttempts < 3) throw new Error('git credential fill salió con código 128')
        return { password: linked.token }
      }
      return {}
    }

    const account = await saveLinkedAccount(store, linked, 'Personal', HOST, fakeRunGitCredential)

    expect(fillAttempts).toBe(3)
    expect(account.username).toBe(username)
  })
})

describe('linkGithubAccount (L1 — orquestación, sin tocar GCM real)', () => {
  // github.com es un host real, no uno reservado para pruebas: no se aprueba
  // ni se rechaza una credencial ahí ni siquiera con datos falsos (R5).
  // Esta prueba solo confirma el cableado (llama al proveedor, reenvía la
  // verificación, usa host github.com) con un `gitCredential` también falso
  // — el guardado real en GCM ya lo cubre `saveLinkedAccount` contra un
  // host reservado, arriba.
  it('llama al proveedor, reenvía la verificación y crea la cuenta con host github.com', async () => {
    const username = `link-gh-${suffix}`
    const verifications: GithubVerification[] = []
    const fakeLinkGithub = async (
      onVerification: (v: GithubVerification) => void,
    ): Promise<LinkedAccount> => {
      onVerification({
        verification_uri: 'https://github.com/login/device',
        user_code: 'ABCD-1234',
        expires_in: 900,
        interval: 5,
      })
      return {
        provider: 'github',
        username,
        id: 3,
        name: 'Cuenta GitHub',
        email: 'gh@users.noreply.github.com',
        token: `link-token-gh-${suffix}`,
      }
    }
    let stored = ''
    const fakeGitCredential = async (
      action: string,
      input: Record<string, string>,
    ): Promise<Record<string, string>> => {
      if (action === 'approve') stored = input.password ?? ''
      return { password: stored }
    }

    const account = await linkGithubAccount(
      store,
      'Trabajo',
      (v) => verifications.push(v),
      fakeLinkGithub,
      fakeGitCredential,
    )

    expect(verifications).toEqual([
      {
        verification_uri: 'https://github.com/login/device',
        user_code: 'ABCD-1234',
        expires_in: 900,
        interval: 5,
      },
    ])
    expect(account.host).toBe('github.com')
    expect(account.provider).toBe('github')
  })
})

describe.skipIf(!isWindows)('linkGitlabAccount (L1, GCM real en Windows)', () => {
  it('llama al proveedor con el host dado y crea la cuenta con ese mismo host', async () => {
    const username = `link-gl-${suffix}`
    const host = 'sfp-link-account-gitlab-test.invalid'
    const fakeLinkGitlab = async (): Promise<LinkedAccount> => ({
      provider: 'gitlab',
      username,
      id: 4,
      name: 'Cuenta GitLab',
      email: undefined,
      token: `link-token-gl-${suffix}`,
    })

    const account = await linkGitlabAccount(store, 'Cliente', host, 'pat-de-prueba', fakeLinkGitlab)

    expect(account.host).toBe(host)
    expect(account.provider).toBe('gitlab')
    expect(account.email).toBe('')

    await runGitCredential('reject', { protocol: 'https', host, username })
  })
})
