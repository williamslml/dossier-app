# Dossier — Producto

> Sucesor de `BLUEPRINT.v1.md` (eliminado). Visión, alcance, funcionalidades, costos, fases, riesgos y decisiones abiertas. Las decisiones de arquitectura _ya tomadas_ viven como ADR en `docs/adr/`; esto es el _qué_ y el _para quién_, no el _por qué_ técnico.

## 1. Visión y alcance

**Qué es.** Una app de escritorio que configura Git para usar **Git Credential Manager (GCM)** y reglas `includeIf`, de modo que varias cuentas de GitHub y GitLab convivan en la misma máquina: cada carpeta elige automáticamente la identidad del commit y la cuenta HTTPS usada en `clone`, `pull` y `push`.

**Para quién.** Desarrolladores y consultores con cuentas personales, de cliente y corporativas.

**Restricción maestra: 100% open source y costo $0.** Sin servidores, sin SaaS, sin cuentas de pago.

**Qué NO hace.**

- No reemplaza al cliente de Git ni a GCM.
- No instala un credential helper propio ni addons nativos.
- No usa SSH ni reescribe URLs remotas.
- No tiene backend, base de datos, telemetría ni cuentas de usuario propias.
- No envía tokens fuera de la máquina.
- No expone MCP ni interfaces para agentes IA.

**Plataformas.** Solo Windows. Se conserva el código multiplataforma (sin rutas ni lógica exclusivas de Windows) para no cerrar la puerta, pero macOS y Linux están **fuera del roadmap**. macOS queda descartado porque la firma/notarización cuesta $99/año (Apple Developer Program), incompatible con la restricción $0. Linux queda fuera por decisión de alcance; la comprobación de almacén de secretos se mantiene como medida defensiva en `core`.

## 2. Funcionalidades

### Alcance completo (sin MVP)

No se entrega una versión reducida: el producto se construye entero. El orden de implementación lo fijan las fases (§5).

- [x] Vincular cuentas — mecanismo de credenciales confirmado en el spike (ver `docs/specs/changes/en-curso/00-spike-base-y-gcm/`); el flujo de vinculación (GitLab PAT, GitHub Device Flow) es Fase 2
- [x] Guardar y borrar tokens en GCM, con verificación `approve` → `fill` — confirmado contra GCM real
- [ ] GCM detectado y usable, con estado claro cuando falte
- [ ] Cambio de cuenta activa con un clic desde la bandeja
- [x] Identidad y cuenta HTTPS por carpeta con `includeIf` — confirmado
- [ ] Etiquetas editables
- [x] Pin de carpetas (manual) — modelo de reglas (`core/features/rules/`) listo; falta UI
- [ ] Quick Clone con Auto-Pin
- [ ] Doctor: valida que Git resuelve identidad y `username` correctos dentro de un repo de cada carpeta fijada; en carpetas sin repo solo valida el archivo generado
- [ ] Host de GitLab configurable desde la UI
- [ ] Arranque con Windows
- [ ] Detección de almacén de secretos ausente con bloqueo del guardado y aviso (defensivo; no se publica para Linux)
- [ ] Instalador NSIS + auto-actualización desde GitHub Releases
- [ ] Firmado con SignPath Foundation (una vez aprobada la postulación)

### Después

- [ ] Postulación y aprobación en SignPath Foundation + firma del instalador NSIS; no hay un segundo `.exe` propio que firmar
- [ ] Publicación en `winget` / Scoop
- [ ] README bilingüe, CONTRIBUTING, plantillas de issues, SECURITY.md

## 3. Especificación funcional (semillas para changes futuros)

Contenido todavía no implementado; se usa como punto de partida de `proposal.md`/`requirements.md` cuando se abra el change de cada fase — no se reescribe de memoria.

### 3.1 Módulos lógicos (referencia histórica del diseño original)

| Módulo     | Contenido                                                                                              | Lenguaje            | Estado                       |
| ---------- | ------------------------------------------------------------------------------------------------------ | ------------------- | ---------------------------- |
| `core`     | cuentas, reglas, generación de `gitconfig`, proveedores, orquestación de `git credential`, cliente Git | TypeScript          | **Fase 1 — hecho** (`core/`) |
| `main`     | bandeja, IPC, Device Flow, clonado, updater, verificación de GCM                                       | TypeScript/Electron | Fase 3                       |
| `preload`  | `contextBridge` con API mínima                                                                         | TypeScript/Electron | Fase 3                       |
| `renderer` | interfaz Preact                                                                                        | TypeScript          | Fase 3                       |

### 3.2 Proveedores (Fase 2)

