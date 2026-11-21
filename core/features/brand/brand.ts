/**
 * Configuración de marca (ADR 0005, `docs/adr/0005-configuracion-de-marca-reemplazable.md`):
 * un solo lugar. Nada más en el proyecto repite estos literales.
 */
export interface Brand {
  displayName: string
  slug: string
  appId: string
  dataDir: string
  gitConfigMarker: string
  githubOAuthAppName: string
}

export const brand: Brand = {
  displayName: 'Dossier',
  slug: 'dossier',
  appId: 'com.dossier.app',
  dataDir: 'dossier',
  gitConfigMarker: 'dossier',
  githubOAuthAppName: 'Dossier',
}
