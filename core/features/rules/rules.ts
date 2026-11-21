import Conf from 'conf'

export interface Rule {
  path: string
  accountId: string
  /** S11.1 (05-ajustes): instala hooks de Git que cortan un commit/push si
      la identidad real no coincide con la cuenta de esta regla. Apagado
      por defecto — nunca se activa solo. */
  enforced: boolean
}

export interface RulesStore {
  list(): Rule[]
  pin(path: string, accountId: string): Rule
  unpin(path: string): void
  setEnforced(path: string, enforced: boolean): Rule
}

/**
 * Una carpeta dentro de otra ya fijada (o que ya contiene una fijada) es un
 * conflicto explícito (docs/adr/0004-modelo-de-credenciales-e-identidad.md:
 * "no hay competencia por prefijo").
 */
export class FolderOverlapError extends Error {
  constructor(
    readonly path: string,
    readonly conflictsWith: string,
  ) {
    super(`"${path}" se solapa con una carpeta ya fijada: "${conflictsWith}"`)
    this.name = 'FolderOverlapError'
  }
}

interface Schema {
  rules: Rule[]
}

/**
 * Normaliza para comparar: "/" en vez de "\" (Windows), minúsculas (el
 * sistema de archivos de Windows no distingue mayúsculas — mismo criterio
 * que ya usa `gitdir/i:` para includeIf), con "/" final.
 */
function normalize(path: string): string {
  const withSlashes = path.replace(/\\/g, '/').toLowerCase()
  return withSlashes.endsWith('/') ? withSlashes : `${withSlashes}/`
}

function overlaps(a: string, b: string): boolean {
  return a !== b && (a.startsWith(b) || b.startsWith(a))
}

export function createRulesStore(options?: { cwd?: string }): RulesStore {
  const conf = new Conf<Schema>({
    projectName: 'dossier',
    configName: 'rules',
    defaults: { rules: [] },
    ...(options?.cwd ? { cwd: options.cwd } : {}),
  })

  return {
    list(): Rule[] {
      return conf.get('rules')
    },

    pin(path: string, accountId: string): Rule {
      const target = normalize(path)
      const rules = conf.get('rules')

      const exactIndex = rules.findIndex((r) => normalize(r.path) === target)
      if (exactIndex !== -1) {
        // S11.1: re-fijar a otra cuenta no apaga una guardia ya activada —
        // es la misma carpeta la que la pidió, no la cuenta.
        const existing = rules[exactIndex]
        const replaced: Rule = { path, accountId, enforced: existing?.enforced ?? false }
        const next = [...rules]
        next[exactIndex] = replaced
        conf.set('rules', next)
        return replaced
      }

      const conflict = rules.find((r) => overlaps(normalize(r.path), target))
      if (conflict) {
        throw new FolderOverlapError(path, conflict.path)
      }

      const rule: Rule = { path, accountId, enforced: false }
      conf.set('rules', [...rules, rule])
      return rule
    },

    unpin(path: string): void {
      const target = normalize(path)
      conf.set(
        'rules',
        conf.get('rules').filter((r) => normalize(r.path) !== target),
      )
    },

    setEnforced(path: string, enforced: boolean): Rule {
      const target = normalize(path)
      const rules = conf.get('rules')
      const index = rules.findIndex((r) => normalize(r.path) === target)
      if (index === -1) {
        throw new Error(`No hay ninguna regla fijada para "${path}"`)
      }
      const updated: Rule = { ...(rules[index] as Rule), enforced }
      const next = [...rules]
      next[index] = updated
      conf.set('rules', next)
      return updated
    },
  }
}
