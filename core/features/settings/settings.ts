import Conf from 'conf'

export type Theme = 'claro' | 'oscuro' | 'sistema'

export interface Settings {
  theme: Theme
  launchAtStartup: boolean
  /** S6.1 (05-ajustes): si además de la identidad, al cambiar de cuenta
      activa se escribe también la clave de firma de la cuenta (si tiene
      una asignada) — apagado por defecto, ver proposal.md. */
  applySigningKeyOnSwitch: boolean
}

export interface SettingsStore {
  get(): Settings
  update(partial: Partial<Settings>): Settings
}

const DEFAULTS: Settings = {
  theme: 'sistema',
  launchAtStartup: false,
  applySigningKeyOnSwitch: false,
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
        applySigningKeyOnSwitch: conf.get('applySigningKeyOnSwitch'),
      }
    },
    update(partial: Partial<Settings>): Settings {
      if (partial.theme !== undefined) conf.set('theme', partial.theme)
      if (partial.launchAtStartup !== undefined)
        conf.set('launchAtStartup', partial.launchAtStartup)
      if (partial.applySigningKeyOnSwitch !== undefined)
        conf.set('applySigningKeyOnSwitch', partial.applySigningKeyOnSwitch)
      return this.get()
    },
  }
}
