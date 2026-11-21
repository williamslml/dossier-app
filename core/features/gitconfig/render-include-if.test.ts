import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderIncludeIfBlock } from './gitconfig.ts'

// M6 (requirements.md): arma el texto de un bloque `includeIf` usando Git
// mismo, sobre un archivo descartable — nunca tocando el config global.
// `writeIncludeIf` resuelve la ruta real (realpathSync.native), así que
// el directorio tiene que existir de verdad — mismo criterio que ya usa
// gitconfig.test.ts, no una ruta inventada.
//
// Nota: no se prueba acá "no deja archivo temporal residual" contando
// entradas del directorio temporal del sistema (`tmpdir()`) — es un
// recurso global compartido con cualquier otro archivo de test que corra
// en paralelo (confirmado: el conteo fallaba de forma intermitente según
// qué más corriera al mismo tiempo, no por un bug real). La limpieza
// (`rmSync` en un `finally`) se verifica leyendo el código, no contando
// un recurso ambiente que ningún test puede aislar de verdad.

let folder: string

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'sfp-render-include-if-'))
})

describe('renderIncludeIfBlock', () => {
  it('devuelve el bloque includeIf tal como lo escribiría Git', async () => {
    const block = await renderIncludeIfBlock(`${folder}/`, 'C:/perfiles/cuenta-1.gitconfig')
    expect(block).toContain('[includeIf')
    expect(block).toContain('path = C:/perfiles/cuenta-1.gitconfig')
  })
})
