import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createAccountsStore } from '../accounts/accounts.ts'
import type { AccountsStore } from '../accounts/accounts.ts'
import type { LinkedAccount } from '../providers/github/github.ts'
import {
  findImportableGcmAccountsForHost,
  findImportableGithubCliAccount,
  findImportableGitlabCliAccount,
  linkGithubAccount,
  linkGitlabAccount,
  saveLinkedAccount,
} from './link-account.ts'
import type { CachedGcmCredential } from '../git-credential/git-credential.ts'
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

describe('findImportableGithubCliAccount (sincronizar cuentas previas — sin tocar gh real)', () => {
  // Nunca invoca gh CLI de verdad en un test: findToken/fetchUser siempre
  // inyectados, igual que con el GCM real en el resto de este archivo.
  it('sin token cacheado (gh ausente o sin sesión), no hay nada que importar', async () => {
    const result = await findImportableGithubCliAccount(
      store,
      async () => undefined,
      async () => {
        throw new Error('nunca debería llamarse sin token')
      },
    )
    expect(result).toBeUndefined()
  })

  it('con un token cacheado de una cuenta nueva, lo confirma contra la API y lo devuelve', async () => {
    const linked: LinkedAccount = {
      provider: 'github',
      username: 'cli-user',
      id: 9,
      name: 'Usuario CLI',
      email: 'cli@users.noreply.github.com',
      token: 'gho_fake',
    }
    const result = await findImportableGithubCliAccount(
      store,
      async () => 'gho_fake',
      async (token) => {
        expect(token).toBe('gho_fake')
        return linked
      },
    )
    expect(result).toEqual(linked)
  })

  it('si la cuenta ya está vinculada, no la ofrece de nuevo', async () => {
    store.create({
      provider: 'github',
      host: 'github.com',
      label: 'Ya vinculada',
      username: 'cli-user',
      name: 'Usuario CLI',
      email: 'cli@users.noreply.github.com',
    })
    const result = await findImportableGithubCliAccount(
      store,
      async () => 'gho_fake',
      async () => ({
        provider: 'github',
        username: 'cli-user',
        id: 9,
        name: 'Usuario CLI',
        email: 'cli@users.noreply.github.com',
        token: 'gho_fake',
      }),
    )
    expect(result).toBeUndefined()
  })

  it('si el token cacheado no es válido, el error de fetchUser se propaga (nunca se oculta)', async () => {
    await expect(
      findImportableGithubCliAccount(
        store,
        async () => 'gho_invalido',
        async () => {
          throw new Error('GET /user de GitHub falló con estado 401')
        },
      ),
    ).rejects.toThrow('401')
  })
})

describe('findImportableGitlabCliAccount (sincronizar cuentas previas — sin tocar glab real)', () => {
  // Nunca invoca glab CLI de verdad en un test: findToken/linkGitlab
  // siempre inyectados, igual que con gh CLI arriba.
  const host = 'gitlab.example.com'

  it('sin token cacheado (glab ausente o sin sesión para ese host), no hay nada que importar', async () => {
    const result = await findImportableGitlabCliAccount(
      store,
      host,
      async () => undefined,
      async () => {
        throw new Error('nunca debería llamarse sin token')
      },
    )
    expect(result).toBeUndefined()
  })

  it('con un token cacheado de una cuenta nueva, lo confirma contra la API y lo devuelve', async () => {
    const linked: LinkedAccount = {
      provider: 'gitlab',
      username: 'cli-user-gl',
      id: 11,
      name: 'Usuario CLI GitLab',
      email: 'cli@example.com',
      token: 'glpat-fake',
    }
    const result = await findImportableGitlabCliAccount(
      store,
      host,
      async (h) => {
        expect(h).toBe(host)
        return 'glpat-fake'
      },
      async (h, token) => {
        expect(h).toBe(host)
        expect(token).toBe('glpat-fake')
        return linked
      },
    )
    expect(result).toEqual(linked)
  })

  it('si la cuenta ya está vinculada (mismo host y username), no la ofrece de nuevo', async () => {
    store.create({
      provider: 'gitlab',
      host,
      label: 'Ya vinculada',
      username: 'cli-user-gl',
      name: 'Usuario CLI GitLab',
      email: 'cli@example.com',
    })
    const result = await findImportableGitlabCliAccount(
      store,
      host,
      async () => 'glpat-fake',
      async () => ({
        provider: 'gitlab',
        username: 'cli-user-gl',
        id: 11,
        name: 'Usuario CLI GitLab',
        email: 'cli@example.com',
        token: 'glpat-fake',
      }),
    )
    expect(result).toBeUndefined()
  })

  it('la misma cuenta cacheada en otro host no cuenta como "ya vinculada"', async () => {
    store.create({
      provider: 'gitlab',
      host: 'otro-host.example.com',
      label: 'Otra instancia',
      username: 'cli-user-gl',
      name: 'Usuario CLI GitLab',
      email: 'cli@example.com',
    })
    const result = await findImportableGitlabCliAccount(
      store,
      host,
      async () => 'glpat-fake',
      async () => ({
        provider: 'gitlab',
        username: 'cli-user-gl',
        id: 11,
        name: 'Usuario CLI GitLab',
        email: 'cli@example.com',
        token: 'glpat-fake',
      }),
    )
    expect(result).toBeDefined()
  })

  it('si el token cacheado no es válido, el error de linkGitlab se propaga (nunca se oculta)', async () => {
    await expect(
      findImportableGitlabCliAccount(
        store,
        host,
        async () => 'glpat-invalido',
        async () => {
          throw new Error('Token de GitLab inválido o sin permiso')
        },
      ),
    ).rejects.toThrow('inválido')
  })
})

