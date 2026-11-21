import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { brand } from '../brand/brand.ts'
import { normalizeGitdirPattern } from './gitconfig.ts'

const START = `# ${brand.gitConfigMarker}:start`
const END = `# ${brand.gitConfigMarker}:end`

interface ParsedConfig {
  before: string
  region: string
  after: string
}

function parse(contents: string): ParsedConfig {
  const startIdx = contents.indexOf(START)
  const endIdx = contents.indexOf(END)
  if (startIdx === -1 || endIdx === -1) {
    return { before: contents, region: '', after: '' }
  }
  return {
    before: contents.slice(0, startIdx),
    region: contents.slice(startIdx + START.length, endIdx).trim(),
    after: contents.slice(endIdx + END.length),
  }
}

function serialize(before: string, region: string): string {
  const trimmedBefore = before.trimEnd()
  return `${trimmedBefore}${trimmedBefore ? '\n\n' : ''}${START}\n${region}\n${END}\n`
}

/** M2: copia de respaldo, una sola vez por archivo. */
export function ensureBackup(globalConfigPath: string): void {
  const backupPath = `${globalConfigPath}.dossier-backup`
  if (existsSync(globalConfigPath) && !existsSync(backupPath)) {
    copyFileSync(globalConfigPath, backupPath)
  }
}

/** M4.3: asegura un `[include]` apuntando a `activeConfigPath` como primer
    bloque de la región — idempotente, nunca lo duplica. */
export function ensureActiveInclude(region: string, activeConfigPath: string): string {
  // Insertar la ruta tal cual (con backslashes de Windows) como texto
  // suelto rompe el parseo de Git — "bad config line" (hallazgo real,
  // region.test.ts). Barras `/`, como ya hace normalizeGitdirPattern para
  // el mismo problema: Git en Windows las acepta sin ambigüedad.
  const normalizedPath = activeConfigPath.split('\\').join('/')
  if (region.includes(`path = ${normalizedPath}`)) return region
  const includeBlock = `[include]\n\tpath = ${normalizedPath}`
  return region.trim() ? `${includeBlock}\n${region}` : includeBlock
}

function splitBlocks(region: string): string[] {
  if (!region.trim()) return []
  return region
    .split(/\n(?=\[)/)
    .map((block) => block.trim())
    .filter(Boolean)
}

/** M6.2: quita el bloque `[includeIf "gitdir/i:…"]` de la carpeta indicada
    — el mismo criterio de normalización de ruta que `writeIncludeIf`, para
    que coincida con lo que de verdad se escribió. */
export function removeIncludeIfBlock(region: string, gitdirPattern: string): string {
  const marker = `gitdir/i:${normalizeGitdirPattern(gitdirPattern)}`
  return splitBlocks(region)
    .filter((block) => !block.includes(marker))
    .join('\n')
}

/**
 * M1: aplica `mutate` solo al contenido de la región (ya sin marcadores),
 * preservando todo lo de afuera, y vuelve a escribir la región al final.
 */
export function updateRegion(
  globalConfigPath: string,
  mutate: (currentRegion: string) => string,
): void {
  ensureBackup(globalConfigPath)
  const contents = existsSync(globalConfigPath) ? readFileSync(globalConfigPath, 'utf8') : ''
  const { before, region, after } = parse(contents)
  const nextRegion = mutate(region)
  // Todo lo ajeno (antes Y después de la región) se junta como "lo de
  // afuera" — la región siempre queda al final, también cuando el usuario
  // agregó algo después de la última escritura (docs/adr/0004).
  writeFileSync(globalConfigPath, serialize(`${before}${after}`, nextRegion))
}
