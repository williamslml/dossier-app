# Contributing to Dossier

Thanks for considering a contribution. This is currently a solo-maintained project, so the bar for process is simple, but a few things keep it consistent.

## Before you start

- **Read `CLAUDE.md`** (in Spanish — the project's working language). It documents the Spec-First Protocol this project follows: non-trivial changes get a spec (`docs/specs/changes/en-curso/<name>/`) before code, and changes touching credentials, GCM, `includeIf`, OAuth/PAT auth, release signing, or anything that could leak a token always require a spec and an independent review, regardless of size.
- For a quick orientation, `docs/product.md` has the full scope, current status per phase, and open decisions. `docs/adr/` has the architectural decisions already made, with the reasoning — please don't reopen one without new information.
- For anything beyond a small fix, open an issue first to discuss the approach before writing code. It saves everyone a rewritten PR.

## Setup

See `docs/runbooks/arrancar-el-proyecto.md` for the full setup, including a required manual step for Electron that `pnpm install` alone won't do for you.

## Making a change

1. Trivial fix (typo, small text tweak, a single doc)? Go straight to a PR.
2. Anything else — new behavior, multiple files, a changed contract, or anything touching the high-risk areas listed above — write a spec first (see `docs/specs/README.md` for the structure: proposal → requirements → design → tasks).
3. Branch names: `type/short-effect-in-words`, lowercase, hyphens, no accents (e.g. `fix/includeif-realpath-windows`).
4. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, …) and explain *why*, not just *what*.

## Before opening a PR

Run, and make sure they're all green:

```
pnpm typecheck
pnpm lint
pnpm test
```

Windows is the only supported platform — tests that need real Git/GCM integration only run there (they skip automatically elsewhere).

## Pull requests

- Keep the summary readable for someone who hasn't seen the code: what problem it solves, what changes, what doesn't, how to test it, and any risks.
- If your change touches credentials/GCM/`includeIf`/OAuth/PAT/signing, say so explicitly — it'll need an independent review before merging, same as it would in a solo session.
- Squash merges are fine for a single logical change; keep separate commits if a PR bundles genuinely distinct units of work.

## Code style

- TypeScript strict mode; `core/**` never imports `electron` (enforced by ESLint, not just convention — see ADR 0001/0003).
- Comments and docs inside the codebase are written in Spanish, plain language (no jargon left unexplained), tuteo, never voseo. This README and the contributor-facing docs are the exception, kept bilingual.
- No speculative abstractions, no error handling for cases that can't happen, no dead code "just in case."

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. For a security issue, see `SECURITY.md` instead — please don't open a public issue for a vulnerability.
