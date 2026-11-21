import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runGitCredential } from './git-credential.ts'

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
