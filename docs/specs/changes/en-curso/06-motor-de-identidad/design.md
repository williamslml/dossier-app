# Design — Motor de identidad

## Región delimitada (`core/features/gitconfig/region.ts`, nuevo)

```ts
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { brand } from '../brand/brand.ts'

const START = `# ${brand.gitConfigMarker}:start`
const END = `# ${brand.gitConfigMarker}:end`

interface ParsedConfig {
  before: string // todo lo que está antes de la región (o el archivo entero, si no hay región)
  region: string // el contenido actual de la región, sin los marcadores (vacío si no existe)
  after: string // todo lo que está después de la región (debería estar vacío en uso normal, pero se preserva si no lo está)
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

/**
 * M1: aplica `mutate` solo al contenido de la región (ya sin marcadores),
 * preservando todo lo de afuera, y vuelve a escribir la región al final —
 * tal como exige docs/adr/0004 ("si el usuario añade líneas nuevas, la
 * región vuelve a moverse al final").
 */
export function updateRegion(
  globalConfigPath: string,
  mutate: (currentRegion: string) => string,
): void {
  ensureBackup(globalConfigPath)
  const contents = existsSync(globalConfigPath) ? readFileSync(globalConfigPath, 'utf8') : ''
  const { before, region, after } = parse(contents)
  const nextRegion = mutate(region)
  // `after` solo debería existir si alguien escribió algo manualmente
  // después de la región — se conserva pegado al final, después de que
  // la región (ya actualizada) vuelve a quedar al final del archivo.
  writeFileSync(globalConfigPath, serialize(before, nextRegion) + after)
}
```

`updateRegion` es la única función que toca el archivo directamente — `pinFolder`/`unpinFolder`/`setActiveAccount` arman el `mutate` que necesitan (agregar/quitar un bloque `[includeIf ...]` de texto, con `git config --file <tmp> ...` sobre un archivo temporal que después se injerta como texto — ver abajo) en vez de reimplementar un parser de INI completo.

**Por qué texto y no un parser de INI real:** escribir `git config --file` sobre un archivo que NO es el global de verdad (uno temporal, solo para generar el bloque de texto correcto) sigue dejando que sea Git mismo quien decide el formato exacto — coherente con "la lectura/escritura usa `git config --file` vía `simple-git`, sin parsear `.ini` a mano" (ya decidido en `docs/adr/0004`). El parser de arriba solo encuentra los marcadores (texto plano), nunca interpreta las líneas de `includeIf` una por una.

```ts
// core/features/gitconfig/gitconfig.ts, funciones nuevas junto a las existentes
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Arma el texto de un bloque `[includeIf "gitdir/i:…"]` usando Git mismo
    (mismo criterio que el resto del módulo), sobre un archivo temporal
    descartable — nunca tocando el config global directamente acá. */
async function renderIncludeIfBlock(gitdirPattern: string, profilePath: string): Promise<string> {
  const scratchDir = mkdtempSync(join(tmpdir(), 'dossier-gitconfig-'))
  const scratchFile = join(scratchDir, 'scratch.gitconfig')
  await writeIncludeIf(scratchFile, gitdirPattern, profilePath) // ya existe, reutilizada tal cual
  const block = readFileSync(scratchFile, 'utf8').trim()
  rmSync(scratchDir, { recursive: true, force: true })
  return block
}
```

## Resolver la ruta real del config global (`src/main/identity.ts`, nuevo)

Verificado en esta máquina antes de escribirlo (`git config --global --list --show-origin`, confirma el formato `file:<ruta>\t<clave>=<valor>` en la primera línea cuando hay al menos una clave global — lo normal en cualquier instalación real):

```ts
import { simpleGit } from 'simple-git'

export async function resolveGlobalConfigPath(): Promise<string> {
  const git = simpleGit()
  const output = await git.raw(['config', '--global', '--list', '--show-origin'])
  const firstLine = output.split('\n')[0] ?? ''
  const match = /^file:(.+?)\t/.exec(firstLine)
  if (match?.[1]) return match[1]
  // M3.2: config global de verdad vacío (máquina nueva) — forzar su
  // creación con una clave sentinela antes de volver a preguntar.
  await git.raw(['config', '--global', `${brand.gitConfigMarker}.initialized`, 'true'])
  return resolveGlobalConfigPath()
}
```

## Perfil por cuenta y cuenta activa (`core/features/identity/identity.ts`, nuevo)

```ts
import { join } from 'node:path'
import type { Account } from '../accounts/accounts.ts'
import { writeProfileConfig } from '../gitconfig/gitconfig.ts'

export function getProfilePath(dataDir: string, accountId: string): string {
  return join(dataDir, 'profiles', `${accountId}.gitconfig`)
}

export function getActiveConfigPath(dataDir: string): string {
  return join(dataDir, 'active.gitconfig')
}

function accountToProfileValues(account: Account): Record<string, string> {
  return {
    'user.name': account.name,
    'user.email': account.email,
    [`credential.${account.host}.username`]: account.username,
    [`credential.${account.host}.useHttpPath`]: 'false',
  }
}

export async function writeAccountProfile(dataDir: string, account: Account): Promise<void> {
  await writeProfileConfig(getProfilePath(dataDir, account.id), accountToProfileValues(account))
}

/** M4.3/M4.4: escritura atómica — nunca deja `active.gitconfig` a medio escribir. */
export async function setActiveAccount(dataDir: string, account: Account): Promise<void> {
  const activePath = getActiveConfigPath(dataDir)
  const tmpPath = `${activePath}.tmp`
  await writeProfileConfig(tmpPath, accountToProfileValues(account))
  renameSync(tmpPath, activePath) // rename es atómico en el mismo volumen (Windows incluido)
}
```

`setActiveAccount` solo reescribe el CONTENIDO de `active.gitconfig` — el `[include]` que apunta a ese archivo se asegura una sola vez (al iniciar `main`, o al vincular la primera cuenta), con `updateRegion`, nunca en cada cambio de cuenta.

## `main` — conectar todo

```ts
// src/main/index.ts, agregado
import { resolveGlobalConfigPath } from './identity.ts'
import { writeAccountProfile, setActiveAccount, getProfilePath } from '../../core/index.ts'
import { updateRegion } from '../../core/index.ts' // (re-exportado desde gitconfig)

const globalConfigPath = await resolveGlobalConfigPath()
// Verificado: `main` hoy no usa `app.getPath` para nada — cada store (`conf`)
// resuelve su propia carpeta de datos por su cuenta, sin relación con
// `~/.<dataDir>/` (docs/adr/0004 lo escribe así, literal, para los archivos
// de gitconfig — independiente de dónde `conf` guarde los JSON, que nunca
// fue el mismo lugar ni falta que lo sea).
const dataDir = join(homedir(), `.${brand.dataDir}`)

// Al iniciar: asegura el [include] de active.gitconfig una sola vez.
updateRegion(globalConfigPath, (region) => ensureActiveInclude(region, getActiveConfigPath(dataDir)))

ipcMain.handle(IPC.selectAccount, async (_event, payload: unknown) => {
  const { id } = selectAccountSchema.parse(payload)
  stateStore.setActiveId(id)
  const account = accountsStore.list().find((a) => a.id === id)
  if (account) await setActiveAccount(dataDir, account) // M5.1
  return getState()
})

ipcMain.handle(IPC.pinFolder, async (_event, payload: unknown) => {
  const { path, accountId } = pinFolderSchema.parse(payload)
  const account = accountsStore.list().find((a) => a.id === accountId)
  if (!account) throw new Error('Cuenta no encontrada')
  await writeAccountProfile(dataDir, account) // M6.1, idempotente si ya existe
  const rule = rulesStore.pin(path, accountId) // puede lanzar FolderOverlapError
  const block = await renderIncludeIfBlock(`${path}/`, getProfilePath(dataDir, accountId))
  updateRegion(globalConfigPath, (region) => `${region}\n${block}`.trim())
  return rule
})
```

**Decisión a confirmar al implementar:** dónde vive `dataDir` en la práctica — si `main` ya usa algún directorio real para `conf` (los JSON), lo más simple es poner `profiles/`/`active.gitconfig` ahí mismo, no inventar una ubicación nueva. Se confirma leyendo cómo arranca `main` hoy, no se asume acá.

## Tests (M1-M6)

Mismo patrón que `gitconfig.test.ts` ya usa: `GIT_CONFIG_GLOBAL` apuntando a un archivo de prueba (`mkdtempSync`), nunca `~/.gitconfig` real. Para M3 (resolver la ruta real), un test de integración separado, marcado para correr solo si hace falta verificar contra un entorno real controlado (mismo criterio que `describe.skipIf` ya usado en el módulo para lo específico de CI).
