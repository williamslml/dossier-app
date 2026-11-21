import Conf from 'conf'

export interface StateStore {
  getActiveId(): string | undefined
  setActiveId(id: string): void
}

interface Schema {
  activeId?: string
}

/** docs/product.md §3.5: state.json → activeId. Mismo patrón que accounts/rules. */
export function createStateStore(options?: { cwd?: string }): StateStore {
  const conf = new Conf<Schema>({
    projectName: 'dossier',
    configName: 'state',
    defaults: {},
    ...(options?.cwd ? { cwd: options.cwd } : {}),
  })

  return {
    getActiveId(): string | undefined {
      return conf.get('activeId')
    },
    setActiveId(id: string): void {
      conf.set('activeId', id)
    },
  }
}
