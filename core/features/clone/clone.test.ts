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
