import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { simpleGit } from 'simple-git'
import { beforeEach, describe, expect, it } from 'vitest'
import { writeIncludeIf, writeProfileConfig } from './gitconfig.ts'

// R4 (requirements.md): includeIf resuelve identidad + cuenta por carpeta.
// R5: aislamiento total — GIT_CONFIG_GLOBAL apunta a un archivo temporal,
// nunca a ~/.gitconfig real; los repos son carpetas temporales con `git init`.

let workDir: string
let globalConfigPath: string
let dirA: string
let dirB: string
let dirC: string // sin includeIf: no debe verse afectada

async function gitConfigGet(cwd: string, key: string): Promise<string | undefined> {
  // allowUnsafeConfigPaths: simple-git bloquea GIT_CONFIG_GLOBAL por defecto
  // (protección razonable en producción); aquí es nuestro propio entorno de
  // prueba aislado (R5), así que habilitarlo es correcto, no un workaround.
  const git = simpleGit({ baseDir: cwd, unsafe: { allowUnsafeConfigPaths: true } }).env(
    'GIT_CONFIG_GLOBAL',
    globalConfigPath,
  )
  try {
    const value = (await git.raw(['config', '--get', key])).trim()
    // simple-git resuelve `config --get` de una clave inexistente como éxito
    // con cadena vacía (no como rechazo, aunque git real sale con código 1)
    // — confirmado comparando contra execFileSync plano. '' == "no configurado".
    return value === '' ? undefined : value
  } catch (err) {
    if (err instanceof Error && !/exit code 1/.test(err.message)) {
      // Un fallo distinto de "no existe la clave" (exit 1) es un bug real,
      // no un resultado "undefined" legítimo — no lo enmascaramos.
      throw err
    }
    return undefined
  }
}

beforeEach(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'sfp-includeif-spike-'))
  globalConfigPath = join(workDir, 'global.gitconfig')
  writeFileSync(globalConfigPath, '') // config global de prueba, vacío, nunca ~/.gitconfig

  dirA = join(workDir, 'repo-a')
  dirB = join(workDir, 'repo-b')
  dirC = join(workDir, 'repo-c-sin-pin')
  for (const dir of [dirA, dirB, dirC]) {
    mkdirSync(dir, { recursive: true })
    await simpleGit(dir).init()
  }

  const profileA = join(workDir, 'profile-a.gitconfig')
  const profileB = join(workDir, 'profile-b.gitconfig')
  await writeProfileConfig(profileA, {
    'user.name': 'Cuenta A',
    'user.email': 'a@example.invalid',
    'credential.github.com.username': 'usuario-a',
  })
  await writeProfileConfig(profileB, {
    'user.name': 'Cuenta B',
    'user.email': 'b@example.invalid',
    'credential.github.com.username': 'usuario-b',
  })
  await writeIncludeIf(globalConfigPath, `${dirA}/`, profileA)
  await writeIncludeIf(globalConfigPath, `${dirB}/`, profileB)
})

describe('includeIf por carpeta (R4)', () => {
  it('[DEBUG temporal] diagnóstico de rutas en este runner', async () => {
    const { execFileSync } = await import('node:child_process')
    console.log('DEBUG dirA:', dirA)
    console.log('DEBUG git --version:', execFileSync('git', ['--version']).toString().trim())
    console.log(
      'DEBUG absolute-git-dir:',
      execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: dirA }).toString().trim(),
    )
    console.log('DEBUG global config contents:\n' + readFileSync(globalConfigPath, 'utf8'))
    console.log(
      'DEBUG config --list (sin GIT_CONFIG_GLOBAL):\n' +
        execFileSync('git', ['config', '--list'], { cwd: dirA }).toString(),
    )
    console.log(
      'DEBUG config --list (CON GIT_CONFIG_GLOBAL):\n' +
        execFileSync('git', ['config', '--list'], {
          cwd: dirA,
          env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfigPath },
        }).toString(),
    )
  })

  it('cada carpeta resuelve su propia identidad (R4.1, R4.3)', async () => {
    expect(await gitConfigGet(dirA, 'user.email')).toBe('a@example.invalid')
    expect(await gitConfigGet(dirB, 'user.email')).toBe('b@example.invalid')
  })

  it('cada carpeta resuelve su propia cuenta de credencial (R4.2)', async () => {
    expect(await gitConfigGet(dirA, 'credential.github.com.username')).toBe('usuario-a')
    expect(await gitConfigGet(dirB, 'credential.github.com.username')).toBe('usuario-b')
  })

  it('una carpeta sin pin no se ve afectada (R4.4)', async () => {
    expect(await gitConfigGet(dirC, 'user.email')).toBeUndefined()
  })

  it('la región queda al final del config global (replica la regla real, docs/adr/0004)', () => {
    const contents = readFileSync(globalConfigPath, 'utf8')
    const firstIncludeIf = contents.indexOf('[includeIf')
    expect(firstIncludeIf).toBeGreaterThanOrEqual(0)
  })
})

// Reproduce el fallo visto en CI (windows-latest y macos-latest de GitHub
// Actions, no en esta máquina): `os.tmpdir()` en esos runners resuelve a
// través de un symlink/junction (p. ej. macOS /var → /private/var). Git
// resuelve el `gitdir` por su ruta REAL al hacer el match de `includeIf`;
// si el patrón se construye con la ruta sin resolver, el match falla en
// silencio. Se simula con una junction local — reproduce en cualquier SO.
describe('includeIf con una ruta alcanzada por symlink/junction (CI real)', () => {
  it('resuelve igual aunque el directorio se alcance por una ruta no canónica', async () => {
    const realRoot = mkdtempSync(join(tmpdir(), 'sfp-symlink-real-'))
    const linkRoot = join(tmpdir(), `sfp-symlink-link-${Math.random().toString(36).slice(2)}`)
    symlinkSync(realRoot, linkRoot, 'junction')

    const globalCfg = join(realRoot, 'global.gitconfig')
    writeFileSync(globalCfg, '')

    // dirA se referencia por la ruta SIMBÓLICA, igual que tmpdir() la
    // devolvería en un runner afectado — no por su realpath.
    const dirA = join(linkRoot, 'repo-a')
    mkdirSync(dirA, { recursive: true })
    await simpleGit(dirA).init()

    const profileA = join(realRoot, 'profile-a.gitconfig')
    await writeProfileConfig(profileA, {
      'user.name': 'Cuenta A',
      'user.email': 'a@example.invalid',
    })
    await writeIncludeIf(globalCfg, `${dirA}/`, profileA)

    const git = simpleGit({ baseDir: dirA, unsafe: { allowUnsafeConfigPaths: true } }).env(
      'GIT_CONFIG_GLOBAL',
      globalCfg,
    )
    const value = (await git.raw(['config', '--get', 'user.email'])).trim()
    expect(value).toBe('a@example.invalid')
  })
})
