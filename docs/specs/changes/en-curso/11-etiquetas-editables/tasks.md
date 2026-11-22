# Tasks — Etiquetas editables

Ver `design.md` para el detalle técnico. No toca señales de alto riesgo — no requiere revisión obligatoria en sesión separada, solo la verificación estándar.

## 1. `core` (E1) — TDD

- [ ] RED: test de `rename` en `accounts.test.ts` (actualiza label, no toca otros campos, lanza con id inexistente)
- [ ] GREEN: confirmar que pasa con la implementación ya existente (no debería hacer falta tocar `accounts.ts`)

## 2. IPC (E2)

- [ ] `renameAccount` en `src/shared/ipc-channels.ts`
- [ ] Handler + schema `zod` en `src/main/index.ts`, devuelve `getState()`
- [ ] Preload (`src/preload/index.ts`): `renameAccount` en `DossierApi`

## 3. Renderer (E3)

- [ ] `store.ts`: función `renameAccount`
- [ ] `AccountCard.tsx`: ícono `#icon-edit`, modo edición in situ (Enter/blur confirma, Escape cancela), toast de error si el IPC rechaza

## 4. Verificación

- [ ] `pnpm typecheck && pnpm lint && pnpm test` en verde
- [ ] `pnpm electron-vite build` + verificación en vivo: renombrar una cuenta real, confirmar que persiste tras reiniciar la app

## 5. Cierre del change

- [ ] Los criterios (E1–E3) verificados y anotados acá
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
