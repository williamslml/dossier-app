import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveGlobalConfigPath } from './identity.ts'

// M3 (requirements.md): resuelve la ruta real del config global vía
// `git config --global --list --show-origin`, nunca contra ~/.gitconfig
// real del que corre los tests — se aísla con GIT_CONFIG_GLOBAL.

let globalConfigPath: string

beforeEach(() => {
  const workDir = mkdtempSync(join(tmpdir(), 'sfp-identity-test-'))
  globalConfigPath = join(workDir, 'global.gitconfig')
})

describe('resolveGlobalConfigPath (M3)', () => {
  it('devuelve la ruta real cuando ya hay contenido (M3.1)', async () => {
    writeFileSync(globalConfigPath, '[user]\n\tname = Alguien\n')
    const resolved = await resolveGlobalConfigPath({ GIT_CONFIG_GLOBAL: globalConfigPath })
    expect(resolved).toBe(globalConfigPath)
  })

  it('fuerza la creación del archivo cuando está completamente vacío (M3.2)', async () => {
    // Ni siquiera existe todavía: config global de una máquina nueva.
    const resolved = await resolveGlobalConfigPath({ GIT_CONFIG_GLOBAL: globalConfigPath })
    expect(resolved).toBe(globalConfigPath)
    expect(readFileSync(globalConfigPath, 'utf8')).toContain('initialized')
  })

  it('sin un `env` explícito, igual respeta GIT_CONFIG_GLOBAL heredado del proceso — crítico: así es como lo llama `main/index.ts` de verdad, nunca debe tocar el ~/.gitconfig real de quien corre la app', async () => {
    writeFileSync(globalConfigPath, '[user]\n\tname = Alguien\n')
    const previous = process.env.GIT_CONFIG_GLOBAL
    process.env.GIT_CONFIG_GLOBAL = globalConfigPath
    try {
      const resolved = await resolveGlobalConfigPath()
      expect(resolved).toBe(globalConfigPath)
    } finally {
      if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL
      else process.env.GIT_CONFIG_GLOBAL = previous
    }
  })
})
