# Dossier — Producto

> Sucesor de `BLUEPRINT.v1.md` (eliminado). Visión, alcance, funcionalidades, costos, fases, riesgos y decisiones abiertas. Las decisiones de arquitectura _ya tomadas_ viven como ADR en `docs/adr/`; esto es el _qué_ y el _para quién_, no el _por qué_ técnico.

## 1. Visión y alcance

**Qué es.** Una app de escritorio que configura Git para usar **Git Credential Manager (GCM)** y reglas `includeIf`, de modo que varias cuentas de GitHub y GitLab convivan en la misma máquina: cada carpeta elige automáticamente la identidad del commit y la cuenta HTTPS usada en `clone`, `pull` y `push`.

**Para quién.** Desarrolladores y consultores con cuentas personales, de cliente y corporativas.

**Restricción maestra: 100% open source y costo $0.** Sin servidores, sin SaaS, sin cuentas de pago.

**Qué NO hace.**

- No reemplaza al cliente de Git ni a GCM.
- No instala un credential helper propio ni addons nativos.
- No usa SSH para el transporte remoto (`clone`/`fetch`/`push` sobre HTTPS, nunca `git@host:...`) ni reescribe URLs remotas. **Aclaración (change 05-ajustes):** esto no impide que un perfil tenga una clave SSH asignada solo para _firmar_ commits (`gpg.format = ssh`, una función de Git separada del transporte) — firmar y transportar son dos cosas distintas, y solo la segunda está prohibida acá.
- No tiene backend, base de datos, telemetría ni cuentas de usuario propias.
- No envía tokens fuera de la máquina.
- No expone MCP ni interfaces para agentes IA.

**Plataformas.** Solo Windows. Se conserva el código multiplataforma (sin rutas ni lógica exclusivas de Windows) para no cerrar la puerta, pero macOS y Linux están **fuera del roadmap**. macOS queda descartado porque la firma/notarización cuesta $99/año (Apple Developer Program), incompatible con la restricción $0. Linux queda fuera por decisión de alcance; la comprobación de almacén de secretos se mantiene como medida defensiva en `core`.

## 2. Funcionalidades

### Alcance completo (sin MVP)

No se entrega una versión reducida: el producto se construye entero. El orden de implementación lo fijan las fases (§5).

- [x] Vincular cuentas — diálogos reales de GitHub (Device Flow) y GitLab (PAT) desde la pantalla principal (`docs/specs/changes/archivados/04-vincular-cuenta-github-gitlab/`)
- [x] Guardar y borrar tokens en GCM, con verificación `approve` → `fill` — confirmado contra GCM real
- [ ] GCM detectado y usable, con estado claro cuando falte
- [ ] Cambio de cuenta activa con un clic desde la bandeja
- [x] Identidad y cuenta HTTPS por carpeta con `includeIf` — confirmado
- [ ] Etiquetas editables
- [x] Pin de carpetas — desde un diálogo por cuenta en la pantalla principal (no desde Ajustes, ver más abajo), con guardia de identidad opcional por carpeta (hooks de `pre-commit`/`pre-push`)
- [ ] Quick Clone con Auto-Pin
- [ ] Doctor: valida que Git resuelve identidad y `username` correctos dentro de un repo de cada carpeta fijada; en carpetas sin repo solo valida el archivo generado
- [ ] Host de GitLab configurable desde la UI
- [x] Arranque con Windows — interruptor en Ajustes
- [ ] Detección de almacén de secretos ausente con bloqueo del guardado y aviso (defensivo; no se publica para Linux)
- [ ] Instalador NSIS + auto-actualización desde GitHub Releases
- [ ] Firmado con SignPath Foundation (una vez aprobada la postulación)
- [x] Tema (claro/oscuro/según el sistema) — hecho en `05-ajustes`
- [x] ~~Reglas por carpeta accesibles desde Ajustes~~ — decisión revisada de nuevo al usar la app: terminó siendo al revés, un diálogo por cuenta desde la pantalla principal (`AccountFoldersDialog`), no una sección en Ajustes
- [x] Alcance al cambiar de cuenta activa: interruptor en Ajustes para aplicar también la clave de firma de la cuenta (si tiene una asignada) — sin UI todavía para asignar esa clave a una cuenta
- [x] ~~Carpeta base por defecto para Quick Clone, y si la cuenta activa queda aislada~~ — decisión revisada: Quick Clone va a pedir carpeta y cuenta en el momento de clonar, no desde una preferencia global; se sacó de `Settings`
- [x] Atajo de teclado global para abrir/ocultar la ventana (`Ctrl+Shift+D`)
- [x] Mantenimiento de credenciales: limpia entradas huérfanas que GCM tiene guardadas (solo las que Dossier reconoce como propias)
- [x] El menú del clic derecho en la bandeja ofrece Tema/Inicio con Windows, igual que Ajustes, sincronizado en los dos sentidos
- [ ] Sincronizar cuentas vinculadas antes de tener Dossier: (a) al vincular, detectar si GCM ya tiene una credencial guardada para ese host y ofrecerla en vez de pedir un token nuevo; (b) importar el token ya cacheado por `gh`/`glab` CLI (si están instalados y logueados), verificado contra la API igual que un token nuevo. Nunca un escaneo genérico de todo Windows Credential Manager (mismo límite ya aceptado para la limpieza de credenciales, `05-ajustes`). **Lo de (a) — que solo funcionaría bien con una sola credencial guardada por host — es una suposición sin probar en vivo todavía**, no un límite confirmado: antes de descartar o acotar esta idea hay que probarlo de verdad contra una instalación real de GCM (con varios enfoques si el primero no funciona), no asumirlo de memoria. Pensado como su propio change chico, después de que la tanda actual de ramas pendientes (vincular cuenta, rediseño, Ajustes) se revise y se mergee — no se agrega encima de la que ya está lista para revisión

