import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildHookScript,
  clearConflict,
  diffNewConflictFiles,
  getConflictPath,
  getConflictsDir,
  HOOK_MARKER,
  installHook,
  readConflicts,
  uninstallHook,
} from './identity-guard.ts'

// S11 (requirements.md, docs/specs/changes/en-curso/05-ajustes): guardia de
// identidad por carpeta — hooks de Git que cortan un commit/push si la
// identidad real no coincide con la cuenta fijada a esa carpeta.

let repoPath: string
let dataDir: string

beforeEach(() => {
  repoPath = mkdtempSync(join(tmpdir(), 'sfp-identity-guard-repo-'))
  dataDir = mkdtempSync(join(tmpdir(), 'sfp-identity-guard-data-'))
})

describe('installHook (S11.2)', () => {
  it('instala el hook cuando no existe ninguno', () => {
    const script = buildHookScript({
      repoPath,
      expectedEmail: 'a@x.com',
      conflictPath: getConflictPath(dataDir, repoPath),
      hook: 'pre-commit',
    })
    const result = installHook(repoPath, 'pre-commit', script)
    expect(result).toBe('instalado')
    expect(readFileSync(join(repoPath, '.git', 'hooks', 'pre-commit'), 'utf8')).toBe(script)
  })

  it('no pisa un hook ajeno (sin la marca de Dossier)', () => {
    mkdirSync(join(repoPath, '.git', 'hooks'), { recursive: true })
    writeFileSync(join(repoPath, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho ajeno\n')

    const script = buildHookScript({
      repoPath,
      expectedEmail: 'a@x.com',
      conflictPath: getConflictPath(dataDir, repoPath),
      hook: 'pre-commit',
    })
    const result = installHook(repoPath, 'pre-commit', script)

    expect(result).toBe('ya-existe-ajeno')
    expect(readFileSync(join(repoPath, '.git', 'hooks', 'pre-commit'), 'utf8')).toBe(
      '#!/bin/sh\necho ajeno\n',
    )
  })

  it('sí sobreescribe un hook que ya instaló Dossier antes (p. ej. cambió la cuenta)', () => {
    mkdirSync(join(repoPath, '.git', 'hooks'), { recursive: true })
    writeFileSync(join(repoPath, '.git', 'hooks', 'pre-commit'), `${HOOK_MARKER}echo viejo\n`)

    const script = buildHookScript({
      repoPath,
      expectedEmail: 'nueva@x.com',
      conflictPath: getConflictPath(dataDir, repoPath),
      hook: 'pre-commit',
    })
    const result = installHook(repoPath, 'pre-commit', script)

    expect(result).toBe('instalado')
    expect(readFileSync(join(repoPath, '.git', 'hooks', 'pre-commit'), 'utf8')).toBe(script)
  })
})

describe('uninstallHook (apagar la guardia)', () => {
  it('borra un hook que instaló Dossier', () => {
    mkdirSync(join(repoPath, '.git', 'hooks'), { recursive: true })
    writeFileSync(join(repoPath, '.git', 'hooks', 'pre-commit'), `${HOOK_MARKER}echo hola\n`)

    uninstallHook(repoPath, 'pre-commit')

    expect(existsSync(join(repoPath, '.git', 'hooks', 'pre-commit'))).toBe(false)
  })

  it('no toca un hook ajeno', () => {
    mkdirSync(join(repoPath, '.git', 'hooks'), { recursive: true })
    writeFileSync(join(repoPath, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho ajeno\n')

    uninstallHook(repoPath, 'pre-commit')

    expect(readFileSync(join(repoPath, '.git', 'hooks', 'pre-commit'), 'utf8')).toBe(
      '#!/bin/sh\necho ajeno\n',
    )
  })

  it('sobre un hook que no existe es idempotente', () => {
    expect(() => uninstallHook(repoPath, 'pre-commit')).not.toThrow()
  })
})

describe('buildHookScript (S11.3)', () => {
  it('el script generado incluye la marca y el email esperado', () => {
    const script = buildHookScript({
      repoPath,
      expectedEmail: 'nombre@dominio.com',
      conflictPath: getConflictPath(dataDir, repoPath),
      hook: 'pre-commit',
    })
    expect(script.startsWith('#!/bin/sh\n')).toBe(true)
    expect(script).toContain(HOOK_MARKER)
    expect(script).toContain('nombre@dominio.com')
    expect(script).toContain('git config user.email')
  })
})

describe('registro de conflictos (S11.4)', () => {
  it('no hay conflictos cuando nunca se escribió ninguno', () => {
    expect(readConflicts(dataDir)).toEqual([])
  })

  it('lee un conflicto ya escrito (simulando lo que escribiría el hook)', () => {
    const conflictPath = getConflictPath(dataDir, repoPath)
    mkdirSync(getConflictsDir(dataDir), { recursive: true })
    writeFileSync(
      conflictPath,
      JSON.stringify({
        repoPath,
        expectedEmail: 'a@x.com',
        actualEmail: 'b@x.com',
        hook: 'pre-commit',
        at: '2026-01-01T00:00:00Z',
      }),
    )

    expect(readConflicts(dataDir)).toEqual([
      {
        repoPath,
        expectedEmail: 'a@x.com',
        actualEmail: 'b@x.com',
        hook: 'pre-commit',
        at: '2026-01-01T00:00:00Z',
      },
    ])
  })

  it('clearConflict borra el registro de esa carpeta', () => {
    const conflictPath = getConflictPath(dataDir, repoPath)
    mkdirSync(getConflictsDir(dataDir), { recursive: true })
    writeFileSync(conflictPath, JSON.stringify({ repoPath }))

    clearConflict(dataDir, repoPath)

    expect(existsSync(conflictPath)).toBe(false)
    expect(readConflicts(dataDir)).toEqual([])
  })

  it('clearConflict sobre una carpeta sin conflicto es idempotente', () => {
    expect(() => clearConflict(dataDir, repoPath)).not.toThrow()
  })
})

// S11.3 (escenario verificable de requirements.md): integración real, sin
// mockear Git — instala el hook en un repo temporal de verdad y confirma
// que corta un commit con la identidad equivocada, con el mensaje y el
// registro de conflicto esperados.
describe('integración real con Git (S11.3)', () => {
  function git(args: string[], env?: Record<string, string>) {
    return execFileSync('git', args, {
      cwd: repoPath,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    })
  }

  beforeEach(() => {
    git(['init', '--initial-branch=main'])
    git(['config', 'user.name', 'Cuenta Correcta'])
    git(['config', 'user.email', 'correcta@x.com'])

    const script = buildHookScript({
      repoPath,
      expectedEmail: 'correcta@x.com',
      conflictPath: getConflictPath(dataDir, repoPath),
      hook: 'pre-commit',
    })
    installHook(repoPath, 'pre-commit', script)
  })

  it('un commit con la identidad correcta pasa', () => {
    expect(() => git(['commit', '--allow-empty', '-m', 'ok'])).not.toThrow()
  })

  it('un commit con la identidad equivocada se corta, con el mensaje esperado', () => {
    git(['config', 'user.email', 'equivocada@x.com'])

    let error: unknown
    try {
      execFileSync('git', ['commit', '--allow-empty', '-m', 'mal'], {
        cwd: repoPath,
        encoding: 'utf8',
      })
    } catch (err) {
      error = err
    }

    expect(error).toBeDefined()
    const stderr = (error as { stderr: string }).stderr
    expect(stderr).toContain('correcta@x.com')
    expect(stderr).toContain('equivocada@x.com')
  })

  it('el commit cortado deja un registro de conflicto legible para main', () => {
    git(['config', 'user.email', 'equivocada@x.com'])
    try {
      execFileSync('git', ['commit', '--allow-empty', '-m', 'mal'], { cwd: repoPath })
    } catch {
      // esperado — el hook corta el commit
    }

    const conflicts = readConflicts(dataDir)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      repoPath,
      expectedEmail: 'correcta@x.com',
      actualEmail: 'equivocada@x.com',
      hook: 'pre-commit',
    })
  })
})

describe('diffNewConflictFiles (notificar conflicto de identidad sin abrir la ventana)', () => {
  it('sin nada conocido antes, cada archivo actual es "nuevo"', () => {
    expect(diffNewConflictFiles([], ['a.json', 'b.json'])).toEqual(['a.json', 'b.json'])
  })

  it('un archivo ya conocido no se vuelve a reportar', () => {
    expect(diffNewConflictFiles(['a.json'], ['a.json', 'b.json'])).toEqual(['b.json'])
  })

  it('sin archivos nuevos, da una lista vacía', () => {
    expect(diffNewConflictFiles(['a.json'], ['a.json'])).toEqual([])
  })

  it('un archivo que desapareció (conflicto resuelto) no cuenta como nuevo si reaparece recién después', () => {
    // El resuelto ya no está en "actual" — si vuelve a aparecer más
    // adelante (un conflicto nuevo de verdad), el llamador pasa el "actual"
    // de ESE momento, sin el archivo viejo en "conocidos" — por eso esta
    // función no necesita saber nada de "resuelto", solo compara dos listas.
    expect(diffNewConflictFiles(['a.json', 'b.json'], ['a.json'])).toEqual([])
  })

  it('la secuencia completa: aparece, se resuelve, y vuelve a aparecer — cuenta como nuevo las dos veces', () => {
    // Simula lo que haría el llamador real (main/index.ts): mantiene su
    // propio "conocidos" actualizado con el resultado de cada chequeo.
    let known: string[] = []

    const firstCheck = diffNewConflictFiles(known, ['a.json'])
    expect(firstCheck).toEqual(['a.json']) // conflicto nuevo: se notifica
    known = ['a.json']

    const afterResolved = diffNewConflictFiles(known, [])
    expect(afterResolved).toEqual([]) // se borró el archivo: nada nuevo
    known = []

    const reappeared = diffNewConflictFiles(known, ['a.json'])
    expect(reappeared).toEqual(['a.json']) // mismo nombre, conflicto nuevo de verdad: se notifica de nuevo
  })
})

// Hallazgo de revisión: no había ningún test que probara buildHookScript con
// caracteres que importan para un shell (comillas, `$`, backtick, espacios)
// — exactamente lo que `escapeForDoubleQuotedShell` existe para cubrir.
describe('caracteres especiales en el shell (hallazgo de revisión)', () => {
  function git(args: string[], cwd: string) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' })
  }

  it('una ruta con espacios funciona igual (común en Windows)', () => {
    const repoWithSpace = join(repoPath, 'con espacios en el nombre')
    mkdirSync(repoWithSpace)
    git(['init', '--initial-branch=main'], repoWithSpace)
    git(['config', 'user.name', 'Cuenta Correcta'], repoWithSpace)
    git(['config', 'user.email', 'correcta@x.com'], repoWithSpace)

    const script = buildHookScript({
      repoPath: repoWithSpace,
      expectedEmail: 'correcta@x.com',
      conflictPath: getConflictPath(dataDir, repoWithSpace),
      hook: 'pre-commit',
    })
    installHook(repoWithSpace, 'pre-commit', script)

    expect(() => git(['commit', '--allow-empty', '-m', 'ok'], repoWithSpace)).not.toThrow()
  })

  it('un email con comillas, $ y backtick no inyecta comandos ni rompe el JSON del conflicto', () => {
    // No es un email real, pero nada impide que `account.email` contenga
    // estos caracteres en algún momento — esto es justo lo que
    // escapeForDoubleQuotedShell tiene que neutralizar.
    const trickyEmail = `a"b\`whoami\`c$(echo inyectado)d`

    git(['init', '--initial-branch=main'], repoPath)
    git(['config', 'user.name', 'Cuenta'], repoPath)
    git(['config', 'user.email', trickyEmail], repoPath)

    const script = buildHookScript({
      repoPath,
      expectedEmail: trickyEmail,
      conflictPath: getConflictPath(dataDir, repoPath),
      hook: 'pre-commit',
    })
    installHook(repoPath, 'pre-commit', script)

    // Con la identidad correcta (igual al email "raro"), el commit pasa —
    // si el escape rompiera la comparación, esto fallaría.
    expect(() => git(['commit', '--allow-empty', '-m', 'ok'], repoPath)).not.toThrow()

    // Con otra identidad, se corta y el conflicto queda bien formado —
    // si el escape no neutralizara $()/backticks, esto podría ejecutar
    // comandos arbitrarios al generar el JSON en vez de solo registrar
    // el texto tal cual.
    git(['config', 'user.email', 'otra@x.com'], repoPath)
    try {
      execFileSync('git', ['commit', '--allow-empty', '-m', 'mal'], { cwd: repoPath })
    } catch {
      // esperado
    }

    const conflicts = readConflicts(dataDir)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.expectedEmail).toBe(trickyEmail)
    expect(conflicts[0]?.actualEmail).toBe('otra@x.com')
  })
})
