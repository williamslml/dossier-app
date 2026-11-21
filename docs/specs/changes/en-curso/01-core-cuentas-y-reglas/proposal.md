# Proposal — Fase 1: módulo `core` (cuentas, reglas, protocolo de credenciales)

## Por qué

docs/product.md §12, Fase 1: "Módulo `core` con tests: los tests pasan sin Electron y la integración usa git real en carpetas temporales." El spike (change `00-spike-base-y-gcm`) ya validó los dos mecanismos críticos (`git credential` y `includeIf`) en `spike/`, explícitamente marcado como temporal. Ahora toca formalizarlos como el módulo real `core` — Node puro, sin `electron` — con el dominio real encima (cuentas, reglas de carpeta) para que `main` (Fase 3) tenga algo que orquestar.

## Qué cambia

1. Migrar `spike/git-credential.ts` → `core/features/git-credential/` (ya validado, sin rediseño).
2. Migrar `spike/includeif.ts` → `core/features/gitconfig/` (ya validado; se renombra porque docs/product.md §4.4 llama a esto "gitconfig": `active.gitconfig` + `profiles/<id>.gitconfig`).
3. **Nuevo** `core/features/accounts/`: modelo de cuentas (`accounts.json` vía `conf`, docs/product.md §4.2) — crear, listar, renombrar, eliminar. Sin secretos en este archivo (los tokens viven solo en GCM).
4. **Nuevo** `core/features/rules/`: modelo de reglas de carpeta (`rules.json` vía `conf`) — fijar/desfijar carpeta↔cuenta, con la regla de exclusividad del docs/product.md §4.3.3 ("una carpeta solo puede pertenecer a una cuenta; al fijar una carpeta dentro de otra se rechaza el cambio").
5. Organización interna **feature-first** (ADR 0001): cada feature con su punto de entrada público; nada de `services/`/`models/` como carpetas de primer nivel.

## Qué NO cambia / queda fuera

- Nada de `main`, `preload` ni `renderer` real (eso es Fase 3; `spike/electron-target/` ya probó que el target compila, pero no se integra todavía).
- Proveedores OAuth (GitHub Device Flow, GitLab PAT) — Fase 2. `core/features/accounts/` modela la cuenta ya vinculada, no el flujo de vinculación.
- `state.json`/`settings.json` — no hay todavía nada que dependa de ellos (activeId, ajustes); se agregan cuando los necesite un consumidor real.
- Quick Clone, Doctor — fases posteriores.

## Criterio de éxito (docs/product.md §12, Fase 1 — literal)

> Los tests pasan sin Electron y la integración usa git real en carpetas temporales.

Además, específico de este change: `accounts`/`rules` tienen tests unitarios (sin tocar disco real del usuario — `conf` apunta a un directorio temporal en tests) y la regla de exclusividad de carpetas está probada con casos de solapamiento.