### Después

- [ ] Postulación y aprobación en SignPath Foundation + firma del instalador NSIS; no hay un segundo `.exe` propio que firmar
- [ ] Publicación en `winget` / Scoop
- [ ] README bilingüe, CONTRIBUTING, plantillas de issues, SECURITY.md

## 3. Especificación funcional (semillas para changes futuros)

Contenido todavía no implementado; se usa como punto de partida de `proposal.md`/`requirements.md` cuando se abra el change de cada fase — no se reescribe de memoria.

### 3.1 Módulos lógicos (referencia histórica del diseño original)

| Módulo     | Contenido                                                                                              | Lenguaje            | Estado                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `core`     | cuentas, reglas, generación de `gitconfig`, proveedores, orquestación de `git credential`, cliente Git | TypeScript          | **Fase 1 — hecho** (`core/`)                                                                                                           |
| `main`     | bandeja, IPC, Device Flow, clonado, updater, verificación de GCM                                       | TypeScript/Electron | **Fase 3 — hecho** (bandeja/ventana, Device Flow/PAT, motor de identidad, Ajustes, guardia de identidad); falta clonado, updater (Fase 4/5) |
| `preload`  | `contextBridge` con API mínima                                                                         | TypeScript/Electron | **Fase 3 — hecho** (`src/preload/index.ts`)                                                                                            |
| `renderer` | interfaz Preact                                                                                        | TypeScript          | **Fase 3 — hecho** (pantalla principal, vincular cuenta, Ajustes)                                                                      |

### 3.2 Proveedores (Fase 2)

| Proveedor | Autenticación                                                                                          | Datos que se obtienen          |
| --------- | ------------------------------------------------------------------------------------------------------ | ------------------------------ |
| GitHub    | Device Flow (`@octokit/auth-oauth-device`), scope `repo`                                               | `GET /user`: login, ID, nombre |
| GitLab    | PAT con `api` (decisión revisada en Fase 3, antes `write_repository`), validado con `GET /api/v4/user` | usuario, ID, nombre            |

El host de GitLab es configurable desde el inicio, lo que deja resuelto el soporte para instancias autoalojadas.

`api` en vez del mínimo `write_repository`: a pedido explícito del usuario, para que el mismo token sirva también para `glab` CLI, Docker Registry, extensiones de editor y automatizaciones (servidor MCP de GitLab, por ejemplo), no solo para `git push`/`pull` — ver `docs/adr/0006-seguridad.md`.

