# 0003. Stack fundacional: Electron sin backend, TypeScript único, catálogo de librerías

## Status

Aceptado

## Context

Producto nuevo (`docs/product.md`), restricción maestra $0 y 100% open source, solo Windows. Hacía falta elegir runtime de escritorio, lenguaje, forma de manejar credenciales y qué librerías reutilizar vs. escribir a mano, sin servidor ni base de datos propia (la app maneja tokens de autenticación; cada pieza nueva es superficie de ataque).

## Decision

| Tema                  | Decisión                                    | Motivo                                                                                                                                                                                         |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime de escritorio | **Electron 45** (Node 24.22, Chromium 156)  | Reutiliza el prototipo HTML; `core` es Node/TypeScript puro; ecosistema maduro de bandeja, notificaciones y updater. Tauri 2 exigiría reescribir `core` en Rust, anulando su ventaja de tamaño |
| Backend               | **Sin servidor.** Main + `core` + IPC + GCM | Costo $0, un solo lenguaje y sin puertos abiertos en una app que maneja tokens                                                                                                                 |
| Lenguaje              | **TypeScript estricto**                     | Un solo lenguaje para UI, IPC, reglas, configuración y orquestación de Git                                                                                                                     |
| Gestor de paquetes    | `pnpm` 12.21.0                              | Lockfile v9 por defecto (no v13, experimental)                                                                                                                                                 |
| Calidad               | ESLint + Prettier, TypeScript 6.0.3         | TS 7.0 es estable pero no expone API para `typescript-eslint`; se mantiene una sola toolchain con TS 6 hasta que exista soporte real en 7.1                                                    |
| Auto-update           | `electron-updater` 6.x + GitHub Releases    | $0, sin backend propio. Único tráfico además de OAuth y del propio `git`: consulta y descarga el instalador desde Releases                                                                     |
| Hoja de ruta Tauri    | **Fuera del alcance**                       | Migrar obligaría a reescribir el núcleo en Rust; solo el frontend se reutilizaría                                                                                                              |

`core` es **Node puro, sin imports de `electron`** (verificado con una regla de ESLint, no solo por convención — ver `core/features/*`). Main y tests usan exactamente el mismo código de reglas, perfiles, generación de config y orquestación de `git credential`. No hay tercer proceso propio que mantener.

### Catálogo de librerías y soluciones reutilizadas

| Necesidad                       | Solución                                                | Licencia       | Notas                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bóveda y helper de credenciales | **Git Credential Manager**, incluido en Git for Windows | MIT            | Usa Windows Credential Manager. No hay dependencia que empaquetar ni helper propio                                                                      |
| Protocolo de credenciales       | `git credential fill/approve/reject`                    | Git (GPL-2.0)  | Invocado desde `core` vía `child_process` (ver ADR 0004)                                                                                                |
| Device Flow GitHub              | `@octokit/auth-oauth-device` 8.0.5                      | MIT            | Sin client secret. Fase 2                                                                                                                               |
| Ejecutar git y configuración    | `simple-git` 3.36.0 + `child_process` para stdin        | MIT            | `simple-git` para `includeIf`/config/clone; `child_process` para el protocolo de credenciales (línea a línea, no algo que `simple-git` envuelva)        |
| Config / JSON                   | `conf` 16.0.0                                           | MIT            | Escritura atómica. Compartido por `main` y `core` — ya en uso en `core/features/accounts` y `core/features/rules`                                       |
| Bandeja y ventana               | `electron-menubar` v11.1.3                              | BSD-2          | Fork mantenido por Gitify (peer `electron >=44.9.1`, cero dependencias runtime); no usar `menubar` 9.5.3 (no declara soporte para Electron ≥43). Fase 3 |
| Logs                            | `electron-log`                                          | MIT            | Entradas separadas para main, renderer y `core`. Fase 3                                                                                                 |
| Validación IPC                  | `zod` 4.6.7                                             | MIT            | Contrato renderer↔main, cero dependencias. Fase 3                                                                                                       |
| UI                              | `preact`                                                | MIT            | Fase 3, ver ADR 0007                                                                                                                                    |
| Build                           | `electron-vite` 6.0.0 + `@preact/preset-vite` 2.10.6    | MIT            | Target `node24.22`/`chrome156` fijado a mano — ver ADR 0002                                                                                             |
| Empaquetado                     | `electron-builder` 26.18.0                              | MIT            | Instalador NSIS para Windows + `electronFuses` (ADR 0006); no usar la rama 27 (alpha). Fase 5                                                           |
| Tests                           | `vitest` + `@playwright/test` 1.65                      | MIT/Apache-2.0 | Unitario del resolver de config/IPC y E2E de UI/bandeja — ver ADR 0008                                                                                  |

