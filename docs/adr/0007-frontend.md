# 0007. Frontend: stack, portado del prototipo, ventana y notificaciones

## Status

Aceptado e implementado (Fase 3). Dos piezas del catálogo original no se llegaron a usar en la implementación real — ver nota al final de "Stack".

## Context

Existía `prototipo.html` (eliminado; su código fuente completo queda congelado en el Apéndice de este ADR): una UI de referencia **visual y de UX**, no de arquitectura (usaba `innerHTML`, `onclick` inline, `prompt()`/`alert()` — inseguro en una app real). Hubo que decidir el stack de UI y qué cambia obligatoriamente al portarla, sin rediseñarla.

## Decision

### Principio

Visualmente **muy parecido al prototipo**: mismo CSS (colores, radios, tipografía, tamaño 390×620) y mismos textos. Solo se cambia lo necesario por seguridad y por plataforma.

### Stack

| Pieza     | Herramienta                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | Preact                                                                                                                                                         |
| Build     | `electron-vite` 6.0.0 + `@preact/preset-vite` 2.10.6 (target fijado, ADR 0002). No hay plantilla oficial de Preact: partir de `vanilla-ts` y agregar el preset |
| Iconos    | `lucide-preact` (ISC). Los logos de GitHub y GitLab se conservan como SVG del prototipo                                                                        |
| Fuente    | Geist vía `@fontsource/geist-sans` (OFL). El prototipo la declara pero nunca la carga                                                                          |
| Estado    | `nanostores` 1.5.5 + `@nanostores/preact` 1.1.1. Sin Redux (descartado, ADR 0003)                                                                              |
| CSS       | El del prototipo. Sin Tailwind ni librerías de componentes                                                                                                     |

**Nota (limpieza post-implementación):** al portar los íconos del prototipo se copiaron directo como `<symbol>` SVG inline en `index.html` (mismo glifo visual, sin depender de componentes de una librería en tiempo de ejecución), y la fuente terminó siendo un *stack* de CSS con "Geist" como preferencia y una fuente del sistema como respaldo, sin cargar nunca el archivo real. `lucide-preact` y `@fontsource/geist-sans` quedaron instalados sin ningún `import` real en el código — se sacaron de `package.json` en una limpieza de dependencias sin usar.

### Componentes (prototipo → Preact)

| Prototipo                     | Componente                                                              |
| ----------------------------- | ----------------------------------------------------------------------- |
| `.title-bar`                  | `TitleBar`                                                              |
| `.active-banner`              | `ActiveBanner`                                                          |
| `.account-card`               | `AccountCard`                                                           |
| `.add-buttons`                | `AddButtons`                                                            |
| `.toast-box`                  | `StatusToast`                                                           |
| `.app-footer`                 | `Footer`                                                                |
| `.dialog-overlay` y variantes | `Dialog` + `GithubDialog`, `GitlabDialog`, `LabelDialog`, `CloneDialog` |

Organización interna: feature-first por pantalla (`src/renderer/features/<pantalla>/`, ADR 0001), no un árbol plano de componentes.

### Pantallas y estados

| Pantalla                                                          | Estados a cubrir                              |
| ----------------------------------------------------------------- | --------------------------------------------- |
| Principal (banner, cuentas, botones)                              | vacío (primera vez), cargando, error          |
| Vincular GitHub (código de dispositivo, copiar, cuenta regresiva) | esperando, expirado, denegado, éxito          |
| Vincular GitLab (host + token)                                    | validando, token inválido                     |
| Etiqueta (edición en línea)                                       | —                                             |
| Quick Clone (URL, cuenta, carpeta, nota de Auto-Pin)              | clonando con progreso, error de autenticación |
| Carpetas fijadas                                                  | vacío                                         |
| Ajustes (GCM, inicio con el sistema, versión)                     | GCM no detectado                              |

### Cambios obligatorios al portar el prototipo

