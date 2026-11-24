# Dossier

*[Leer en español](README.es.md)*

A Windows tray app that manages multiple Git identities per folder. It configures **Git Credential Manager (GCM)** and Git `includeIf` rules so several GitHub and GitLab accounts can coexist on the same machine — each folder picks its own commit identity and HTTPS account automatically, with nothing to switch by hand.

Built for developers and consultants who juggle personal, client, and corporate accounts on one computer.

## What it does

- Links GitHub accounts (OAuth Device Flow) and GitLab accounts (personal access token, including self-hosted instances, not just gitlab.com).
- Stores tokens in Windows Credential Manager via GCM — never in a file on disk.
- Pins a folder to an account: every `clone`, `pull`, `push`, and commit from that folder uses the right identity, with no manual `git config` needed.
- Quick Clone: clone a repository straight into an account's identity, auto-pinned.
- An optional identity guard (`pre-commit`/`pre-push` hooks) blocks a commit if the folder's real Git identity doesn't match what it's pinned to.
- A "Doctor" check validates, on demand, that every pinned folder actually resolves to the right account.
- Detects whether GCM and the underlying credential store are working, with a clear warning when they aren't.
- Signing keys (SSH or OpenPGP) are part of an account's profile, not a global switch — any folder pinned to that account signs its commits with it automatically. Dossier never generates or imports a key; it only references one you already created.
- If `gh` CLI is already authenticated on your machine, Dossier can offer to import that session instead of starting a new GitHub login.
- Auto-updates from GitHub Releases.

## What it doesn't do

- It doesn't replace the Git client or Git Credential Manager, or install a credential helper of its own.
- It doesn't use SSH for remote transport (`clone`/`fetch`/`push` stay on HTTPS) — though an account's profile can still have an SSH key assigned purely for commit *signing*, a separate Git feature from transport.
- It has no server, database, or account system of its own — it's not SaaS, and no token ever leaves the machine.

## Platform

Windows only, by design — see `docs/product.md` §1 for why (macOS code-signing cost, Linux out of scope). The codebase stays cross-platform in principle (no Windows-only paths baked in without reason), but only Windows is built, tested, and shipped.

## Status

Core functionality is built and verified end-to-end against real GitHub/GitLab accounts and a real Windows Credential Manager: linking accounts, per-folder identity, Quick Clone, the identity guard, Doctor, GCM/secret-store health checks, syncing an existing `gh` CLI session, account management (rename, assign/clear a signing key, unlink), Settings, and the release pipeline (installer + auto-update).

Still open: the installer isn't code-signed yet (pending a SignPath Foundation application), `glab` CLI import and detecting an already-cached GCM credential (part of "sync accounts linked before Dossier existed"), verification against a real self-hosted GitLab/GitHub Enterprise Server instance, and `winget`/Scoop packaging. Full phase-by-phase detail lives in `docs/product.md` §5.

## Getting it

Download the installer from [GitHub Releases](https://github.com/williamslml/dossier-app/releases). It isn't code-signed yet, so Windows SmartScreen will warn before you run it — this is expected until the SignPath Foundation signing application is approved.

## Building from source

See `docs/runbooks/arrancar-el-proyecto.md` for the full setup (dependencies, a required manual Electron install step, and how to run it).

```
pnpm install
node node_modules/electron/install.js   # required manual step, see the runbook
pnpm dev                                 # hot-reload development
```

## Contributing

See `CONTRIBUTING.md`. This project follows a spec-first methodology documented in `CLAUDE.md` (in Spanish) — read it before proposing a non-trivial change.

## Security

See `SECURITY.md` to report a vulnerability.

## Documentation

- `docs/product.md` — vision, scope, and the status of every phase (Spanish).
- `docs/adr/` — architectural decisions already made, with the reasoning behind each (Spanish).
- `docs/specs/` — what each change builds, in progress or archived once closed (Spanish).
- `docs/lessons/` — non-obvious findings from development, so the same investigation isn't repeated (Spanish).

The project's internal documentation is in Spanish (the primary author's working language); this README and the contributor-facing files are bilingual so the project stays approachable either way.

## License

MIT — see `LICENSE`.