**Sin librería (nativo de Git/Electron/Node):** `includeIf`, `credential.<URL>.username`, `useHttpPath`, generación de `.gitconfig` con `git config --file`, bandeja (`Tray`, vía `electron-menubar`), notificaciones (`Notification`, con `app.setAppUserModelId()`), arranque con el sistema (`app.setLoginItemSettings`), selector de carpeta (`dialog.showOpenDialog`), rutas (`path`, `os`), fuses (`@electron/fuses`).

## Alternatives

**Soluciones existentes revisadas:**

| Proyecto                                                                      | Hallazgo                                                                                                                                                                           | Decisión                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`khasky/git-account-manager`](https://github.com/khasky/git-account-manager) | MIT, Rust + GPUI, perfiles, `includeIf` por carpeta, `credential.<host>.username`, guardia de commits, Doctor, tray, updater. SSH-first: reescribe `~/.ssh/config` y genera llaves | No hacer fork: tecnología y UI distintas, y SSH queda fuera del alcance. Sí adoptar sus patrones de región delimitada en `.gitconfig`, propiedad única de carpeta y Doctor |
| [`@gamcli/gam`](https://www.npmjs.com/package/@gamcli/gam)                    | CLI MIT 0.1.1, Node ≥18, Device Flow con client ID integrado, keychain, helper, aliases, `doctor`                                                                                  | Referencia de arquitectura, no dependencia: usa `keytar` (archivado), solo GitHub y un client ID de tercero                                                                |
| [`git-profile-switch`](https://www.npmjs.com/package/git-profile-switch)      | CLI 0.1.1 que configura `includeIf` con backup y verificación                                                                                                                      | Referencia; no resuelve UI, tokens ni multiplataforma                                                                                                                      |
| GCM + documentación de `multiple-users`                                       | Cubre credenciales por host/usuario y evita prompts                                                                                                                                | Adoptado directamente como capa de credenciales — ver ADR 0004                                                                                                             |

**Descartadas:** `keytar` (archivado) · `@napi-rs/keyring` en la app (addon `.node`, `asarUnpack` y `ELECTRON_RUN_AS_NODE`) · Rust o C# para helper propio · `safeStorage` para credenciales Git · `menubar` 9.5.3 · `electron-windows-notifications`/`electron-windows-interactive-notifications` (obsoletos, requieren addons nativos) · `pkg` · Electron Forge (publish/update/signing requiere electron-builder de todos modos) · Hono (es un framework HTTP; aquí no hay HTTP) · Redux · `electron-store` · Tauri 2 (reescritura Rust del núcleo) · Node SEA · MCP/`@modelcontextprotocol/sdk` (no deseado: la app no expone integraciones para agentes IA).

## Consequences

- **Lo propio del producto** (no reutilizado de ninguna librería): el modelo de cuentas y reglas, el generador de `includeIf`, la orquestación verificable de `git credential`, el flujo de Quick Clone, la UI del prototipo y el Doctor de configuración.
- Cambiar de runtime (p. ej. a Tauri) exigiría reescribir `core` por completo — se acepta ese costo como decisión deliberada, no accidental.
- Cualquier librería nueva fuera de este catálogo necesita su propio ADR o, si es menor, una nota en el ADR correspondiente al área que toca.

## References

- `docs/product.md` (visión, alcance, fases)
- `core/` (implementación de `core`, Fase 1)
- ADR 0002 (target de `electron-vite`), ADR 0004 (credenciales), ADR 0006 (seguridad), ADR 0007 (frontend), ADR 0008 (testing/CI)