| Problema en el prototipo                       | Solución                                                       |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `innerHTML` con usuario y etiqueta sin escapar | Componentes Preact (escapan por defecto)                       |
| `onclick` inline                               | Manejadores de eventos (compatible con CSP estricta, ADR 0006) |
| `prompt()` y `alert()`                         | Edición en línea y diálogos propios con el mismo estilo        |
| No se puede borrar la última cuenta            | Permitir cero cuentas con estado vacío                         |
| Fondo punteado y sombra de la ventana          | Solo del preview; la ventana real no tiene marco               |

### Elementos nuevos (mismo lenguaje visual)

- Diálogo del código de dispositivo de GitHub.
- Aviso con el estilo de `.toast-box` cuando GCM no esté disponible o no persista el token.
- Acceso discreto a «Carpetas fijadas» y a Ajustes.

### Ventana

Sin marco, anclada a la bandeja, se oculta al perder el foco, 390×620, instancia única. La gestiona **`electron-menubar` v11** (posicionamiento con detección de la barra de tareas y del panel de iconos ocultos en Windows). El acceso a bandeja queda aislado en un adaptador propio para poder sustituirlo sin tocar el resto de la app (mitigación del riesgo "sin mantenimiento", `docs/product.md` §6).

### Icono de bandeja y avisos

**Icono.** Siempre visible en el área de notificación de Windows (aunque la ventana esté cerrada). Tres estados visuales:

| Estado                                   | Icono/tooltip                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Normal                                   | Icono de Git con acento de la cuenta activa; tooltip `<displayName> · <usuario> [<etiqueta>]` |
| Sin cuenta activa / GCM no disponible    | Icono con distintivo de aviso; tooltip explica la acción correctora                           |
| Fallo en operación iniciada desde la app | Icono en estado de alerta hasta el próximo éxito                                              |

Menú contextual (clic derecho): **Abrir**, **Cuenta activa ▸** (submenu con las cuentas para cambiar con un clic), **Clonar repositorio…**, **Estado de credenciales**, **Salir**. Clic izquierdo alterna la ventana.

**Notificaciones del sistema.** `Notification` de Electron en el proceso main:

```ts
app.setAppUserModelId(brand.appId) // coincide con appId de electron-builder
new Notification({ title, body, icon, groupId: brand.slug, groupTitle: brand.displayName }).show()
```

Eventos que avisan: vinculación completada, cambio de cuenta (solo tooltip, sin toast), fallo de autenticación en una operación iniciada desde la app, GCM no disponible o no persistió el token, clonado terminado, actualización descargada y lista para reiniciar. Los `push` externos no generan avisos: la app no observa su resultado.

**Reglas:**

- Avisos importantes: `urgency: 'critical'` + `timeoutType: 'never'` para que permanezcan en el Centro de notificaciones; el resto con duración por defecto.
- Clic en el aviso: `Notification.handleActivation()` → muestra/enfoca la ventana (incluso con arranque en frío).
- **No usar** `electron-windows-notifications` ni `electron-windows-interactive-notifications` (ADR 0003: obsoletos, requieren addons nativos). `toastXml` solo si se necesita una plantilla personalizada; escapar siempre los valores dinámicos del XML.
- Requisito de Windows: el instalador NSIS debe crear el acceso directo en el menú Inicio con el `AppUserModelID` y el `ToastActivatorCLSID`; sin eso, Windows descarta los avisos silenciosamente. Verificar con un NSIS instalado de verdad, no en `electron-vite dev` (decisión abierta, `docs/product.md` §7.4).
- Preferencia del usuario: "no molestar" desactiva los toasts informativos pero **no** los de error de credenciales.

## Alternatives

Ver ADR 0003 (Redux, Tailwind/librerías de componentes no evaluadas porque el prototipo ya fija el CSS).

## Consequences

- El pie de la ventana lista editores/terminales compatibles (VS Code, Zed, Cursor, Warp, Claude) como texto informativo — contenido del prototipo, se conserva igual.
- Cuando se construya esto (Fase 3), el `main` real importa `core` solo desde `core/index.ts` (ADR 0001).