| Proveedor | Autenticación                                               | Datos que se obtienen          |
| --------- | ----------------------------------------------------------- | ------------------------------ |
| GitHub    | Device Flow (`@octokit/auth-oauth-device`), scope `repo`    | `GET /user`: login, ID, nombre |
| GitLab    | PAT con `write_repository`, validado con `GET /api/v4/user` | usuario, ID, nombre            |

El host de GitLab es configurable desde el inicio, lo que deja resuelto el soporte para instancias autoalojadas.

**Correo de commits.** GitHub usa `ID+usuario@users.noreply.github.com` para cuentas creadas desde el 18-07-2017; cuentas antiguas pueden usar `usuario@users.noreply.github.com`. El ID sale de `GET /user` al vincular. GitLab expone correos privados, pero su patrón exacto con ID **[verificar en documentación oficial]** (decisión abierta, §6.2).

### 3.3 Quick Clone (Fase 4)

1. Validar la URL (solo `https://`, host conocido) antes de pasarla a Git.
2. Lanzar `git -c credential.<URL>.username=<login> clone <url>`; el token nunca va en la URL remota.
3. Al terminar con éxito: escribir la regla de carpeta (`core/features/rules`, ya existe) y el `includeIf` (`core/features/gitconfig`, ya existe).
4. Emitir progreso por IPC; si falla la autenticación, informarlo sin dejar pins a medias.

### 3.4 IPC — API que expone el preload (Fase 3)

`getState` · `selectAccount` · `startGithubLink` (emite `user_code` por evento) · `cancelGithubLink` · `linkGitlab` · `renameAccount` · `removeAccount` · `listPins` · `pinFolder` · `unpinFolder` · `pickFolder` · `cloneRepo` (emite progreso) · `getCredentialStatus` · `recheckCredentials` · `getSettings` · `setSettings` · `openExternal`.

Cada handler valida el origen del mensaje y el esquema de entrada con **zod**. **Nunca se envía un token al renderer.**

### 3.5 Modelo de datos (ya implementado en `core`, salvo lo marcado)

| Dato              | Dónde                               | Contenido                                                                        | Estado                                     |
| ----------------- | ----------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| Cuentas           | `accounts.json`                     | `id`, `provider`, `host`, `label`, `username`, `name`, `email`. **Sin secretos** | **Hecho** (`core/features/accounts`)       |
| Tokens            | Windows Credential Manager, vía GCM | entrada por `host + username`; la app nunca guarda secretos en JSON              | **Hecho** (`core/features/git-credential`) |
| Reglas de carpeta | `rules.json`                        | `{ path, accountId }`                                                            | **Hecho** (`core/features/rules`)          |
| Estado            | `state.json`                        | `activeId`                                                                       | Pendiente (sin consumidor todavía)         |
| Ajustes           | `settings.json`                     | inicio con el sistema, etc.                                                      | Pendiente                                  |

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

| Fase               | Entregable                                                                                         | Terminado cuando…                                                                                                                                    | Estado                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **0. Spike**       | Base del proyecto + GCM + `includeIf`                                                              | `approve` guarda A y B, `fill` devuelve el token correcto según `credential.<host>.username`, y Git resuelve identidad/cuenta por carpeta en Windows | **Hecho** — `docs/specs/changes/en-curso/00-spike-base-y-gcm/` (2 ítems abiertos: CI real, `x-access-token`) |
| **1. Núcleo**      | Módulo `core` con tests                                                                            | los tests pasan sin Electron y la integración usa git real en carpetas temporales                                                                    | **Hecho** — `docs/specs/changes/en-curso/01-core-cuentas-y-reglas/`                                          |
| **2. Cuentas**     | GitLab (PAT), GitHub (Device Flow), IPC                                                            | vinculas ambas, los tokens están en GCM y no en disco                                                                                                | Pendiente                                                                                                    |
| **3. UI**          | Pantallas principal, vincular y ajustes, portadas del prototipo                                    | cambias de cuenta desde la bandeja y un commit sale con la identidad correcta                                                                        | Pendiente                                                                                                    |
| **4. Quick Clone** | Clonado con cuenta explícita + Auto-Pin                                                            | clonas un repo privado de la cuenta B y el siguiente push desde esa carpeta funciona sin tocar nada                                                  | Pendiente                                                                                                    |
| **5. Release**     | electron-builder + Actions + Releases + updater                                                    | un tag publica el `.exe` y la app se actualiza sola                                                                                                  | Pendiente                                                                                                    |
| **6. Después**     | Verificación de GitLab autoalojado (host configurable desde la UI), `winget`/Scoop y documentación | según prioridad                                                                                                                                      | Pendiente                                                                                                    |

