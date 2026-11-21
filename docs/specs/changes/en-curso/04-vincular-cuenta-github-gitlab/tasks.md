# Tasks — Vincular cuenta

Señal de alto riesgo (OAuth/credenciales): revisión obligatoria en sesión separada antes de mergear (`CLAUDE.md`), a partir de esta spec + este `tasks.md` + el diff — no del historial de la sesión que implementó.

## 1. `core/features/link-account` (L1) — TDD

- [x] Decidir cómo viaja `host`: parámetro explícito de `saveLinkedAccount`/`linkGithubAccount`/`linkGitlabAccount`, no parte de `LinkedAccount` (ver design.md)
- [x] RED: `saveLinkedAccount` con GCM real (patrón de `git-credential.test.ts`) — caso éxito y caso `fill` no confirma
- [x] GREEN: implementar `saveLinkedAccount`, `linkGithubAccount`, `linkGitlabAccount`
- [x] Wire en `core/index.ts`

**Hallazgo real:** un test de `linkGithubAccount` que usaba el host real `github.com` (aunque con datos falsos) falló — GCM trata distinto a los hosts que reconoce nativamente. Se corrigió inyectando también un `gitCredential` falso en ese test (ver `docs/lessons/README.md`).

## 2. IPC (L2)

- [x] Canales nuevos en `src/shared/ipc-channels.ts`: `startGithubLink`, `linkGitlab`, `githubVerification` (evento), `openExternal`
- [x] Handlers en `main` con validación `zod`, usan `linkGithubAccount`/`linkGitlabAccount` de `core/index.ts`
- [x] `notify(...)` tras éxito (L2.4)
- [x] `openExternal` mínimo (preload + `shell.openExternal` en `main`) — se abre automático apenas aparece el código de GitHub, no solo a pedido

## 3. Preload (L5)

- [x] `startGithubLink`, `onGithubVerification`, `linkGitlab`, `openExternal` en `DossierApi`

## 4. Renderer (L3, L4)

- [x] `GithubLinkDialog.tsx`: formulario de etiqueta → código + enlace (se abre solo) → éxito/error
- [x] `GitlabLinkDialog.tsx`: etiqueta + host + token → éxito/error
- [x] `AddButtons.tsx`: sacar `disabled`/tooltip de los dos botones, abrir el diálogo correspondiente
- [x] `App.tsx`/store: refrescar la lista de cuentas al cerrar un diálogo con éxito (`applyState`)
- [x] Diálogos con los colores reales de marca (`#171717`), no el azul de acento

## 5. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde
- [x] `pnpm build` sin error
- [x] Verificación en vivo (con tu aprobación): vincular una cuenta de GitHub real (`hmalasquez08`) y una de GitLab real (`hmalasquez`) desde la app — las dos aparecen en la lista, con la notificación de Windows y el aviso dentro de la app mostrándose correctamente

**Hallazgo real, crítico #1:** `window.dossier` nunca se expuso correctamente desde que existe Fase 3 — el preload con `sandbox: true` no admite ES modules, y fallaba **en silencio total** (ni `electron-log` ni `did-fail-load` lo mostraban). Se encontró recién ahora, al verificar en vivo con CDP. Fix: build del preload forzado a CommonJS (`.cjs`), y se agregó el listener de `preload-error` para que esto nunca vuelva a pasar desapercibido. Detalle completo en `docs/lessons/README.md` y `docs/adr/0006-seguridad.md`.

**Hallazgo real, crítico #2:** resuelto el preload, `git credential fill` seguía fallando para GitHub real ("unable to get password from user"), aunque el token quedaba guardado de verdad. Se probaron dos hipótesis que no funcionaron (`credential.provider=generic`; sembrar con `git credential-manager github login --token`) antes de encontrar la causa real: el despachador genérico `git credential <acción>` no resuelve bien para `github.com`, haya lo que haya guardado — invocar el binario de GCM directo (`git credential-manager store/get/erase`) sí funciona, para cualquier host. `core/features/git-credential` ahora siempre usa ese camino. Detalle completo en `docs/lessons/README.md` y `docs/adr/0004-modelo-de-credenciales-e-identidad.md`.

## 6. Cierre del change

- [x] Los criterios (L1–L5) verificados y anotados acá
- [x] Lecciones anotadas en `docs/lessons/README.md` (preload CommonJS, despachador de git vs. binario de GCM directo, scope `api` de GitLab)
- [ ] Revisión en sesión separada (señal de alto riesgo) antes de mergear la rama
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
