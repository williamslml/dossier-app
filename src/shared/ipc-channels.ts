/**
 * Nombres de canal IPC, compartidos entre `main` y `preload` — nunca
 * strings sueltos repetidos en los dos lados (design.md S3/S4).
 */
export const IPC = {
  getState: 'getState',
  selectAccount: 'selectAccount',
  hideWindow: 'hideWindow',
  minimizeWindow: 'minimizeWindow',
  startGithubLink: 'startGithubLink',
  linkGitlab: 'linkGitlab',
  githubVerification: 'githubVerification',
  openExternal: 'openExternal',
  getSettings: 'getSettings',
  setSettings: 'setSettings',
  themeUpdated: 'themeUpdated',
  listPins: 'listPins',
  pinFolder: 'pinFolder',
  unpinFolder: 'unpinFolder',
  pickFolder: 'pickFolder',
  listOrphanedCredentials: 'listOrphanedCredentials',
  removeOrphanedCredential: 'removeOrphanedCredential',
  setEnforced: 'setEnforced',
  listIdentityConflicts: 'listIdentityConflicts',
  identityConflictsUpdated: 'identityConflictsUpdated',
  resolveIdentityConflict: 'resolveIdentityConflict',
} as const