describe('findImportableGcmAccountsForHost (a, sincronizar cuentas previas — sin GCM/API real)', () => {
  // Nunca invoca PowerShell/GCM ni la API de GitLab de verdad en un test:
  // listCredentials/gitCredential/linkGitlab siempre inyectados.
  const host = 'gitlab.example.com'

  function linkedOf(username: string): LinkedAccount {
    return {
      provider: 'gitlab',
      username,
      id: 1,
      name: `Usuario ${username}`,
      email: `${username}@example.com`,
      token: `token-${username}`,
    }
  }

  it('sin nada guardado en GCM para ese host, no hay nada que ofrecer', async () => {
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => [],
      async () => {
        throw new Error('nunca debería llamarse sin candidatos')
      },
      async () => {
        throw new Error('nunca debería llamarse sin candidatos')
      },
    )
    expect(result).toEqual([])
  })

  it('ignora credenciales guardadas para otro host', async () => {
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => [{ host: 'otro-host.example.com', username: 'alguien' }],
      async () => {
        throw new Error('nunca debería llamarse para otro host')
      },
      async () => {
        throw new Error('nunca debería llamarse para otro host')
      },
    )
    expect(result).toEqual([])
  })

  it('un candidato nuevo: pide el token real con fill y lo confirma contra la API', async () => {
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => [{ host, username: 'cacheado-gcm' }],
      async (action, input) => {
        expect(action).toBe('fill')
        expect(input).toEqual({ protocol: 'https', host, username: 'cacheado-gcm' })
        return { password: 'token-cacheado-gcm' }
      },
      async (h, token) => {
        expect(h).toBe(host)
        expect(token).toBe('token-cacheado-gcm')
        return linkedOf('cacheado-gcm')
      },
    )
    expect(result).toEqual([linkedOf('cacheado-gcm')])
  })

  it('la identidad real es la que confirma la API, no la etiqueta que tenía GCM', async () => {
    // GCM guardó el username con el que se creó la credencial, pero el
    // token puede pertenecer a otra cuenta real (nunca se confía en la
    // etiqueta guardada, igual que con el username de glab CLI).
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => [{ host, username: 'etiqueta-vieja' }],
      async () => ({ password: 'token-real' }),
      async () => linkedOf('usuario-real'),
    )
    expect(result).toEqual([linkedOf('usuario-real')])
  })

  it('una cuenta ya vinculada (mismo host y username) no se vuelve a ofrecer, ni se llama a fill para ella', async () => {
    store.create({
      provider: 'gitlab',
      host,
      label: 'Ya vinculada',
      username: 'ya-vinculada',
      name: 'Ya vinculada',
      email: 'ya@example.com',
    })
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => [{ host, username: 'ya-vinculada' }],
      async () => {
        throw new Error('nunca debería pedirse el token de una cuenta ya vinculada')
      },
      async () => {
        throw new Error('nunca debería verificarse una cuenta ya vinculada')
      },
    )
    expect(result).toEqual([])
  })

  it('si la API resuelve el token a una cuenta que ya está vinculada, tampoco se ofrece', async () => {
    store.create({
      provider: 'gitlab',
      host,
      label: 'Ya vinculada',
      username: 'usuario-real',
      name: 'Usuario real',
      email: 'real@example.com',
    })
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => [{ host, username: 'etiqueta-vieja' }],
      async () => ({ password: 'token-real' }),
      async () => linkedOf('usuario-real'),
    )
    expect(result).toEqual([])
  })

  it('varios candidatos: devuelve todos los nuevos, sin elegir uno solo por su cuenta', async () => {
    const candidates: CachedGcmCredential[] = [
      { host, username: 'cuenta-a' },
      { host, username: 'cuenta-b' },
    ]
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => candidates,
      async (_action, input) => ({ password: `token-${input.username}` }),
      async (_h, token) => linkedOf(token.replace('token-', '')),
    )
    expect(result).toEqual([linkedOf('cuenta-a'), linkedOf('cuenta-b')])
  })

  it('un candidato sin token real que devolver (fill falla) se descarta en silencio, sin afectar a los demás', async () => {
    const candidates: CachedGcmCredential[] = [
      { host, username: 'sin-token' },
      { host, username: 'con-token' },
    ]
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => candidates,
      async (_action, input) => {
        if (input.username === 'sin-token') throw new Error('no encontrado en GCM')
        return { password: 'token-con-token' }
      },
      async () => linkedOf('con-token'),
    )
    expect(result).toEqual([linkedOf('con-token')])
  })

  it('un candidato cuyo token ya no es válido contra la API se descarta en silencio, sin afectar a los demás', async () => {
    const candidates: CachedGcmCredential[] = [
      { host, username: 'token-vencido' },
      { host, username: 'token-valido' },
    ]
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => candidates,
      async (_action, input) => ({ password: `token-${input.username}` }),
      async (_h, token) => {
        if (token === 'token-token-vencido') throw new Error('token inválido o revocado')
        return linkedOf('token-valido')
      },
    )
    expect(result).toEqual([linkedOf('token-valido')])
  })

  it('dos candidatos distintos en GCM que resuelven al mismo username real no se duplican', async () => {
    const candidates: CachedGcmCredential[] = [
      { host, username: 'alias-1' },
      { host, username: 'alias-2' },
    ]
    const result = await findImportableGcmAccountsForHost(
      store,
      host,
      async () => candidates,
      async (_action, input) => ({ password: `token-${input.username}` }),
      async () => linkedOf('mismo-usuario-real'),
    )
    expect(result).toEqual([linkedOf('mismo-usuario-real')])
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
