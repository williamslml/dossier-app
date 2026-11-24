# Security Policy

## Supported versions

Dossier auto-updates from GitHub Releases, and only the latest published release is supported. If you can reproduce an issue, please update first — there's no backport policy for older versions.

## Reporting a vulnerability

Please **don't open a public issue** for a security vulnerability — that gives anyone an exploit before a fix ships.

Instead, use GitHub's private vulnerability reporting: go to the [Security tab](https://github.com/williamslml/dossier-app/security) of this repository and select **"Report a vulnerability"**. That opens a private advisory visible only to the maintainer, where you can describe the issue, its impact, and (if you have one) a proof of concept.

If that option isn't available for any reason, open a regular issue asking to be pointed to an alternate private contact — without any vulnerability details in the issue itself.

## What's in scope

Dossier only targets Windows and only touches:

- The local Git configuration (`~/.gitconfig` region it manages, and per-account profile files under `~/.dossier/`).
- Git Credential Manager / Windows Credential Manager, via the standard `git credential-manager` protocol — Dossier never implements its own credential storage.
- GitHub/GitLab APIs, over HTTPS, using tokens the user explicitly linked.

Reports involving any of these — a token or credential that could leak, `includeIf`/identity resolution that could apply the wrong account, or a way to make the app write outside its own managed files — are all in scope. Supply-chain concerns about a direct dependency are welcome too.

## What's out of scope

- Issues that require local admin/physical access to the machine Dossier runs on (same trust boundary as the OS itself).
- Social engineering against the maintainer or users.
- The unsigned installer triggering a Windows SmartScreen warning — that's expected and tracked separately (`docs/product.md`), not a vulnerability.

## Response

This is a solo-maintained project without an SLA, but security reports get priority over everything else in the backlog. You'll get an acknowledgement, and credit in the advisory/release notes if you'd like it, once a fix ships.
