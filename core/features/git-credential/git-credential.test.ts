import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildGitCredentialArgs,
  checkSecretStoreHealth,
  getCredentialStatus,
  listGcmGitCredentials,
  parseCredentialHelperChain,
  parseGcmGitCredentialsOutput,
  parseGithubListOutput,
  runGitCredential,
} from './git-credential.ts'

describe('buildGitCredentialArgs (sin red ni GCM, pura)', () => {
  // Hallazgo real (docs/lessons/README.md): `git credential fill` (el
  // despachador genérico) falla para github.com aunque la credencial esté
  // guardada; `git credential-manager get` (directo) funciona siempre. Por
  // eso approve/fill/reject se mapean a los comandos nativos de GCM.
  it('mapea approve/fill/reject a store/get/erase de git credential-manager', () => {
    expect(buildGitCredentialArgs('approve')).toEqual(['credential-manager', 'store', '--no-ui'])
    expect(buildGitCredentialArgs('fill')).toEqual(['credential-manager', 'get', '--no-ui'])
    expect(buildGitCredentialArgs('reject')).toEqual(['credential-manager', 'erase', '--no-ui'])
  })
})

describe('parseGithubListOutput (S9.1, 05-ajustes — pura, sin GCM real)', () => {
  // `git-credential-manager github list` imprime un username por línea
  // (verificado contra --help del binario real + evidencia pública de su
  // salida; el formato exacto de un caso con cuentas reales queda por
  // confirmar la primera vez que se use contra una instalación real, sin
  // forzarlo ahora — el sandbox de esta sesión bloquea tocar cuentas reales
  // de GitHub, correctamente).
  it('separa un username por línea', () => {
    expect(parseGithubListOutput('octocat\nhubot\n')).toEqual(['octocat', 'hubot'])
  })

  it('ignora líneas vacías', () => {
    expect(parseGithubListOutput('octocat\n\n\nhubot\n')).toEqual(['octocat', 'hubot'])
  })

  it('salida vacía da una lista vacía, no [""]', () => {
    expect(parseGithubListOutput('')).toEqual([])
    expect(parseGithubListOutput('\n')).toEqual([])
  })
})

describe('parseGcmGitCredentialsOutput (a, sincronizar cuentas previas — pura, sin PowerShell real)', () => {
  it('extrae host y username de cada entrada "git:https://<host>"', () => {
    const stdout = JSON.stringify([
      { target: 'git:https://github.com', username: 'octocat' },
      { target: 'git:https://gitlab.example.com', username: 'hubot' },
    ])
    expect(parseGcmGitCredentialsOutput(stdout)).toEqual([
      { host: 'github.com', username: 'octocat' },
      { host: 'gitlab.example.com', username: 'hubot' },
    ])
  })

  it('ignora targets que no son de git (otras apps guardadas en el mismo Credential Manager)', () => {
    const stdout = JSON.stringify([
      { target: 'MicrosoftAccount:target=SSO_POP_Device', username: 'alguien' },
      { target: 'git:https://github.com', username: 'octocat' },
    ])
    expect(parseGcmGitCredentialsOutput(stdout)).toEqual([{ host: 'github.com', username: 'octocat' }])
  })

  it('ignora entradas sin username (PowerShell ya las filtra, pero no hay que confiar ciegamente)', () => {
    const stdout = JSON.stringify([{ target: 'git:https://github.com', username: '' }])
    expect(parseGcmGitCredentialsOutput(stdout)).toEqual([])
  })

  it('salida vacía, no-JSON, o algo que no sea un array da [] — nunca lanza', () => {
    expect(parseGcmGitCredentialsOutput('')).toEqual([])
    expect(parseGcmGitCredentialsOutput('  \n ')).toEqual([])
    expect(parseGcmGitCredentialsOutput('esto no es JSON')).toEqual([])
    expect(parseGcmGitCredentialsOutput('{"target":"git:https://github.com"}')).toEqual([])
  })

  it('con más de una credencial en el mismo host, GCM embebe el username en el target (hallazgo real) — el host sigue siendo el correcto', () => {
    const stdout = JSON.stringify([
      { target: 'git:https://github.com', username: 'primera-cuenta' },
      { target: 'git:https://segunda-cuenta@github.com', username: 'segunda-cuenta' },
    ])
    expect(parseGcmGitCredentialsOutput(stdout)).toEqual([
      { host: 'github.com', username: 'primera-cuenta' },
      { host: 'github.com', username: 'segunda-cuenta' },
    ])
  })

  it('PowerShell colapsa un array de un solo elemento a un objeto suelto — se maneja igual', () => {
    // ConvertTo-Json -AsArray evita esto en la salida real, pero si algún
    // día cambiara, un objeto suelto (no en un array) no debe hacer caer el
    // parseo entero — nunca ofrecer nada en vez de lanzar.
    expect(parseGcmGitCredentialsOutput('{"target":"git:https://github.com","username":"octocat"}')).toEqual(
      [],
    )
  })
})