**Correo de commits.** GitHub usa `ID+usuario@users.noreply.github.com` para cuentas creadas desde el 18-07-2017; cuentas antiguas pueden usar `usuario@users.noreply.github.com`. El ID sale de `GET /user` al vincular. GitLab expone correos privados, pero su patrón exacto con ID **[verificar en documentación oficial]** (decisión abierta, §6.2).

### 3.3 Quick Clone (Fase 4)

1. **Preguntar con qué cuenta clonar** (si hay más de una vinculada) — sin esto, `<login>` del paso 3 no tiene de dónde salir. Recordatorio explícito del usuario, Fase 3 parte 2: no se puede dar por sobreentendido al diseñar la pantalla.
2. Validar la URL (solo `https://`, host conocido) antes de pasarla a Git.
3. Lanzar `git -c credential.<URL>.username=<login> clone <url>`, con el `login` de la cuenta elegida en el paso 1; el token nunca va en la URL remota.
4. Al terminar con éxito: escribir la regla de carpeta (`core/features/rules`, ya existe) y el `includeIf` (`core/features/gitconfig`, ya existe).
5. Emitir progreso por IPC; si falla la autenticación, informarlo sin dejar pins a medias.

### 3.4 IPC — API que expone el preload (Fase 3)

`getState` · `selectAccount` — **hechos** (parte 1 de Fase 3) — más `hideWindow` (no estaba en esta lista original: lo pidió el botón de cerrar de la ventana centrada). Pendientes: `startGithubLink` (emite `user_code` por evento) · `cancelGithubLink` · `linkGitlab` · `renameAccount` · `removeAccount` · `listPins` · `pinFolder` · `unpinFolder` · `pickFolder` · `cloneRepo` (emite progreso) · `getCredentialStatus` · `recheckCredentials` · `getSettings` · `setSettings` · `openExternal`.

Cada handler valida el origen del mensaje y el esquema de entrada con **zod**. **Nunca se envía un token al renderer.**

### 3.5 Modelo de datos (ya implementado en `core`, salvo lo marcado)

| Dato              | Dónde                               | Contenido                                                                        | Estado                                                               |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Cuentas           | `accounts.json`                     | `id`, `provider`, `host`, `label`, `username`, `name`, `email`. **Sin secretos** | **Hecho** (`core/features/accounts`)                                 |
| Tokens            | Windows Credential Manager, vía GCM | entrada por `host + username`; la app nunca guarda secretos en JSON              | **Hecho** (`core/features/git-credential`)                           |
| Reglas de carpeta | `rules.json`                        | `{ path, accountId }`                                                            | **Hecho** (`core/features/rules`)                                    |
| Estado            | `state.json`                        | `activeId`                                                                       | **Hecho** (`core/features/state`, consumido por `main` desde Fase 3) |
| Ajustes           | `settings.json`                     | inicio con el sistema, etc.                                                      | Pendiente                                                            |

Todos los JSON se manejan con `conf`. Escrituras atómicas (archivo temporal + rename, lo da `conf`). El estado de GCM se consulta, no se copia: la app nunca mantiene una caché de tokens.

## 4. Distribución, firma y costos

| Elemento          | Herramienta                                                             | Costo |
| ----------------- | ----------------------------------------------------------------------- | ----- |
| Código e issues   | GitHub público                                                          | $0    |
| CI/CD             | GitHub Actions                                                          | $0    |
| Distribución      | GitHub Releases                                                         | $0    |
| Landing y docs    | GitHub Pages                                                            | $0    |
| OAuth GitHub      | OAuth App + Device Flow                                                 | $0    |
| Licencia          | MIT                                                                     | $0    |
| Firma Windows     | SignPath Foundation (hay que postular; aprobación manual por release)   | $0    |
| Windows sin firma | Mientras no aprueben SignPath: SmartScreen mostrará aviso; documentarlo | $0    |
| Auto-update       | `electron-updater` desde GitHub Releases (sin backend propio)           | $0    |
| GCM               | Incluido en Git for Windows                                             | $0    |
| macOS / Linux     | **Fuera del alcance** (macOS requiere $99/año de Apple)                 | —     |

## 5. Fases y criterio de terminado

