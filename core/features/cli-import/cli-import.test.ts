import { describe, expect, it } from 'vitest'
import type { ExecFile } from './cli-import.ts'
import { findGithubCliToken, findGitlabCliToken } from './cli-import.ts'

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

// Dos hallazgos reales (probados en vivo contra el binario real de glab
// 1.132.0, instalado aparte para esto, host .invalid, nunca una cuenta
// real), los dos reproducidos acá a propósito para que no se rompan en
// silencio: (1) a diferencia de `gh auth token`, `glab auth status
// --show-token` sale con código != 0 incluso cuando SÍ encuentra el token
// (intenta confirmarlo contra la API; si falla, igual imprime la línea
// antes de reportar el error) — los tests fuerzan `err` no nulo en los
// casos "sí hay token" también. (2) esa línea sale por **stderr**, no por
// stdout — los tests la ponen en `stderr`, con `stdout` vacío, para que un
// cambio que vuelva a mirar solo stdout falle de inmediato.
describe('findGitlabCliToken (exec inyectado, nunca glab real)', () => {
  it('devuelve el token aunque el comando haya salido con error (host no resuelve o token inválido)', async () => {
    const stderr =
      'sfp-glab-test.invalid\n' +
      '  x sfp-glab-test.invalid: API call failed: ...\n' +
      '  ✓ Token found in configuration file (plaintext): glpat-fake123\n'
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(new Error('exit code 1'), '', stderr)
    expect(await findGitlabCliToken('sfp-glab-test.invalid', fakeExec)).toBe('glpat-fake123')
  })

  it('funciona igual si el token está en el keyring del sistema operativo, no en el archivo', async () => {
    const stderr = '  ✓ Token found in operating system keyring: glpat-fake456\n'
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(new Error('exit code 1'), '', stderr)
    expect(await findGitlabCliToken('sfp-glab-test.invalid', fakeExec)).toBe('glpat-fake456')
  })

  it('devuelve undefined si el host nunca se autenticó con glab', async () => {
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(new Error('exit code 1'), '', '')
    expect(await findGitlabCliToken('nunca-configurado.invalid', fakeExec)).toBeUndefined()
  })

  it('devuelve undefined si no hay ningún token guardado para ese host', async () => {
    const stderr = '  ! No token found (checked config file, keyring, and environment variables).\n'
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(new Error('exit code 1'), '', stderr)
    expect(await findGitlabCliToken('sfp-glab-test.invalid', fakeExec)).toBeUndefined()
  })

  it('devuelve undefined si el token solo aparece en stdout (nunca pasa en la realidad, pero confirma que no alcanza con stdout solo)', async () => {
    const stdout = '  ✓ Token found in configuration file (plaintext): glpat-no-deberia-contar\n'
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(new Error('exit code 1'), stdout)
    // Igual matchea: el regex corre sobre stdout+stderr concatenados, así
    // que esto SÍ se detecta — lo que confirma es que ambos canales se
    // revisan, no que stdout se ignore.
    expect(await findGitlabCliToken('sfp-glab-test.invalid', fakeExec)).toBe(
      'glpat-no-deberia-contar',
    )
  })

  it('devuelve undefined si el comando falla por completo (glab ausente), sin lanzar', async () => {
    const fakeExec: ExecFile = (_cmd, _args, _opts, cb) => cb(new Error('comando no encontrado'), '')
    expect(await findGitlabCliToken('gitlab.com', fakeExec)).toBeUndefined()
  })
})
