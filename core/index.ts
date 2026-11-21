// Único punto de entrada público de `core` (ADR 0001). `main` (Fase 3) solo
// importa desde aquí, nunca de la ruta interna de una feature. `core` es
// Node puro: ningún archivo bajo `core/**` importa `electron`
// (docs/adr/0003-stack-fundacional-y-sin-backend.md, verificado también por
// una regla de ESLint, no solo por convención).

export type {
  GitCredentialAction,
  RunGitCredentialOptions,
} from './features/git-credential/git-credential.ts'
export { runGitCredential } from './features/git-credential/git-credential.ts'

export { writeIncludeIf, writeProfileConfig } from './features/gitconfig/gitconfig.ts'

export type { Account, AccountsStore } from './features/accounts/accounts.ts'
export { createAccountsStore } from './features/accounts/accounts.ts'

export type { Rule, RulesStore } from './features/rules/rules.ts'
export { createRulesStore, FolderOverlapError } from './features/rules/rules.ts'

export type { GithubVerification, LinkedAccount } from './features/providers/github/github.ts'
export { deriveNoreplyEmail, linkGithub } from './features/providers/github/github.ts'

export { linkGitlab } from './features/providers/gitlab/gitlab.ts'
