// Único punto de entrada público de `core` (ADR 0001). `main` (Fase 3) solo
// importa desde aquí, nunca de la ruta interna de una feature. `core` es
// Node puro: ningún archivo bajo `core/**` importa `electron`
// (docs/adr/0003-stack-fundacional-y-sin-backend.md, verificado también por
// una regla de ESLint, no solo por convención).

export type {
  CachedGcmCredential,
  CredentialStatus,
  GitCredentialAction,
  RunGitCredentialOptions,
  SecretStoreHealth,
} from './features/git-credential/git-credential.ts'
export {
  checkSecretStoreHealth,
  getCredentialStatus,
  listGcmGitCredentials,
  listGithubAccounts,
  runGitCredential,
} from './features/git-credential/git-credential.ts'

export {
  normalizeGitdirPattern,
  renderIncludeIfBlock,
  writeIncludeIf,
  writeProfileConfig,
} from './features/gitconfig/gitconfig.ts'
export {
  ensureActiveInclude,
  ensureBackup,
  removeIncludeIfBlock,
  updateRegion,
} from './features/gitconfig/region.ts'

export { getActiveConfigPath, getProfilePath, writeAccountProfile } from './features/identity/identity.ts'

export type { Account, AccountsStore, RemovedAccountRef } from './features/accounts/accounts.ts'
export { createAccountsStore } from './features/accounts/accounts.ts'

export type { Rule, RulesStore } from './features/rules/rules.ts'
export { createRulesStore, findOverlap, FolderOverlapError } from './features/rules/rules.ts'

export type { GithubVerification, LinkedAccount } from './features/providers/github/github.ts'
export { deriveNoreplyEmail, linkGithub } from './features/providers/github/github.ts'

export { linkGitlab } from './features/providers/gitlab/gitlab.ts'

export type { Brand } from './features/brand/brand.ts'
export { brand } from './features/brand/brand.ts'

export {
  findImportableGcmAccountsForHost,
  findImportableGithubCliAccount,
  findImportableGitlabCliAccount,
  linkGithubAccount,
  linkGitlabAccount,
  saveLinkedAccount,
} from './features/link-account/link-account.ts'

export type { Settings, SettingsStore, Theme } from './features/settings/settings.ts'
export { createSettingsStore } from './features/settings/settings.ts'

export type { OrphanedCredential } from './features/credential-maintenance/credential-maintenance.ts'
export { findOrphans } from './features/credential-maintenance/credential-maintenance.ts'

export type { ConflictRecord, HookName } from './features/identity-guard/identity-guard.ts'
export {
  buildHookScript,
  clearConflict,
  diffNewConflictFiles,
  getConflictPath,
  getConflictsDir,
  installHook,
  readConflicts,
  uninstallHook,
} from './features/identity-guard/identity-guard.ts'

export type { CloneAccount } from './features/clone/clone.ts'
export { cloneRepo, InvalidCloneUrlError, validateCloneUrl } from './features/clone/clone.ts'

export type { RemoveAccountDeps } from './features/account-lifecycle/account-lifecycle.ts'
export { removeLinkedAccount } from './features/account-lifecycle/account-lifecycle.ts'

export type { DoctorCheck } from './features/doctor/doctor.ts'
export { runDoctor } from './features/doctor/doctor.ts'
