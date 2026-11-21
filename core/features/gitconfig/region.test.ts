import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { normalizeGitdirPattern, renderIncludeIfBlock } from './gitconfig.ts'
import { ensureActiveInclude, ensureBackup, removeIncludeIfBlock, updateRegion } from './region.ts'

// M1/M2 (requirements.md): región delimitada por marcadores, movida al
// final en cada escritura; respaldo único antes de la primera escritura.
// Config de prueba aislado, nunca ~/.gitconfig real.

let configPath: string

beforeEach(() => {
  const workDir = mkdtempSync(join(tmpdir(), 'sfp-region-test-'))
  configPath = join(workDir, 'global.gitconfig')
})

describe('updateRegion (M1)', () => {
  it('crea la región al final cuando el archivo no existe todavía', () => {
    updateRegion(configPath, () => '[include]\n\tpath = active.gitconfig')
    const contents = readFileSync(configPath, 'utf8')
    expect(contents).toContain('# dossier:start')
    expect(contents).toContain('[include]')
    expect(contents).toContain('# dossier:end')
  })

  it('preserva contenido ajeno que ya estaba antes de la región', () => {
    writeFileSync(configPath, '[core]\n\tautocrlf = true\n')
    updateRegion(configPath, () => '[include]\n\tpath = active.gitconfig')
    const contents = readFileSync(configPath, 'utf8')
    expect(contents).toContain('[core]')
    expect(contents).toContain('autocrlf = true')
  })

  it('en la segunda escritura, mueve la región al final si el usuario agregó algo después', () => {
    updateRegion(configPath, () => '[include]\n\tpath = active.gitconfig')
    const afterFirstWrite = readFileSync(configPath, 'utf8')
    writeFileSync(configPath, `${afterFirstWrite}\n[user]\n\tname = Alguien\n`)

    updateRegion(
      configPath,
      (region) => `${region}\n[includeIf "gitdir/i:/x/"]\n\tpath = x.gitconfig`,
    )

    const contents = readFileSync(configPath, 'utf8')
    expect(contents).toContain('[user]')
    expect(contents).toContain('name = Alguien')
    const userIdx = contents.indexOf('[user]')
    const regionStartIdx = contents.lastIndexOf('# dossier:start')
    expect(regionStartIdx).toBeGreaterThan(userIdx)
  })

  it('le pasa a mutate el contenido actual de la región, sin los marcadores', () => {
    updateRegion(configPath, () => '[include]\n\tpath = active.gitconfig')
    let receivedRegion = ''
    updateRegion(configPath, (region) => {
      receivedRegion = region
      return region
    })
    expect(receivedRegion).toBe('[include]\n\tpath = active.gitconfig')
  })
})

describe('ensureActiveInclude (M4.3)', () => {
  it('agrega el [include] cuando la región está vacía', () => {
    const next = ensureActiveInclude('', 'C:/dossier/active.gitconfig')
    expect(next).toContain('[include]')
    expect(next).toContain('path = C:/dossier/active.gitconfig')
  })

  it('una ruta de Windows con backslashes no rompe el parseo del config (hallazgo real)', () => {
    const windowsPath = 'C:\\Users\\alguien\\.dossier\\active.gitconfig'
    const next = ensureActiveInclude('', windowsPath)
    writeFileSync(configPath, `# dossier:start\n${next}\n# dossier:end\n`)
    // Si la ruta quedó mal escapada, esto tira "bad config line" — Git
    // mismo es el juez, no una aserción de texto sobre el contenido.
    expect(() =>
      execFileSync('git', ['config', '--file', configPath, '--get', 'include.path']),
    ).not.toThrow()
  })

  it('agrega el [include] antes de bloques ya existentes', () => {
    const next = ensureActiveInclude(
      '[includeIf "gitdir/i:C:/Trabajo/"]\n\tpath = x.gitconfig',
      'C:/dossier/active.gitconfig',
    )
    const includeIdx = next.indexOf('[include]')
    const includeIfIdx = next.indexOf('[includeIf')
    expect(includeIdx).toBeGreaterThanOrEqual(0)
    expect(includeIdx).toBeLessThan(includeIfIdx)
  })

  it('es idempotente: no lo duplica si ya está', () => {
    const once = ensureActiveInclude('', 'C:/dossier/active.gitconfig')
    const twice = ensureActiveInclude(once, 'C:/dossier/active.gitconfig')
    expect(twice).toBe(once)
  })
})

describe('removeIncludeIfBlock (M6.2)', () => {
  let folderA: string
  let folderB: string

  beforeEach(() => {
    const root = mkdtempSync(join(tmpdir(), 'sfp-remove-includeif-'))
    folderA = join(root, 'a')
    folderB = join(root, 'b')
    mkdirSync(folderA)
    mkdirSync(folderB)
  })

  it('quita solo el bloque de la carpeta indicada', async () => {
    const blockA = await renderIncludeIfBlock(`${folderA}/`, 'perfil-a.gitconfig')
    const blockB = await renderIncludeIfBlock(`${folderB}/`, 'perfil-b.gitconfig')
    const region = `${blockA}\n${blockB}`

    const next = removeIncludeIfBlock(region, `${folderA}/`)

    expect(next).not.toContain(normalizeGitdirPattern(`${folderA}/`))
    expect(next).toContain(normalizeGitdirPattern(`${folderB}/`))
  })
})

describe('ensureBackup (M2)', () => {
  it('no crea nada si el archivo todavía no existe', () => {
    ensureBackup(configPath)
    expect(existsSync(`${configPath}.dossier-backup`)).toBe(false)
  })

  it('copia el archivo la primera vez', () => {
    writeFileSync(configPath, '[core]\n\tautocrlf = true\n')
    ensureBackup(configPath)
    expect(readFileSync(`${configPath}.dossier-backup`, 'utf8')).toBe('[core]\n\tautocrlf = true\n')
  })

  it('no pisa un respaldo que ya existe', () => {
    writeFileSync(configPath, 'contenido original\n')
    ensureBackup(configPath)
    writeFileSync(configPath, 'contenido modificado\n')
    ensureBackup(configPath)
    expect(readFileSync(`${configPath}.dossier-backup`, 'utf8')).toBe('contenido original\n')
  })
})
