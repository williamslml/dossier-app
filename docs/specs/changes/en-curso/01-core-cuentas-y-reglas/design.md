# Design — Fase 1: módulo `core`

## Estructura (ADR 0001: feature-first, no por capa)

```
core/
├── features/
│   ├── git-credential/
│   │   ├── git-credential.ts          # migrado de spike/, sin cambios de comportamiento
│   │   └── git-credential.test.ts
│   ├── gitconfig/
│   │   ├── gitconfig.ts               # migrado de spike/includeif.ts, renombrado
│   │   └── gitconfig.test.ts
│   ├── accounts/
│   │   ├── accounts.ts                # API pública: createAccountsStore(...)
│   │   └── accounts.test.ts
│   └── rules/
│       ├── rules.ts                   # API pública: createRulesStore(...)
│       └── rules.test.ts
└── index.ts                           # único punto de entrada público re-exportado
```

Cada feature exporta su API por un único archivo; nada se importa entre features por su ruta interna (regla común de los 8 perfiles). `core/index.ts` es el único punto de entrada que `main` (Fase 3) importará.

## M2 — `accounts.ts`

```ts
export interface Account {
  id: string
  provider: 'github' | 'gitlab'
  host: string
  label: string
  username: string
  name: string
  email: string
}

export interface AccountsStore {
  list(): Account[]
  create(data: Omit<Account, 'id'>): Account
  rename(id: string, label: string): Account
  remove(id: string): void
}

export function createAccountsStore(options?: { cwd?: string }): AccountsStore
```

- `conf` (docs/product.md §4.2) con `projectName: 'dossier'`, `configName: 'accounts'`; `options.cwd` se pasa directo a `conf` para aislar tests (nunca `~/.dossier` real en tests).
- `id`: `randomUUID()` de `node:crypto` — no literales incrementales (evita colisiones si se reconstruye el store).
- `remove` de un `id` inexistente: **no lanza** (idempotente) — fijado en M2.4 porque la UI (Fase 3) va a llamar "eliminar" desde un botón que ya desapareció de la lista si hay una doble pulsación; tratarlo como error forzaría a la UI a manejar una carrera que no le aporta nada.
- `rename` de un `id` inexistente: **sí lanza** (`Error` con mensaje claro) — a diferencia de `remove`, renombrar algo que no existe es siempre un bug del llamador, no una carrera esperable.

## M3 — `rules.ts`

```ts
export interface Rule {
  path: string
  accountId: string
}

export interface RulesStore {
  list(): Rule[]
  pin(path: string, accountId: string): Rule
  unpin(path: string): void
}

export function createRulesStore(options?: { cwd?: string }): RulesStore
```

- Normalización de ruta antes de comparar: `path.replace(/\\/g, '/')`, minúsculas (Windows es case-insensitive en el sistema de archivos; replica el mismo criterio que `gitdir/i:` ya usa para `includeIf`), con `/` final.
- `pin(path, accountId)`:
  1. Si ya existe una regla con el **mismo** path normalizado → se reemplaza (`accountId` nuevo), no es conflicto (M3.2, re-fijar).
  2. Si no, buscar si algún path existente es prefijo del nuevo, o el nuevo es prefijo de alguno existente → **rechazar** lanzando `FolderOverlapError` con el path en conflicto (M3.3).
  3. Si no hay solapamiento, agregar la regla nueva.
- `unpin(path)`: quita la regla cuyo path normalizado coincide; no lanza si no existía (misma lógica que `remove` de cuentas).

## Verificación de este change

- `pnpm test` corre todo `core/**/*.test.ts`; M1 (migrados) deben seguir en verde sin tocar su lógica. M2/M3 son código nuevo → TDD completo (RED confirmado antes de implementar cada uno).
- `pnpm lint`: regla nueva que prohíbe `import ... from 'electron'` dentro de `core/**` (M1.3), ver `eslint.config.js`.
- Nada de esto depende de red ni de GCM real: `accounts`/`rules` son JSON puro vía `conf`.
