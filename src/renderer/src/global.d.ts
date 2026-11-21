import type { DossierApi } from '../../preload/index.ts'

declare global {
  interface Window {
    dossier: DossierApi
  }
}

export {}
