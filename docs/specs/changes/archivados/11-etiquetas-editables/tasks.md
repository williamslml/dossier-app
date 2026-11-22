# Tasks — Etiquetas editables

Ver `design.md` para el detalle técnico. No toca señales de alto riesgo — no requiere revisión obligatoria en sesión separada, solo la verificación estándar.

## 1. `core` (E1)

- [x] Ya existía: `accounts.test.ts` ya tenía "renombra la etiqueta sin tocar el resto (M2.3)" y "renombrar un id inexistente lanza" (mi grep inicial al escribir el proposal no los encontró por el patrón de búsqueda, no por ausencia real) — cubren E1.1, E1.2, E1.3

## 2. IPC (E2)

- [x] `renameAccount` en `src/shared/ipc-channels.ts`
- [x] Handler + schema `zod` en `src/main/index.ts`, devuelve `getState()`
- [x] Preload (`src/preload/index.ts`): `renameAccount` en `DossierApi`

## 3. Renderer (E3)

- [x] `store.ts`: función `renameAccount`
- [x] `AccountCard.tsx`: ícono `#icon-edit`, modo edición in situ (Enter/blur confirma, Escape cancela), toast de error si el IPC rechaza

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (17 archivos, 112 tests)
- [x] `pnpm electron-vite build` + verificación en vivo, automatizada con Playwright (`_electron`) contra la app real: clic en el ícono de editar de la cuenta real de GitHub → renombrar a un valor temporal → Enter → confirmado en el `DossierState` devuelto → cerrar y reabrir la app (proceso nuevo) → el valor temporal persistió → revertido al valor original por el mismo camino (UI real, no editando `accounts.json` a mano) → confirmado persistido en una tercera apertura. Capturas de pantalla confirmaron visualmente el cambio (ícono de editar, input in situ, avatar con iniciales actualizadas). Estado final de `accounts.json` idéntico al original, sin procesos de Electron de prueba sueltos al terminar. **Hallazgo real:** `electron-menubar` crea la ventana de forma perezosa — hace falta la variable `DOSSIER_SHOW_ON_START` (ya existía en `main/index.ts`, pensada justo para esto) para que una automatización externa la vea

## 5. Cierre del change

- [x] Los criterios (E1–E3) verificados y anotados acá
- [x] Merge con `finishing-a-development-branch` — mergeado localmente a `main` (fast-forward, sin conflictos), `pnpm typecheck && pnpm lint && pnpm test` en verde sobre el resultado (112 tests), rama `feat/etiquetas-editables` borrada
- [x] Mover la spec a `../archivados/`
