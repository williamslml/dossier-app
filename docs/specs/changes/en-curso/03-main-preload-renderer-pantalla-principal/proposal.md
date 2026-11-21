# Proposal — Fase 3 (parte 1): scaffold `main`/`preload`/`renderer` + pantalla principal

## Por qué

`docs/product.md` §5, Fase 3: "Pantallas principal, vincular y ajustes, portadas del prototipo — cambias de cuenta desde la bandeja y un commit sale con la identidad correcta." `core` ya tiene todo el dominio (`accounts`, `rules`, `git-credential`, `gitconfig`, `providers/github`, `providers/gitlab`); falta el lado Electron que lo expone.

Es una fase grande (bandeja, ventana, 7 pantallas con sus diálogos, notificaciones — ver `docs/adr/0007-frontend.md`). Este change cubre solo la primera porción vertical y funcional: scaffold real + la pantalla principal + cambio de cuenta activa. El resto (diálogos de vinculación, Quick Clone, Ajustes, notificaciones) queda para changes siguientes de la misma fase, cada uno con su propia spec — no se mete todo en un solo change.

## Qué cambia

1. Scaffold real de `electron-vite` + Preact en el proyecto (no un descartable como `spike/electron-target/`, que ya se borró): `src/main/`, `src/preload/`, `src/renderer/` (convención de `electron-vite`, ADR 0001), target `node24.22`/`chrome156` (ADR 0002).
2. **Nuevo** `core/features/state/`: `state.json` con `activeId` (`docs/product.md` §3.5) — mismo patrón que `accounts`/`rules` (`conf`, directorio de prueba aislado).
3. **Nuevo** `src/preload/`: `contextBridge` con 2 handlers (`getState`, `selectAccount`) — subconjunto mínimo de la API completa de `docs/product.md` §3.4; el resto de handlers (`startGithubLink`, `cloneRepo`, etc.) se agregan en changes siguientes, junto a sus pantallas.
4. **Nuevo** `src/main/`: ventana sin marco 390×620 (`electron-menubar`), bandeja con menú contextual mínimo (Abrir/Salir — "Cuenta activa ▸" y el resto del menú se completan cuando existan más pantallas), handlers IPC validados con `zod`.
5. **Nuevo** `src/renderer/`: pantalla principal portada del prototipo congelado (`docs/adr/0007-frontend.md`, apéndice) — banner de cuenta activa, lista de cuentas, cambio de cuenta con un clic. Los botones "GitHub"/"GitLab"/"Clonar" quedan visibles pero deshabilitados (`title="Próximamente"`) hasta sus changes.
6. Configuración de marca (ADR 0005): módulo único `brand.ts` con los valores ya decididos (`displayName: Dossier`, etc.), consumido por `main` y por `electron-builder` más adelante.

## Qué NO cambia / queda fuera

- Diálogos de vinculación GitHub/GitLab, edición de etiqueta, Quick Clone, Carpetas fijadas, Ajustes — changes siguientes de la Fase 3.
- Notificaciones del sistema, icono de bandeja con 3 estados — depende de que exista algo real que notificar (vinculación, errores) de los changes siguientes.
- Empaquetado/firma (Fase 5).
- Seguridad de ventana avanzada más allá de lo ya decidido en ADR 0006 (`contextIsolation`, `nodeIntegration: false`, `sandbox`) — se aplica aquí, no se reabre.

## Criterio de éxito

- `pnpm dev` (nuevo script) levanta la app real: bandeja visible, ventana 390×620 sin marco, pantalla principal con las cuentas reales de `core/features/accounts` (vacío si no hay ninguna).
- Clic en una cuenta la marca activa (`core/features/state`) y el banner se actualiza.
- `core/features/state` con tests unitarios (mismo patrón que `accounts`/`rules`).
- `pnpm typecheck && pnpm lint && pnpm test` en verde, incluido el código de `src/`.