TypeScript estricto y la CI en tres sistemas se configuraron en la Fase 0, antes del spike.

## 6. Riesgos y mitigaciones

| Riesgo                                          | Impacto                                            | Mitigación                                                                                                                                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GCM no instalado o cadena de helpers ajena      | La app no puede guardar tokens                     | Detección temprana, Estado de credenciales, guía para reinstalar Git for Windows con GCM; no sobrescribir la cadena del usuario                                                                                                 |
| Otro helper responde antes que GCM              | Se usa la cuenta o token equivocado                | Detectar la cadena con `git config --get-all credential.helper`, marcar incompatibilidad y pedir intervención explícita; nunca reordenar sin consentimiento                                                                     |
| `useHttpPath=true` previo                       | GCM storage por ruta rompe la selección por cuenta | El config generado fija `useHttpPath=false` en hosts gestionados (pendiente: `core` todavía no escribe el perfil completo, ver requirements M3 de la Fase 1)                                                                    |
| `git credential approve` sale 0 sin guardar     | Pérdida silenciosa del token                       | Verificación obligatoria con `git credential fill` antes de marcar la cuenta como vinculada — **implementado** en `core/features/git-credential`                                                                                |
| Prompt colgado                                  | Bloquea flujo de vinculación o push                | Flags no interactivos, timeout y env limpio; nunca `GIT_ASKPASS` interactivo desde la app — **implementado**, y además se descubrió que GCM hace un _probe_ de red cuando no hay credencial cacheada (`docs/lessons/README.md`) |
| Config local del usuario gana sobre `includeIf` | Identidad o cuenta incorrecta                      | Doctor con `git config --get` dentro del repo; mostrar el origen del valor (Doctor: pendiente)                                                                                                                                  |
| OAuth App restringida por organización          | Repos privados aparecen como "not found"           | Documentar aprobación de la OAuth App o uso de client_id propio de la organización (Fase 2)                                                                                                                                     |
| `electron-menubar` sin mantenimiento            | Mantenimiento de la ventana                        | Acceso a bandeja aislado en un adaptador propio (Fase 3)                                                                                                                                                                        |
| SmartScreen / Smart App Control                 | Bloquea la instalación sin firma                   | Postular a SignPath Foundation; mientras tanto documentar y ofrecer `winget` / Scoop                                                                                                                                            |
| Formato de correo `noreply` distinto            | Commits con identidad rechazada                    | Verificar contra documentación oficial de GitHub/GitLab al implementar proveedores (Fase 2)                                                                                                                                     |

## 7. Decisiones abiertas

1. **`client_id` de la OAuth App de GitHub** — nombre de marca definido en ADR 0005. No se reutiliza el client ID integrado de `@gamcli/gam`. Pendiente de Fase 2.
2. **Formato del correo noreply**: en GitHub, `ID+usuario@users.noreply.github.com` para cuentas nuevas y `usuario@users.noreply.github.com` para antiguas; confirmar el patrón de GitLab contra su documentación oficial. Pendiente de Fase 2.
3. **Aprobación de SignPath Foundation**: gestionar la postulación; el pipeline de release debe estar listo antes de solicitarla. Pendiente de Fase 5.
4. **Notificaciones en instalador real**: verificar `AppUserModelID` + `ToastActivatorCLSID` y el acceso directo del menú Inicio con NSIS, no solo en modo dev. Pendiente de Fase 5.
5. **Target de `electron-vite` 6**: ~~verificar build con Electron 45 y dejar fijado `node24.22 / chrome156`~~ — **resuelta, ver ADR 0002**.
6. **Spike GCM en Git for Windows real**: **parcialmente resuelta** — `approve`→`fill` por `username` confirmado con dos cuentas del mismo host y sin interacción (ver `docs/specs/changes/en-curso/00-spike-base-y-gcm/`). Queda abierto si GitHub exige `x-access-token`: necesita un token real, se resuelve en Fase 2.
7. **TDD frente al orden de gates** (anotada por la skill `spec-first-protocol` 1.6.0, `methodology-digest.md` §5): los tests escritos primero en TDD viven dentro del paso de implementación; el gate de tests sigue corriendo la suite completa después. No cambia el orden de gates definido en `CLAUDE.md`.

## 8. Siguiente paso

Completado hasta aquí: Fase 0 (spike) y Fase 1 (`core`) — ver `docs/specs/changes/en-curso/`. Siguiente: Fase 2 (proveedores GitHub/GitLab) — abrir su change siguiendo el flujo de `CLAUDE.md` (spec antes de código, es no trivial por tocar auth/credenciales).
