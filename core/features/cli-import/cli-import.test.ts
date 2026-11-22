import { describe, expect, it } from 'vitest'
import type { ExecFile } from './cli-import.ts'
import { findGithubCliToken } from './cli-import.ts'

// Nunca invoca el `gh` real: su salida es un token verdadero (de esta
// misma máquina, si está logueada), no un dato de prueba descartable como
// los hosts `.invalid` que usa `core/features/git-credential`. Siempre con
// un `exec` falso inyectado.

describe('findGithubCliToken (exec inyectado, nunca gh real)', () => {
  it('devuelve el token recortado cuando el comando sale bien', async () => {
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(null, 'gho_fake123\n')
    expect(await findGithubCliToken(fakeExec)).toBe('gho_fake123')
  })

  it('devuelve undefined si el comando falla (gh ausente o sin sesión), sin lanzar', async () => {
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(new Error('comando no encontrado'), '')
    expect(await findGithubCliToken(fakeExec)).toBeUndefined()
  })

  it('devuelve undefined si la salida está vacía', async () => {
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(null, '\n')
    expect(await findGithubCliToken(fakeExec)).toBeUndefined()
  })
})
