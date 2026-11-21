import Conf from 'conf'

export interface Rule {
  path: string
  accountId: string
}

export interface RulesStore {
  list(): Rule[]
  pin(path: string, accountId: string): Rule
  unpin(path: string): void
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
        const replaced: Rule = { path, accountId }
        const next = [...rules]
        next[exactIndex] = replaced
        conf.set('rules', next)
        return replaced
      }

      const conflict = rules.find((r) => overlaps(normalize(r.path), target))
      if (conflict) {
        throw new FolderOverlapError(path, conflict.path)
      }

      const rule: Rule = { path, accountId }
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
  }
}
