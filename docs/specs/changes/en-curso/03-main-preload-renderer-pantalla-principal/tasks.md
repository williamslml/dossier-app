# Tasks — Fase 3 (parte 1)

Sin señales de alto riesgo nuevas (no toca credenciales/OAuth; reutiliza lo ya construido). El arranque real de la app no necesita aprobación especial — no es una operación destructiva ni de credenciales.

## 1. `core/features/state` (S1) — TDD

- [x] RED: test de `setActiveId`/`getActiveId` + persistencia real
- [x] GREEN: implementar `state.ts`
- [x] Wire en `core/index.ts`

## 2. Marca (S2)

- [x] `core/features/brand/brand.ts` con los 6 valores de ADR 0005
- [x] Wire en `core/index.ts`

## 3. Scaffold real `electron-vite` (dependencias + config)

- [x] Dependencias nuevas del catálogo (ADR 0003): `electron`, `electron-vite`, `@preact/preset-vite`, `preact`, `nanostores`, `@nanostores/preact`, `lucide-preact`, `@fontsource/geist-sans`, `electron-menubar`, `electron-log`, `zod`
- [x] `electron.vite.config.ts` con target fijado (ADR 0002)
- [x] `tsconfig` ajustado para `src/` (jsx preact) sin romper el de `core/`

**Hallazgo real:** `electron`/`electron-vite`/`@preact/preset-vite` van en `devDependencies` (solo build-time), no en `dependencies`.

## 4. `src/shared/ipc-channels.ts` + `src/preload/index.ts` (S3)

- [x] Canales IPC como constantes
- [x] `contextBridge.exposeInMainWorld` con `getState`/`selectAccount`, `contextIsolation`/`sandbox` activos (ADR 0006)

**Hallazgo real:** el renderer no debe importar `core` ni siquiera como `import type` — todo tipo que necesite (`Account`) se reexporta desde `preload/index.ts`. Importar `brand` (valor real) desde `core/index.ts` en un componente arrastró todo el grafo de `core` (`simple-git`, `conf`, `fs`) al bundle del renderer (156KB/222 módulos → 29.8KB/30 al sacarlo). Detalle en `docs/lessons/README.md`.

## 5. `src/main/index.ts` (S4)

- [x] Ventana vía `electron-menubar`, 390×620, sin marco, **centrada en pantalla** (S4.1, decisión explícita del usuario — no el anclaje a bandeja por defecto)
- [x] Bandeja con menú mínimo (Abrir/Salir/Probar notificación)
- [x] Handlers IPC con validación `zod`, usan `core/index.ts` (nunca rutas internas)
- [x] `electron-builder.yml` mínimo con los fuses de ADR 0006 (sin build de instalador todavía)
- [x] Ícono de marca final en bandeja/ventana/instalador (S4.5)

**Hallazgos reales** (los tres primeros al conectar `electron-menubar`, detalle en `docs/lessons/README.md`):

- Sin `icon` explícito, `electron-menubar` cae a un `__dirname` interno que no existe en ESM → `ReferenceError`.
- `new URL(...).pathname` en Windows da `/C:/...` inválido para una ruta de archivo real — usar `fileURLToPath()`.
- `after-create-window` ya ocurre con la URL cargada; hay que enganchar `did-finish-load`/`did-fail-load` en `before-load`.
- `windowPosition: 'center'` de la librería **no alcanza**: en win32/linux `applyWindowPosition()` la sobrescribe siempre con el anclaje a la bandeja — hubo que forzar `mb.window.center()` en `after-show`.
- El ícono final (`scripts/generate-icons.ts`, `sharp` + `png-to-ico`, dependencias de desarrollo) usa el mismo glifo `git-branch` del título, en el color real de marca dentro de la app (`#171717`), no el azul de acento (ese solo marca "cuenta activa").

## 5b. Botón de cerrar (S3.1, S4.1)

- [x] `IPC.hideWindow` + `preload.hideWindow()` + handler en `main` (`mb.hideWindow()`, no `app.quit()`)
- [x] Botón ✕ en `TitleBar.tsx` (nuevo ícono `#icon-x` en `index.html`)

**Por qué:** al centrar la ventana (decisión del usuario, ya no anclada a la bandeja) dejó de sentirse como un menu-bar app transitorio y necesitaba una forma explícita de cerrarla sin ir al menú de la bandeja.

## 6. Renderer (S5)

- [x] `index.html` con el CSS exacto del apéndice de ADR 0007
- [x] Componentes: `TitleBar`, `ActiveBanner`, `AccountCard`, `AddButtons`, `StatusToast`, `Footer`
- [x] `store.ts` (nanostores) + `App.tsx` que los compone
- [x] Estado vacío (sin cuentas) soportado
- [x] Botones GitHub/GitLab/Clonar deshabilitados con tooltip

**Excepción deliberada (S5.1):** el pie agrega "y más" a la lista de editores/terminales para no implicar que Dossier solo funciona con esos — funciona con cualquiera que use Git.

## 6b. Notificaciones del sistema (S6)

- [x] `src/main/notify.ts`: `Notification` nativa, `groupId`/`groupTitle` de marca, crítico vs. normal
- [x] `Notification.handleActivation()` registrado una sola vez (funciona incluso con arranque en frío)
- [x] Entrada de menú "Probar notificación" (sin evento real disponible todavía en este change)
- [x] `did-fail-load` del renderer dispara un aviso importante (el único evento real ya existente)

**Pendiente, fuera de alcance:** conectar vinculación/clonado reales (requiere las pantallas de OAuth/PAT — señal de alto riesgo, spec propia); preferencia "no molestar" (requiere Ajustes); verificar con NSIS instalado de verdad (decisión abierta, `docs/product.md` §7.4).

## 7. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (incluye `src/`) — 8 archivos, 34 tests
- [x] `pnpm build` sin error
- [x] Arranque headless con auto-quit, confirmar sin excepciones (igual que el spike R6)
- [x] Verificación manual: arrancar de verdad (`DOSSIER_SHOW_ON_START=1`), confirmar visualmente ventana centrada, ícono de marca en bandeja/taskbar y pie de página — hecho por el agente con captura de pantalla real, confirmado por el usuario

## 8. Cierre del change

- [x] Los criterios (S1–S6) verificados y anotados acá
- [x] Lecciones nuevas anotadas en `docs/lessons/README.md`
- [ ] Mover a `../archivados/` — pendiente de tu confirmación