## References

- Apéndice de este ADR (código fuente congelado del prototipo original)
- ADR 0001 (perfil de estructura, feature-first), ADR 0002 (target de build), ADR 0006 (seguridad de ventana/IPC)

## Apéndice: código fuente congelado de `prototipo.html` (eliminado del repo)

Este es el archivo original, íntegro, tal como existía antes de borrarse. **No es código vivo** (no se mantiene, no pasa por lint/tests): es la referencia exacta para portar la UI en la Fase 3, según el principio y los cambios obligatorios ya decididos arriba. Cuando se construya `src/renderer/`, este bloque deja de ser necesario y puede quitarse de este ADR (no de la decisión en sí).

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dossier</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    body {
      background-color: #fafafa;
      background-image: radial-gradient(#e5e5e5 1px, transparent 1px);
      background-size: 20px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }

    svg {
      display: inline-block;
      vertical-align: middle;
      flex-shrink: 0;
    }

    /* Ventana compacta estilo Geist / Vercel Light */
    .app-window {
      width: 390px;
      height: 620px;
      background-color: #ffffff;
      color: #171717;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
      border: 1px solid #eaeaea;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.03);
      position: relative;
    }

    /* Barra superior */
    .title-bar {
      height: 44px;
      background-color: #fafafa;
      border-bottom: 1px solid #eaeaea;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      -webkit-app-region: drag;
    }
    .title-bar-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      font-weight: 600;
      color: #171717;
      letter-spacing: -0.01em;
    }
    .title-bar-right {
      display: flex;
      align-items: center;
      gap: 6px;
      -webkit-app-region: no-drag;
    }
    .btn-header-clone {
      font-size: 11px;
      background-color: #ffffff;
      color: #171717;
      border: 1px solid #e5e5e5;
      padding: 3px 9px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-header-clone:hover {
      background-color: #f4f4f5;
      border-color: #171717;
    }
    .vault-badge {
      font-size: 10.5px;
      background-color: #ffffff;
      color: #525252;
      border: 1px solid #e5e5e5;
      padding: 3px 8px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
    }

    /* Contenedor principal */
    .container {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 16px;
      overflow-y: auto;
      background-color: #ffffff;
    }

    /* Banner de cuenta activa */
    .active-banner {
      background-color: #fafafa;
      border: 1px solid #eaeaea;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }
    .active-banner small {
      display: block;
      font-size: 11px;
      color: #666666;
      margin-bottom: 6px;
      font-weight: 500;
    }
    .active-banner-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .active-user-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      font-weight: 600;
      color: #171717;
      letter-spacing: -0.01em;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #0070f3;
      box-shadow: 0 0 0 3px rgba(0, 112, 243, 0.14);
    }
    .custom-label-pill {
      font-size: 11px;
      background-color: #ffffff;
      color: #444444;
      padding: 2px 8px;
      border-radius: 9999px;
      border: 1px solid #e5e5e5;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
    }

    /* Lista de tarjetas de cuentas */
    .account-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .account-card {
      background-color: #ffffff;
      border: 1px solid #eaeaea;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .account-card:hover {
      background-color: #fafafa;
      border-color: #d4d4d4;
    }
    .account-card.selected {
      border-color: #171717;
      background-color: #fafafa;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .account-left {
      display: flex;
      align-items: center;
      gap: 11px;
      min-width: 0;
    }
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background-color: #f4f4f5;
      border: 1px solid #e4e4e7;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #171717;
      flex-shrink: 0;
    }
    .account-card.selected .avatar {
      background-color: #171717;
      border-color: #171717;
      color: #ffffff;
    }
    .account-info { min-width: 0; }
    .account-top h4 {
      font-size: 13px;
      color: #171717;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 4px;
    }
    .account-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #666666;
    }
    .tag-custom {
      background-color: #f4f4f5;
      color: #52525b;
      padding: 2px 7px;
      border-radius: 5px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .icon-action-btn {
      background: transparent;
      border: none;
      color: #888888;
      cursor: pointer;
      padding: 4px;
      border-radius: 5px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .icon-action-btn:hover {
      color: #171717;
      background-color: #f4f4f5;
    }
    .icon-action-btn.delete:hover {
      color: #e00;
      background-color: #fff0f0;
    }

    .account-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .status-badge {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: 500;
      transition: all 0.15s ease;
    }
    .selected .status-badge {
      background-color: #171717;
      color: #ffffff;
    }
    .account-card:not(.selected) .status-badge {
      background-color: #ffffff;
      border: 1px solid #eaeaea;
      color: #666666;
    }
    .account-card:not(.selected):hover .status-badge {
      border-color: #d4d4d4;
      color: #171717;
    }

    /* Botones de acción principales */
    .add-buttons {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin-top: 14px;
    }
    .btn-row-split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }
    .btn-add {
      width: 100%;
      height: 35px;
      padding: 0 11px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      transition: all 0.15s ease;
    }
    .btn-gh {
      background-color: #171717;
      color: #ffffff;
      border: 1px solid #171717;
    }
    .btn-gh:hover {
      background-color: #383838;
      border-color: #383838;
    }
    .btn-gl {
      background-color: #ffffff;
      color: #171717;
      border: 1px solid #eaeaea;
    }
    .btn-gl:hover {
      background-color: #fafafa;
      border-color: #171717;
    }
    .btn-clone-full {
      background-color: #fafafa;
      color: #171717;
      border: 1px solid #e5e5e5;
    }
    .btn-clone-full:hover {
      background-color: #f4f4f5;
      border-color: #171717;
    }

    /* Notificación discreta de estado */
    .toast-feedback {
      margin-top: auto;
      padding-top: 12px;
    }
    .toast-box {
      background-color: #fafafa;
      border: 1px solid #eaeaea;
      border-radius: 6px;
      padding: 8px 11px;
      font-size: 11px;
      color: #525252;
      display: flex;
      align-items: center;
      gap: 8px;
      line-height: 1.4;
    }
    .toast-box svg {
      color: #0070f3;
    }

    /* Pie de aplicación */
    .app-footer {
      height: 30px;
      background-color: #fafafa;
      border-top: 1px solid #eaeaea;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-size: 10.5px;
      color: #737373;
    }

    /* Diálogo modal limpio */
    .dialog-overlay {
      display: none;
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
      padding: 18px;
      z-index: 100;
    }
    .dialog-box {
      background: #ffffff;
      border: 1px solid #eaeaea;
      border-radius: 10px;
      width: 100%;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    .dialog-header {
      background: #fafafa;
      padding: 11px 14px;
      font-size: 12.5px;
      font-weight: 600;
      color: #171717;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #eaeaea;
    }
    .dialog-close {
      cursor: pointer;
      color: #888888;
      padding: 2px 5px;
      border-radius: 4px;
    }
    .dialog-close:hover {
      color: #171717;
      background: #eaeaea;
    }
    .dialog-body {
      padding: 14px;
      font-size: 12px;
      color: #444444;
      line-height: 1.5;
    }
    .field-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: #525252;
      margin-top: 10px;
      margin-bottom: 4px;
    }
    .dialog-input, .dialog-select {
      width: 100%;
      padding: 8px 10px;
      background: #ffffff;
      border: 1px solid #d4d4d4;
      color: #171717;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .dialog-input:focus, .dialog-select:focus {
      border-color: #171717;
    }
    .path-row {
      display: flex;
      gap: 6px;
    }
    .btn-browse {
      background: #fafafa;
      border: 1px solid #d4d4d4;
      color: #171717;
      padding: 0 10px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-browse:hover {
      background: #f4f4f5;
      border-color: #171717;
    }
    .auto-pin-note {
      margin-top: 10px;
      padding: 8px 10px;
      background: #fafafa;
      border: 1px solid #eaeaea;
      border-radius: 6px;
      font-size: 11px;
      color: #525252;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 14px;
    }
    .btn-primary {
      background: #171717;
      color: #ffffff;
      border: 1px solid #171717;
      padding: 7px 13px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .btn-primary:hover { background: #383838; }
    .btn-secondary {
      background: #ffffff;
      color: #525252;
      border: 1px solid #eaeaea;
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-secondary:hover {
      background: #fafafa;
      color: #171717;
      border-color: #d4d4d4;
    }
  </style>
</head>
<body>

  <!-- Iconos SVG -->
  <svg style="display:none;">
    <symbol id="icon-git-branch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
    </symbol>
    <symbol id="icon-shield-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </symbol>
    <symbol id="icon-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
    </symbol>
    <symbol id="icon-edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </symbol>
    <symbol id="icon-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </symbol>
    <symbol id="icon-github" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"/>
    </symbol>
    <symbol id="icon-gitlab" viewBox="0 0 24 24" fill="currentColor">
      <path d="m22.65 14.39-1.43-4.41L18.39 1.3a.62.62 0 0 0-1.18 0l-2.83 8.68H9.62L6.79 1.3a.62.62 0 0 0-1.18 0L2.78 9.98 1.35 14.39a.89.89 0 0 0 .32 1L12 22.89l10.33-7.5a.89.89 0 0 0 .32-1Z"/>
    </symbol>
    <symbol id="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </symbol>
    <symbol id="icon-external" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
    </symbol>
    <symbol id="icon-download-cloud" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/>
    </symbol>
    <symbol id="icon-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
    </symbol>
  </svg>

  <!-- Ventana compacta de escritorio -->
  <div class="app-window">
    <!-- Barra superior -->
    <div class="title-bar">
      <div class="title-bar-left">
        <svg width="15" height="15"><use href="#icon-git-branch"/></svg>
        <span>Dossier</span>
      </div>
      <div class="title-bar-right">
        <span class="vault-badge" title="Credenciales cifradas en el llavero del sistema operativo">
          <svg width="10" height="10"><use href="#icon-shield-lock"/></svg>
          Bóveda
        </span>
      </div>
    </div>

    <!-- Contenido principal -->
    <div class="container">
      <div class="active-banner">
        <small>Sesión activa en el sistema</small>
        <div class="active-banner-main">
          <div class="active-user-wrap">
            <span class="pulse-dot"></span>
            <span id="banner-user">juan-dev</span>
          </div>
          <span class="custom-label-pill" id="banner-label">
            <svg width="11" height="11"><use href="#icon-tag"/></svg>
            Personal
          </span>
        </div>
      </div>

      <div class="account-list" id="account-list"></div>

      <div class="add-buttons">
        <div class="btn-row-split">
          <button class="btn-add btn-gh" onclick="iniciarFlujoNativoGithub()">
            <svg width="14" height="14"><use href="#icon-github"/></svg>
            GitHub
          </button>
          <button class="btn-add btn-gl" onclick="iniciarFlujoNativoGitlab()">
            <svg width="14" height="14" style="color:#fc6d26;"><use href="#icon-gitlab"/></svg>
            GitLab
          </button>
        </div>
        <button class="btn-add btn-clone-full" onclick="abrirModalClonar()">
          <svg width="14" height="14"><use href="#icon-download-cloud"/></svg>
          Clonar repositorio con perfil...
        </button>
      </div>

      <div class="toast-feedback">
        <div class="toast-box" id="status-toast">
          <svg width="14" height="14"><use href="#icon-check"/></svg>
          <span>Sincronizado con el gestor de credenciales de Git.</span>
        </div>
      </div>
    </div>

    <!-- Pie informativo -->
    <div class="app-footer">
      <span>Credential Helper</span>
      <span>VS Code · Zed · Cursor · Warp · Claude</span>
    </div>

    <!-- Diálogo modal para vinculación y clonado -->
    <div class="dialog-overlay" id="native-dialog">
      <div class="dialog-box">
        <div class="dialog-header">
          <span id="native-dialog-title">Autenticación</span>
          <span class="dialog-close" onclick="cerrarDialogoNativo()">✕</span>
        </div>
        <div class="dialog-body" id="native-dialog-body"></div>
      </div>
    </div>
  </div>

  <script>
    const isElectron = typeof window.gitManagerAPI !== 'undefined';

    let cuentas = [
      {
        id: '1',
        proveedor: 'github',
        host: 'github.com',
        etiqueta: 'Personal',
        usuario: 'juan-dev',
        email: 'juan@users.noreply.github.com'
      },
      {
        id: '2',
        proveedor: 'github',
        host: 'github.com',
        etiqueta: 'Cliente',
        usuario: 'juan-consultor',
        email: 'juan@cliente-corp.com'
      },
      {
        id: '3',
        proveedor: 'gitlab',
        host: 'gitlab.com',
        etiqueta: 'Corporativo',
        usuario: 'jperez.empresa',
        email: 'jperez@empresa.gitlab.com'
      }
    ];

    let activaId = '1';

    async function inicializar() {
      if (isElectron) {
        const data = await window.gitManagerAPI.getAccounts();
        if (data && data.cuentas.length > 0) {
          cuentas = data.cuentas;
          activaId = data.activaId || cuentas[0].id;
        }
      }
      render();
    }

    function actualizarNotificacion(mensaje) {
      const toast = document.getElementById('status-toast');
      toast.innerHTML = `<svg width="14" height="14"><use href="#icon-check"/></svg><span>${mensaje}</span>`;
    }

    function render() {
      const list = document.getElementById('account-list');
      list.innerHTML = '';

      cuentas.forEach((c) => {
        const isSelected = c.id === activaId;
        const card = document.createElement('div');
        card.className = `account-card ${isSelected ? 'selected' : ''}`;
        card.onclick = () => seleccionarCuenta(c.id);

        const provIcon = c.proveedor === 'github' ? '#icon-github' : '#icon-gitlab';
        const iconStyle = (!isSelected && c.proveedor === 'gitlab') ? 'style="color:#fc6d26;"' : '';

        card.innerHTML = `
          <div class="account-left">
            <div class="avatar">
              <svg width="17" height="17" ${iconStyle}><use href="${provIcon}"/></svg>
            </div>
            <div class="account-info">
              <div class="account-top">
                <h4>${c.usuario}</h4>
              </div>
              <div class="account-meta">
                <span class="tag-custom">
                  <svg width="10" height="10"><use href="#icon-tag"/></svg>
                  ${c.etiqueta}
                </span>
                <button class="icon-action-btn" title="Modificar etiqueta" onclick="event.stopPropagation(); editarEtiqueta('${c.id}')">
                  <svg width="12" height="12"><use href="#icon-edit"/></svg>
                </button>
              </div>
            </div>
          </div>
          <div class="account-actions">
            <span class="status-badge">${isSelected ? 'Activa' : 'Usar'}</span>
            <button class="icon-action-btn delete" title="Desvincular cuenta" onclick="event.stopPropagation(); eliminarCuenta('${c.id}')">
              <svg width="13" height="13"><use href="#icon-trash"/></svg>
            </button>
          </div>
        `;
        list.appendChild(card);
      });

      const activa = cuentas.find(c => c.id === activaId) || cuentas[0];
      if (!activa) return;

      document.getElementById('banner-user').textContent = activa.usuario;
      document.getElementById('banner-label').innerHTML = `
        <svg width="11" height="11"><use href="#icon-tag"/></svg>
        ${activa.etiqueta}
      `;
    }

    async function seleccionarCuenta(id) {
      activaId = id;
      if (isElectron) {
        await window.gitManagerAPI.selectAccount(id);
      }
      const activa = cuentas.find(c => c.id === id);
      actualizarNotificacion(`Cuenta activa: [${activa.etiqueta}] ${activa.usuario}.`);
      render();
    }

    /* Quick Clone con Auto-Pin */
    function abrirModalClonar() {
      const dialog = document.getElementById('native-dialog');
      const opcionesCuentas = cuentas.map(c =>
        `<option value="${c.id}" ${c.id === activaId ? 'selected' : ''}>[${c.etiqueta}] ${c.usuario} (${c.proveedor === 'github' ? 'GitHub' : 'GitLab'})</option>`
      ).join('');

      document.getElementById('native-dialog-title').innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <svg width="14" height="14"><use href="#icon-download-cloud"/></svg>
          Clonar repositorio
        </span>
      `;
      document.getElementById('native-dialog-body').innerHTML = `
        <label class="field-label" style="margin-top:0;">URL del repositorio (HTTPS)</label>
        <input type="text" class="dialog-input" id="clone-url" placeholder="https://github.com/organizacion/proyecto.git" />

        <label class="field-label">Cuenta para autenticar y firmar</label>
        <select class="dialog-select" id="clone-account">
          ${opcionesCuentas}
        </select>

        <label class="field-label">Directorio de destino</label>
        <div class="path-row">
          <input type="text" class="dialog-input" id="clone-path" value="~/proyectos/nuevo-proyecto" />
          <button type="button" class="btn-browse" onclick="simularSeleccionCarpeta()">Elegir</button>
        </div>

        <div class="auto-pin-note">
          <svg width="13" height="13" style="color:#0070f3;"><use href="#icon-pin"/></svg>
          <span><strong>Auto-Pin:</strong> Esta carpeta quedará vinculada automáticamente a la cuenta seleccionada.</span>
        </div>

        <div class="dialog-actions">
          <button class="btn-secondary" onclick="cerrarDialogoNativo()">Cancelar</button>
          <button class="btn-primary" onclick="ejecutarClonado()">Clonar y vincular</button>
        </div>
      `;
      dialog.style.display = 'flex';
    }

    function simularSeleccionCarpeta() {
      const url = document.getElementById('clone-url').value.trim();
      const repoName = url ? url.split('/').pop().replace('.git', '') : 'proyecto-cliente';
      document.getElementById('clone-path').value = `~/proyectos/${repoName}`;
    }

    async function ejecutarClonado() {
      const url = document.getElementById('clone-url').value.trim();
      const cuentaId = document.getElementById('clone-account').value;
      const destino = document.getElementById('clone-path').value.trim();

      if (!url) {
        alert('Ingrese la URL HTTPS del repositorio.');
        return;
      }

      const cuenta = cuentas.find(c => c.id === cuentaId);
      if (isElectron && window.gitManagerAPI.cloneRepo) {
        await window.gitManagerAPI.cloneRepo({ url, cuentaId, destino });
      }

      cerrarDialogoNativo();
      actualizarNotificacion(`Clonado con [${cuenta.etiqueta}] ${cuenta.usuario} y fijado en ${destino}.`);
    }

    /* Flujos de vinculación */
    function iniciarFlujoNativoGithub() {
      const dialog = document.getElementById('native-dialog');
      document.getElementById('native-dialog-title').innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <svg width="14" height="14"><use href="#icon-github"/></svg>
          Autenticación con GitHub
        </span>
      `;
      document.getElementById('native-dialog-body').innerHTML = `
        <div>Se abrirá el navegador predeterminado para autorizar el acceso mediante OAuth oficial de GitHub.</div>
        <div class="dialog-actions">
          <button class="btn-secondary" onclick="cerrarDialogoNativo()">Cancelar</button>
          <button class="btn-primary" onclick="completarOAuthGithub()">
            <svg width="12" height="12"><use href="#icon-external"/></svg>
            Continuar en el navegador
          </button>
        </div>
      `;
      dialog.style.display = 'flex';
    }

    function completarOAuthGithub() {
      const usuarioOAuth = 'juan-nuevo-gh';
      document.getElementById('native-dialog-title').textContent = 'Asignar etiqueta de perfil';
      document.getElementById('native-dialog-body').innerHTML = `
        <div>Sesión autorizada como <strong>${usuarioOAuth}</strong>. Ingrese una etiqueta para identificar esta cuenta:</div>
        <input type="text" class="dialog-input" id="native-etiqueta-input" style="margin-top:8px;" placeholder="Ej. Proyecto Externo" value="Proyecto Externo" />
        <div class="dialog-actions">
          <button class="btn-primary" onclick="finalizarVinculacion('${usuarioOAuth}', 'github', 'gho_oauth_token_demo')">Finalizar</button>
        </div>
      `;
    }

    function iniciarFlujoNativoGitlab() {
      const dialog = document.getElementById('native-dialog');
      document.getElementById('native-dialog-title').innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:6px;">
          <svg width="14" height="14" style="color:#fc6d26;"><use href="#icon-gitlab"/></svg>
          Vincular cuenta de GitLab
        </span>
      `;
      document.getElementById('native-dialog-body').innerHTML = `
        <div>Ingrese su Personal Access Token de GitLab (se almacenará cifrado en el sistema):</div>
        <input type="password" class="dialog-input" id="native-gl-token" style="margin-top:8px;" placeholder="glpat-xxxxxxxxxxxxxxxxxxxx" value="glpat-token-valido" />
        <div class="dialog-actions">
          <button class="btn-secondary" onclick="cerrarDialogoNativo()">Cancelar</button>
          <button class="btn-primary" onclick="completarTokenGitlab()">Siguiente</button>
        </div>
      `;
      dialog.style.display = 'flex';
    }

    function completarTokenGitlab() {
      const tokenVal = document.getElementById('native-gl-token').value.trim();
      const usuarioDetectado = 'jperez.gitlab';
      document.getElementById('native-dialog-title').textContent = 'Asignar etiqueta de perfil';
      document.getElementById('native-dialog-body').innerHTML = `
        <div>Credencial verificada para <strong>${usuarioDetectado}</strong>. Asigne una etiqueta de perfil:</div>
        <input type="text" class="dialog-input" id="native-etiqueta-input" style="margin-top:8px;" placeholder="Ej. Cliente GitLab" value="Cliente GitLab" />
        <div class="dialog-actions">
          <button class="btn-primary" onclick="finalizarVinculacion('${usuarioDetectado}', 'gitlab', '${tokenVal}')">Finalizar</button>
        </div>
      `;
    }

    async function finalizarVinculacion(usuario, proveedor, token) {
      const etiqueta = document.getElementById('native-etiqueta-input').value.trim() || 'General';
      const nueva = {
        id: Date.now().toString(),
        proveedor,
        host: proveedor === 'github' ? 'github.com' : 'gitlab.com',
        etiqueta,
        usuario,
        email: `${usuario}@users.noreply.${proveedor}.com`
      };

      if (isElectron) {
        await window.gitManagerAPI.addAccount(nueva, token);
      }
      cuentas.push(nueva);
      cerrarDialogoNativo();
      seleccionarCuenta(nueva.id);
    }

    function cerrarDialogoNativo() {
      document.getElementById('native-dialog').style.display = 'none';
    }

    function editarEtiqueta(id) {
      const cuenta = cuentas.find(c => c.id === id);
      const nueva = prompt('Ingrese la nueva etiqueta de perfil:', cuenta.etiqueta);
      if (nueva && nueva.trim()) {
        cuenta.etiqueta = nueva.trim();
        render();
      }
    }

    async function eliminarCuenta(id) {
      if (cuentas.length <= 1) {
        alert('Debe mantener al menos una cuenta vinculada.');
        return;
      }
      if (isElectron) {
        await window.gitManagerAPI.deleteAccount(id);
      }
      cuentas = cuentas.filter(c => c.id !== id);
      if (activaId === id) activaId = cuentas[0].id;
      actualizarNotificacion('Cuenta desvinculada correctamente.');
      render();
    }

    inicializar();
  </script>
</body>
</html>
```