| Fase               | Entregable                                                                                                                                                                                                                     | Terminado cuando…                                                                                                                                    | Estado                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Spike**       | Base del proyecto + GCM + `includeIf`                                                                                                                                                                                          | `approve` guarda A y B, `fill` devuelve el token correcto según `credential.<host>.username`, y Git resuelve identidad/cuenta por carpeta en Windows | **Hecho** — `docs/specs/changes/archivados/00-spike-base-y-gcm/` (CI real confirmada en los 3 sistemas; `x-access-token` resuelto en Fase 2)                                                                                                                                                                                           |
| **1. Núcleo**      | Módulo `core` con tests                                                                                                                                                                                                        | los tests pasan sin Electron y la integración usa git real en carpetas temporales                                                                    | **Hecho** — `docs/specs/changes/archivados/01-core-cuentas-y-reglas/`                                                                                                                                                                                                                                                                  |
| **2. Cuentas**     | GitLab (PAT), GitHub (Device Flow), IPC                                                                                                                                                                                        | vinculas ambas, los tokens están en GCM y no en disco                                                                                                | **Hecho** — `docs/specs/changes/archivados/02-proveedores-github-gitlab/`: GitHub y GitLab verificados con cuentas reales (vinculación real incluida); IPC llegó en Fase 3                                                                                                                                                             |
| **3. UI**          | Pantallas principal, vincular y ajustes, portadas del prototipo                                                                                                                                                                | cambias de cuenta desde la bandeja y un commit sale con la identidad correcta                                                                        | **En progreso** — parte 1 hecha (`docs/specs/changes/archivados/03-main-preload-renderer-pantalla-principal/`): ventana real, pantalla principal, notificaciones e ícono de marca. Pendiente: diálogos de vincular cuenta (GitHub/GitLab) y Ajustes — señal de alto riesgo (OAuth/credenciales), requieren spec propia antes de código |
| **4. Quick Clone** | Clonado con cuenta explícita + Auto-Pin                                                                                                                                                                                        | clonas un repo privado de la cuenta B y el siguiente push desde esa carpeta funciona sin tocar nada                                                  | Pendiente                                                                                                                                                                                                                                                                                                                              |
| **5. Release**     | electron-builder + Actions + Releases + updater                                                                                                                                                                                | un tag publica el `.exe` y la app se actualiza sola                                                                                                  | **Hecho** — `docs/specs/changes/archivados/08-release-pipeline/`: verificado de punta a punta contra GitHub real (tags de prueba), con revisión independiente aplicada. El repo pasó a público (necesario para que `electron-updater` funcione sin token). Instalador sigue sin firmar (ver decisión abierta #3 más abajo)                                                                                                                                                                                                                                                                                                                              |
| **6. Después**     | Verificación de GitLab autoalojado (host configurable desde la UI), GitHub Enterprise Server (self-hosted, vía PAT — Device Flow no sirve ahí, cada instancia necesitaría su propia OAuth App), `winget`/Scoop y documentación | según prioridad                                                                                                                                      | Pendiente                                                                                                                                                                                                                                                                                                                              |

TypeScript estricto y la CI en tres sistemas se configuraron en la Fase 0, antes del spike.

## 6. Riesgos y mitigaciones

| Riesgo                                          | Impacto                                            | Mitigación                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GCM no instalado o cadena de helpers ajena      | La app no puede guardar tokens                     | Detección temprana, Estado de credenciales, guía para reinstalar Git for Windows con GCM; no sobrescribir la cadena del usuario                                                                                                                                                                         |
| Otro helper responde antes que GCM              | Se usa la cuenta o token equivocado                | Detectar la cadena con `git config --get-all credential.helper`, marcar incompatibilidad y pedir intervención explícita; nunca reordenar sin consentimiento                                                                                                                                             |
| `useHttpPath=true` previo                       | GCM storage por ruta rompe la selección por cuenta | El config generado fija `useHttpPath=false` en hosts gestionados (pendiente: `core` todavía no escribe el perfil completo, ver requirements M3 de la Fase 1)                                                                                                                                            |
| `git credential approve` sale 0 sin guardar     | Pérdida silenciosa del token                       | Verificación obligatoria con `git credential fill` antes de marcar la cuenta como vinculada — **implementado** en `core/features/git-credential`                                                                                                                                                        |
| Prompt colgado                                  | Bloquea flujo de vinculación o push                | Flags no interactivos, timeout y env limpio; nunca `GIT_ASKPASS` interactivo desde la app — **implementado**, y además se descubrió que GCM hace un _probe_ de red cuando no hay credencial cacheada (`docs/lessons/README.md`)                                                                         |
| Config local del usuario gana sobre `includeIf` | Identidad o cuenta incorrecta                      | Doctor con `git config --get` dentro del repo; mostrar el origen del valor (Doctor: pendiente)                                                                                                                                                                                                          |
| OAuth App restringida por organización          | Repos privados aparecen como "not found"           | Documentar aprobación de la OAuth App o uso de client_id propio de la organización (Fase 2)                                                                                                                                                                                                             |
| `electron-menubar` sin mantenimiento            | Mantenimiento de la ventana                        | **Sin mitigar todavía**: Fase 3 (parte 1) la usa directamente en `src/main/index.ts`, sin un adaptador propio que aísle sus llamadas — si se abandona el paquete, hay que revisar varios puntos del archivo, no uno solo. Aceptado por ahora (superficie de uso chica); revisar si da problemas reales. |
| SmartScreen / Smart App Control                 | Bloquea la instalación sin firma                   | Postular a SignPath Foundation; mientras tanto documentar y ofrecer `winget` / Scoop                                                                                                                                                                                                                    |
| Formato de correo `noreply` distinto            | Commits con identidad rechazada                    | Verificar contra documentación oficial de GitHub/GitLab al implementar proveedores (Fase 2)                                                                                                                                                                                                             |

## 7. Decisiones abiertas

1. **`client_id` de la OAuth App de GitHub** — **resuelta**: `Ov23liZi9KS6Wf5C1aJ5` (Device Flow habilitado), registrada en `core/features/providers/github/github.ts`. No es secreto.
2. **Formato del correo noreply**: GitHub — **confirmado en vivo** (Fase 2): `ID+usuario@users.noreply.github.com` para cuentas creadas desde el 18-07-2017 (verificado con una cuenta real). GitLab sigue sin confirmar oficialmente — `core/features/providers/gitlab` no inventa un patrón: usa `email`/`public_email` de la API tal cual, o `undefined` si ninguno viene.
3. **Aprobación de SignPath Foundation**: gestionar la postulación; el pipeline de release debe estar listo antes de solicitarla. Pendiente de Fase 5.
4. **Notificaciones en instalador real**: verificar `AppUserModelID` + `ToastActivatorCLSID` y el acceso directo del menú Inicio con NSIS, no solo en modo dev. Pendiente de Fase 5.
5. **Target de `electron-vite` 6**: ~~verificar build con Electron 45 y dejar fijado `node24.22 / chrome156`~~ — **resuelta, ver ADR 0002**.
6. **Spike GCM en Git for Windows real**: **resuelta**. `approve`→`fill` por `username` confirmado con dos cuentas del mismo host (host desconocido para GCM) y sin interacción. Verificación en vivo adicional con una cuenta real de `github.com` (Fase 2): GitHub **no** exige `x-access-token`, se usa el `login` real — pero se encontró que GCM parece resolver la identidad real del token para hosts que reconoce nativamente, en vez de confiar ciegamente en el `username` de `approve` (ver `docs/lessons/README.md` y `docs/adr/0004`).
7. **TDD frente al orden de gates** (anotada por la skill `spec-first-protocol` 1.6.0, `methodology-digest.md` §5): los tests escritos primero en TDD viven dentro del paso de implementación; el gate de tests sigue corriendo la suite completa después. No cambia el orden de gates definido en `CLAUDE.md`.

## 8. Siguiente paso

Completado hasta aquí: Fase 0 (spike), Fase 1 (`core`), Fase 2 (proveedores GitHub/GitLab), Fase 3 completa (ventana, pantalla principal, notificaciones, vincular cuenta, motor de identidad, Ajustes con guardia de identidad por carpeta) y Fase 5 (pipeline de release + auto-actualización) — ver `docs/specs/changes/archivados/`. Siguiente: Fase 4 (Quick Clone) — ya implementada y revisada en la rama `feat/quick-clone`, pendiente de mergear.
