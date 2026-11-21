# Requirements — Fase 3 (parte 1)

## S1 — Estado de la cuenta activa (`core/features/state/`)

- **S1.1** `getActiveId()` devuelve el `activeId` persistido, o `undefined` si nunca se fijó ninguno.
- **S1.2** `setActiveId(id)` lo persiste.
- **S1.3** Mismo patrón que `accounts`/`rules`: `conf`, `cwd` de prueba aislado, nunca `~/.dossier` real en tests.

**Escenario verificable:** test unitario, sin red ni Electron — `setActiveId` + releer con una instancia nueva confirma persistencia real.

## S2 — Configuración de marca (`brand.ts`, ADR 0005)

- **S2.1** Un único módulo exporta `displayName`, `slug`, `appId`, `dataDir`, `gitConfigMarker`, `githubOAuthAppName` con los valores ya decididos en ADR 0005.
- **S2.2** Nada más en el proyecto repite estos literales — `main` y (más adelante) `electron-builder`/tests lo importan de acá.

## S3 — Preload (`contextBridge`)

- **S3.1** Expone exactamente `getState()`, `selectAccount(id)` y `hideWindow()` — subconjunto de `docs/product.md` §3.4; el resto se agrega cuando exista la pantalla que lo necesite. `hideWindow()` existe porque la ventana centrada (S4.1) necesita un botón de cerrar propio: oculta la ventana (vuelve a la bandeja), no cierra la app — "Salir" desde el menú de la bandeja sigue siendo lo que cierra de verdad.
- **S3.2** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (ADR 0006) — no se relajan para "simplificar" el desarrollo.
- **S3.3** Cada handler del lado `main` valida el payload de entrada con `zod` antes de tocar `core` (ADR 0006: "Validar origen del mensaje y esquema en cada handler").

## S4 — Main process

- **S4.1** Ventana 390×620, sin marco, instancia única, se oculta al perder foco — gestionada por `electron-menubar` (ADR 0003/0007). **Posición: centrada en pantalla**, decisión explícita del usuario (no el default `trayBottomCenter` en Windows, que aparece anclado a la bandeja como un toast y se confunde con una notificación del sistema). La librería sobrescribe `windowPosition` con su propio anclaje a la bandeja en win32/linux pase lo que pase (`docs/lessons/README.md`) — se fuerza `window.center()` en `after-show` para ganarle a esa sobrescritura.
- **S4.2** Bandeja visible con menú contextual: **Abrir**, **Salir** (el resto del menú de `docs/adr/0007-frontend.md` se completa en changes siguientes, cuando existan Quick Clone/Ajustes/cambio de cuenta desde el menú).
- **S4.3** `main` importa `core` **solo** desde `core/index.ts` (ADR 0001) — nunca de una ruta interna de una feature.
- **S4.4** Fuses de producción (ADR 0006) quedan configurados en `electron-builder.yml`/equivalente aunque todavía no haya empaquetado real (Fase 5) — se deja el archivo de config con los valores correctos, verificable aunque no se ejecute el build de instalador todavía.
- **S4.5** Ícono de marca final (no placeholder), generado con `scripts/generate-icons.ts` (`sharp` + `png-to-ico`, dependencias de desarrollo): mismo glifo `git-branch` que usa el título de la ventana, en los colores reales de la marca dentro de la app (fondo `#171717`, glifo blanco — no el azul de acento, que solo indica "cuenta activa"). Se usa en la bandeja (`resources/tray-icon.png`), en la ventana/taskbar (`resources/app-icon.png`) y en el instalador (`resources/app-icon.ico`, `electron-builder.yml` → `win.icon`).

## S6 — Notificaciones del sistema (ADR 0007)

- **S6.1** Módulo `src/main/notify.ts` completo según ADR 0007: `Notification` nativa (nunca `electron-windows-notifications`), `groupId`/`groupTitle` de marca, `urgency: 'critical'` + `timeoutType: 'never'` para avisos importantes.
- **S6.2** Clic en el aviso manejado con `Notification.handleActivation()` (registrado una sola vez, global), no con un listener por instancia — es el mecanismo que funciona incluso con arranque en frío (ADR 0007).
- **S6.3** Sin un evento real todavía disponible en este change (vincular cuenta/clonar siguen deshabilitados, S5.5), se deja una entrada de menú "Probar notificación" para verificar el módulo a mano, y se conecta a un caso real que sí existe: `did-fail-load` del renderer dispara un aviso importante.
- **S6.4** Fuera de alcance: preferencia "no molestar" (requiere Ajustes, explícitamente diferido) y la verificación con un NSIS instalado de verdad (decisión abierta, `docs/product.md` §7.4) — en modo sin empaquetar, Windows puede no mostrar el toast aunque el código esté bien.

## S5 — Renderer: pantalla principal

- **S5.1** Visualmente igual al prototipo congelado (`docs/adr/0007-frontend.md`, apéndice): mismo CSS, misma ventana 390×620. **Excepción deliberada:** el texto del pie agrega "y más" a la lista de editores/terminales (VS Code · Zed · Cursor · Warp · Claude), para no dar a entender que Dossier solo funciona con esos — funciona con cualquiera que use Git, la lista es solo una muestra.
- **S5.2** `innerHTML` sin escapar, `onclick` inline y `prompt()`/`alert()` del prototipo — **no se portan**: componentes Preact + manejadores de eventos (ADR 0007, "Cambios obligatorios al portar el prototipo").
- **S5.3** Estado vacío (sin cuentas) se admite — a diferencia del prototipo original, que no permitía borrar la última cuenta (ADR 0007).
- **S5.4** Clic en una cuenta → `selectAccount(id)` vía preload → `core/features/state` → el banner se re-renderiza con la cuenta activa.
- **S5.5** Botones "GitHub"/"GitLab"/"Clonar repositorio" visibles pero deshabilitados, con tooltip explicando que llegan en un change posterior — no se ocultan (el layout del prototipo los espera ahí) ni se implementan a medias.

## Fuera de alcance de este change

Diálogos de vinculación/clonado/etiqueta, Carpetas fijadas, Ajustes, notificaciones, icono de bandeja con estados — ver `proposal.md` §"Qué NO cambia".
