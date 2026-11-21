# Arrancar el proyecto en una máquina nueva

## Cuándo usar esto

Primera vez que se clona el repositorio en una máquina (propia o de otra persona), o después de borrar `node_modules/` y reinstalar.

## Prerrequisitos

- Windows (único sistema soportado, `docs/product.md` §1).
- Node ≥ 24.22 (`package.json` → `engines.node`; ADR 0002 fija el target de build en `node24.22`).
- pnpm (versión exacta en `package.json` → `packageManager`).
- Git for Windows instalado, con Git Credential Manager (GCM) — ya viene incluido desde hace varias versiones.

## Pasos

1. `pnpm install`
2. **Paso manual obligatorio:** `pnpm install` no descarga el binario de Electron (su script de postinstall queda silenciosamente excluido por pnpm, sin aparecer siquiera en "Ignored build scripts"). Ejecutar a mano:
   ```
   node node_modules/electron/install.js
   ```
3. Para desarrollar con recarga en caliente: `pnpm dev` (`electron-vite dev`).
4. Para correr la app ya compilada: `pnpm build` y después `pnpm start` (equivalente a `electron .`).

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde (comandos de `CLAUDE.md` → "Verificación").
- La app levanta: aparece el ícono en la bandeja de Windows y, al hacer clic, se abre la ventana centrada con la pantalla principal.
- Para confirmar el arranque sin intervención manual (por ejemplo, en una sesión de agente sin pantalla interactiva): variables de entorno `DOSSIER_SHOW_ON_START=1` (muestra la ventana al iniciar) o `DOSSIER_AUTO_QUIT=1` (la muestra y cierra la app a los 2 segundos, para verificación headless).

## Si algo falla

- **La app no abre o tira un error sobre el binario de Electron:** repetir el paso 2 (`node node_modules/electron/install.js`) — es el olvido más común después de un `pnpm install` fresco.
- **`pnpm build` falla por versión de Electron/Chrome:** revisar que el target en `electron.vite.config.ts` siga siendo `node24.22`/`chrome156` (ADR 0002) y que la versión instalada de `electron` sea la del catálogo (ADR 0003).
- **La notificación de prueba (menú de la bandeja → "Probar notificación") no aparece:** puede ser normal en modo sin empaquetar — Windows exige un acceso directo de Menú Inicio con `AppUserModelID`/`ToastActivatorCLSID`, que solo lo crea un instalador NSIS real (decisión abierta, `docs/product.md` §7.4). No es necesariamente un error.