describe('parseCredentialHelperChain (pura, sin Git real)', () => {
  it('separa un helper por línea', () => {
    expect(parseCredentialHelperChain('manager\n')).toEqual(['manager'])
    expect(parseCredentialHelperChain('store\nmanager\n')).toEqual(['store', 'manager'])
  })

  it('salida vacía da una lista vacía', () => {
    expect(parseCredentialHelperChain('')).toEqual([])
  })
})

// R3 (requirements.md): approve/fill/reject de GCM por cuenta. Solo tiene
// sentido en Windows real (GCM es específico de Git for Windows) — R5 exige
// no tocar cuentas reales: host reservado .invalid (nunca resuelve) + tokens
// de prueba con sufijo aleatorio, y limpieza (`reject`) garantizada al final.

const isWindows = process.platform === 'win32'
const HOST = 'sfp-spike-test.invalid'
const suffix = randomUUID().slice(0, 8)
const userA = `spike-test-a-${suffix}`
const userB = `spike-test-b-${suffix}`
const tokenA = `spike-token-a-${suffix}`
const tokenB = `spike-token-b-${suffix}`

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

describe('getCredentialStatus (GCM real en Windows)', () => {
  it.runIf(isWindows)(
    'detecta GCM en la cadena real de este entorno, sin otro helper antes (R3, decisión de diseño)',
    async () => {
      // Esta máquina de prueba ya exige 'manager' en la cadena para correr
      // el resto de la suite (hasManagerHelper más abajo) — confirma que
      // getCredentialStatus lee lo mismo que ese chequeo ad-hoc.
      const status = await getCredentialStatus()
      expect(status.gcmConfigured).toBe(true)
      expect(status.helpers.some((h) => /manager/.test(h))).toBe(true)
    },
  )

  it('nunca lanza, incluso si "git config" no tuviera nada configurado', async () => {
    // No se puede simular un credential.helper real sin GCM sin tocar la
    // config global de esta máquina — se prueba la función pura en su lugar
    // (parseCredentialHelperChain ya cubierta arriba) y acá solo que
    // getCredentialStatus siempre resuelve, nunca rechaza.
    const status = await getCredentialStatus()
    expect(typeof status.gcmConfigured).toBe('boolean')
    expect(Array.isArray(status.helpers)).toBe(true)
  })
})

describe('checkSecretStoreHealth (GCM real en Windows)', () => {
  it.runIf(isWindows)('el round-trip real (approve + fill + reject) da healthy=true', async () => {
    const result = await checkSecretStoreHealth()
    expect(result).toEqual({ healthy: true })
  })

  it.runIf(isWindows)(
    'nunca deja basura de prueba: un "fill" aparte confirma que "reject" de verdad borró la credencial (hallazgo de revisión)',
    async () => {
      // Credencial fija (no la aleatoria interna) para poder confirmarlo
      // desde afuera, con el mismo mecanismo que ya usa "reject borra solo
      // la credencial indicada" más abajo en este archivo — no alcanza con
      // inferirlo corriendo el chequeo dos veces.
      const host = 'dossier-health-check-cleanup.invalid'
      const username = `health-cleanup-${suffix}`
      const password = `probe-cleanup-${suffix}`

      const result = await checkSecretStoreHealth({ credential: { host, username, password } })
      expect(result).toEqual({ healthy: true })

      await expect(
        runGitCredential('fill', { protocol: 'https', host, username }),
      ).rejects.toThrow()
    },
  )
})

