/**
 * Nombres de canal IPC, compartidos entre `main` y `preload` — nunca
 * strings sueltos repetidos en los dos lados (design.md S3/S4).
 */
export const IPC = {
  getState: 'getState',
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
  renameAccount: 'renameAccount',
  getCredentialStatus: 'getCredentialStatus',
  recheckCredentials: 'recheckCredentials',
  listIdentityConflicts: 'listIdentityConflicts',
  identityConflictsUpdated: 'identityConflictsUpdated',
  resolveIdentityConflict: 'resolveIdentityConflict',
  cloneRepo: 'cloneRepo',
  runDoctor: 'runDoctor',
  checkSecretStore: 'checkSecretStore',
  checkGithubCliImport: 'checkGithubCliImport',
  importGithubCliAccount: 'importGithubCliAccount',
} as const
