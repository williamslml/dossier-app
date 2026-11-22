import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { cloneRepo, InvalidCloneUrlError, validateCloneUrl } from './clone.ts'

// Q1/Q2 (requirements.md, docs/specs/changes/en-curso/07-quick-clone):
// clonar con la credencial correcta de la cuenta elegida, nunca la activa.

describe('validateCloneUrl (Q2)', () => {
  const knownHosts = ['github.com', 'gitlab.com']

  it('acepta una URL https de un host con cuenta vinculada (Q2.1/Q2.2)', () => {
    expect(() => validateCloneUrl('https://github.com/user/repo.git', knownHosts)).not.toThrow()
  })

  it('rechaza ssh:// (Q2.1)', () => {
    expect(() => validateCloneUrl('ssh://git@github.com/user/repo.git', knownHosts)).toThrow(
      InvalidCloneUrlError,
    )
  })

  it('rechaza git:// (Q2.1)', () => {
    expect(() => validateCloneUrl('git://github.com/user/repo.git', knownHosts)).toThrow(
      InvalidCloneUrlError,
    )
  })

  it('rechaza una ruta local (Q2.1)', () => {
    expect(() => validateCloneUrl('C:/Users/alguien/repo', knownHosts)).toThrow(
      InvalidCloneUrlError,
    )
  })

  it('rechaza un host sin ninguna cuenta vinculada (Q2.2)', () => {
    expect(() => validateCloneUrl('https://bitbucket.org/user/repo.git', knownHosts)).toThrow(
      InvalidCloneUrlError,
    )
  })

  it('rechaza algo que ni siquiera parsea como URL', () => {
    expect(() => validateCloneUrl('no-es-una-url', knownHosts)).toThrow(InvalidCloneUrlError)
  })

  // Hallazgo de revisión: una URL con credenciales embebidas pasaba la
  // validación (el host post-"@" es el real, conocido) y se le pasaba tal
  // cual a `git clone` como argumento de línea de comandos — expone el
  // secreto en el argv del proceso mientras dura el clone (visible por
  // Administrador de Tareas a otros procesos de la sesión), justo lo que
  // ADR 0006 prohíbe para tokens.
  it('rechaza una URL con usuario embebido (https://usuario@host/...)', () => {
    expect(() => validateCloneUrl('https://usuario@github.com/user/repo.git', knownHosts)).toThrow(
      InvalidCloneUrlError,
    )
  })

  it('rechaza una URL con usuario y contraseña/token embebidos', () => {
    expect(() =>
      validateCloneUrl('https://usuario:ghp_token123@github.com/user/repo.git', knownHosts),
    ).toThrow(InvalidCloneUrlError)
  })

  // Hallazgo de revisión: `new URL(url).host` siempre viene en minúsculas,
  // pero el host guardado de una cuenta (sobre todo GitLab autoalojado, el
  // usuario lo tipea a mano al vincular, sin normalizar) podría no estarlo
  // — un host legítimo no debería rechazarse solo porque se guardó con
  // otras mayúsculas/minúsculas que la URL.
  it('acepta un host conocido aunque se haya guardado con otras mayúsculas/minúsculas', () => {
    expect(() =>
      validateCloneUrl('https://gitlab.ejemplo.com/user/repo.git', ['GitLab.Ejemplo.com']),
    ).not.toThrow()
  })
})

// Q1.3 (escenario verificable de requirements.md): integración real, sin
// mockear Git. Clona desde un repo bare *local* (no github.com): prueba la
// mecánica real de `git clone` (incluido el `-c credential.*` que arma
// cloneRepo) sin depender de la red — mismo criterio que el resto de la
// suite (Git/GCM reales, nunca una API remota real).
describe('cloneRepo (Q1), integración real con Git', () => {
  let sourceRepo: string
  let destPath: string

  beforeEach(() => {
    const parent = mkdtempSync(join(tmpdir(), 'sfp-clone-test-'))
    sourceRepo = join(parent, 'origin.git')
    mkdirSync(sourceRepo)
    execFileSync('git', ['init', '--bare', '--initial-branch=main', sourceRepo])
    destPath = join(parent, 'repo')
  })

  it('clona un repositorio real y confirma el remoto resultante', async () => {
    await cloneRepo(sourceRepo, destPath, { host: 'local-test', username: 'cualquiera' })

    expect(existsSync(join(destPath, '.git'))).toBe(true)
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: destPath,
      encoding: 'utf8',
    }).trim()
    expect(remote).toBe(sourceRepo)
  })

  it('rechaza con el error real de Git si el origen no existe, sin crear la carpeta', async () => {
    const noExiste = join(sourceRepo, '..', 'no-existe.git')

    await expect(
      cloneRepo(noExiste, destPath, { host: 'local-test', username: 'cualquiera' }),
    ).rejects.toThrow()

    expect(existsSync(join(destPath, '.git'))).toBe(false)
  })
})

// Hallazgo de revisión: `cloneRepo` no desactivaba la interactividad de Git
// (a diferencia de `core/features/git-credential`, que sí lo hace para
// approve/fill/reject) — si GCM no puede resolver la credencial en
// silencio, Git podía quedar esperando un prompt para siempre, con el
// `invoke` de IPC colgado indefinidamente (ADR 0004/0006: nunca interactivo,
// nunca silencioso de más).
describe('cloneRepo nunca espera un prompt interactivo (hallazgo de revisión)', () => {
  let destPath: string

  beforeEach(() => {
    destPath = join(mkdtempSync(join(tmpdir(), 'sfp-clone-noprompt-')), 'repo')
  })

  it('contra un host real que pide autenticación y sin credencial cacheada, falla rápido en vez de colgarse', async () => {
    const start = Date.now()
    // gitlab.com (no el host de ninguna cuenta vinculada en este
    // proyecto, `git.innv.attach.group` sí lo es) — sin credencial en
    // GCM para este host, un repo privado/inexistente fuerza a Git a
    // pedir autenticación.
    await expect(
      cloneRepo('https://gitlab.com/sfp-test-no-deberia-existir-nunca/repo.git', destPath, {
        host: 'gitlab.com',
        username: 'nadie',
      }),
    ).rejects.toThrow()
    // Si GIT_TERMINAL_PROMPT no estuviera en 0, esto se quedaría
    // esperando una terminal que nunca va a responder.
    expect(Date.now() - start).toBeLessThan(15_000)
  }, 20_000)
})