describe('listGcmGitCredentials (a, sincronizar cuentas previas — GCM real en Windows)', () => {
  it.runIf(isWindows)(
    'encuentra una credencial de prueba recién guardada por su host y username reales',
    async () => {
      const host = 'sfp-list-gcm-test.invalid'
      const username = `list-test-${suffix}`
      await runGitCredential('approve', {
        protocol: 'https',
        host,
        username,
        password: `probe-${suffix}`,
      })

      try {
        const found = await listGcmGitCredentials()
        expect(found).toContainEqual({ host, username })
      } finally {
        await runGitCredential('reject', { protocol: 'https', host, username })
      }
    },
  )

  it.runIf(isWindows)('nunca expone la contraseña — solo host y username', async () => {
    const host = 'sfp-list-gcm-secret-test.invalid'
    const username = `secret-test-${suffix}`
    const password = `super-secreto-${suffix}`
    await runGitCredential('approve', { protocol: 'https', host, username, password })

    try {
      const found = await listGcmGitCredentials()
      const entry = found.find((c) => c.host === host)
      expect(entry).toEqual({ host, username })
      expect(Object.keys(entry ?? {})).toEqual(['host', 'username'])
      expect(JSON.stringify(found)).not.toContain(password)
    } finally {
      await runGitCredential('reject', { protocol: 'https', host, username })
    }
  })

  it.runIf(isWindows)(
    'con dos credenciales guardadas para el mismo host (GCM embebe el username en el target de la segunda), encuentra las dos con el host correcto',
    async () => {
      const host = 'sfp-list-gcm-multi-test.invalid'
      const userA = `multi-a-${suffix}`
      const userB = `multi-b-${suffix}`
      await runGitCredential('approve', { protocol: 'https', host, username: userA, password: 'pa' })
      await runGitCredential('approve', { protocol: 'https', host, username: userB, password: 'pb' })

      try {
        const found = await listGcmGitCredentials()
        expect(found).toContainEqual({ host, username: userA })
        expect(found).toContainEqual({ host, username: userB })
      } finally {
        await runGitCredential('reject', { protocol: 'https', host, username: userA })
        await runGitCredential('reject', { protocol: 'https', host, username: userB })
      }
    },
  )

  it('en un sistema sin PowerShell (o cualquier falla), nunca lanza — da []', async () => {
    // No se puede simular la ausencia de PowerShell en Windows real sin
    // tocar el PATH del proceso; se confirma en su lugar que la función
    // resuelve siempre (nunca rechaza), que es la garantía que de verdad
    // importa para el llamador (nunca debe bloquear vincular una cuenta).
    const found = await listGcmGitCredentials()
    expect(Array.isArray(found)).toBe(true)
  })
})

describe.skipIf(!isWindows)('git-credential (R3, GCM real en Windows)', () => {
  beforeAll(() => {
    if (!hasManagerHelper()) {
      throw new Error(
        "credential.helper no incluye 'manager'/'manager-core' (docs/adr/0004-modelo-de-credenciales-e-identidad.md): instala/configura Git for Windows con GCM antes de correr este spike.",
      )
    }
  })

  afterAll(async () => {
    // R5: nunca dejar basura de prueba en el Credential Manager real.
    await runGitCredential('reject', { protocol: 'https', host: HOST, username: userA })
    await runGitCredential('reject', { protocol: 'https', host: HOST, username: userB })
  })

  it('approve + fill devuelve el token correcto según el username (R3.1-R3.4)', async () => {
    await runGitCredential('approve', {
      protocol: 'https',
      host: HOST,
      username: userA,
      password: tokenA,
    })
    await runGitCredential('approve', {
      protocol: 'https',
      host: HOST,
      username: userB,
      password: tokenB,
    })

    const filledA = await runGitCredential('fill', {
      protocol: 'https',
      host: HOST,
      username: userA,
    })
    const filledB = await runGitCredential('fill', {
      protocol: 'https',
      host: HOST,
      username: userB,
    })

    expect(filledA.password).toBe(tokenA)
    expect(filledB.password).toBe(tokenB)
  })

  it('reject borra solo la credencial indicada (R3.6)', async () => {
    await runGitCredential('approve', {
      protocol: 'https',
      host: HOST,
      username: userA,
      password: tokenA,
    })
    await runGitCredential('reject', { protocol: 'https', host: HOST, username: userA })

    // Hallazgo real (ver docs/lessons/README.md): sin credencial cacheada,
    // GCM intenta un *probe* de red para autodetectar el proveedor del host
    // antes de rendirse. Contra un host .invalid eso falla con exit 128
    // (no con una respuesta vacía) — sigue siendo "no encontrado", solo que
    // se manifiesta como rechazo de la promesa, no como password distinto.
    await expect(
      runGitCredential('fill', { protocol: 'https', host: HOST, username: userA }),
    ).rejects.toThrow()
  })

  it('nunca deja el proceso colgado: respeta el timeout, incluso si git falla rápido por red (R3.5)', async () => {
    const start = Date.now()
    await expect(
      runGitCredential(
        'fill',
        { protocol: 'https', host: 'otro-host-sin-credencial.invalid', username: 'nadie' },
        { timeoutMs: 3_000 },
      ),
    ).rejects.toThrow() // falla (sin credencial + host no resuelve), pero NUNCA por timeout
    expect(Date.now() - start).toBeLessThan(3_000) // se resolvió por sí mismo, no lo mató el timer
  })
})
