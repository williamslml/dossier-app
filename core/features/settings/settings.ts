import Conf from 'conf'

export type Theme = 'claro' | 'oscuro' | 'sistema'

export interface Settings {
  theme: Theme
  launchAtStartup: boolean
}

export interface SettingsStore {
  get(): Settings
  update(partial: Partial<Settings>): Settings
}

const DEFAULTS: Settings = {
  theme: 'sistema',
  launchAtStartup: false,
}

export function createSettingsStore(options?: { cwd?: string }): SettingsStore {
  const conf = new Conf<Settings>({
    projectName: 'dossier',
    configName: 'settings',
    defaults: DEFAULTS,
    ...(options?.cwd ? { cwd: options.cwd } : {}),
  })

  return {
    get(): Settings {
      return {
        theme: conf.get('theme'),
        launchAtStartup: conf.get('launchAtStartup'),
      }
    },
    update(partial: Partial<Settings>): Settings {
      if (partial.theme !== undefined) conf.set('theme', partial.theme)
      if (partial.launchAtStartup !== undefined)
        conf.set('launchAtStartup', partial.launchAtStartup)
      return this.get()
    },
  }
}
