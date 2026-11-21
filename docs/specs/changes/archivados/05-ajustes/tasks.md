# Tasks — Ajustes

**Parte 1 (secciones 1-6):** no es señal de alto riesgo. **Parte 2 (secciones 7-13):** sí agrega una señal de alto riesgo (`includeIf`, identidad de commit, clave de firma, limpieza de GCM) — revisión obligatoria en sesión separada antes de mergear esa parte, a partir de esta spec + diff, no del historial de la sesión que implementó.

## 1. `core/features/settings/` (S1) — TDD

- [x] RED: `createSettingsStore` con `cwd` aislado (patrón de `accounts.test.ts`) — `get()` devuelve los valores por defecto, `update()` fusiona sin pisar lo que no se manda
- [x] GREEN: implementar `createSettingsStore`
- [x] Wire en `core/index.ts`

## 2. Variables CSS y tema oscuro (base para S3.3)

- [x] Verificar si `index.html` ya tiene los colores como variables `:root` — no las tenía; se extrajeron todas (ver design.md)
- [x] Agregar el bloque `:root[data-theme='oscuro']` con los mismos tokens en su versión oscura

**Hallazgo real:** el avatar de cada cuenta tiene un color de fondo propio (no depende del tema) — su texto blanco se dejó como literal a propósito, no como variable, para no heredar el token reactivo por error (ver comentario en `index.html`).

## 3. IPC y tema en `main` (S2)

- [x] Canales nuevos en `src/shared/ipc-channels.ts`: `getSettings`, `setSettings`, `themeUpdated` (evento)
- [x] `nativeTheme.themeSource` aplicado al iniciar, desde `settingsStore.get().theme`
- [x] Handler `getSettings`: `launchAtStartup` sale de `app.getLoginItemSettings()`, no del store (S2.1); además devuelve `shouldUseDarkColors` real
- [x] Handler `setSettings`: valida con `zod`, aplica `app.setLoginItemSettings`/`nativeTheme.themeSource` antes de guardar
- [x] Reenvío del evento `nativeTheme.on('updated', …)` al renderer

## 4. Preload (S4)

- [x] `getSettings`, `setSettings`, `onThemeUpdated` en `DossierApi`

## 5. Renderer — pantalla de Ajustes (S3)

- [x] Nuevo átomo `$screen` (`'principal' | 'ajustes'`) y `$settings`/`loadSettings`/`updateSettings`/`subscribeThemeUpdates` en `store.ts`
- [x] `TitleBar.tsx`: el botón de engranaje deja de estar `disabled`; cambia a flecha "Volver" cuando `screen === 'ajustes'` (nuevo ícono `icon-arrow-left`)
- [x] Componente `Ajustes.tsx`: sección Apariencia (Claro/Oscuro/Según el sistema), sección Inicio (interruptor), sección Acerca de (versión, nuevo campo `version` en `DossierState`/`getState()`), estado de GCM (reusa `.footer-status`/`.status-dot` de `Footer.tsx`)
- [x] Wire en `App.tsx`: `$screen` decide qué se renderiza; `loadSettings()`/`subscribeThemeUpdates()` al montar
- [x] Elegir un tema en la UI llama `updateSettings` y aplica el atributo de inmediato

## 6. Verificación (Parte 1)

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (10 suites, 43 tests)
- [x] `pnpm build` sin error
- [x] Verificación en vivo (CDP): abrir Ajustes, cambiar a Oscuro y volver a Claro — el atributo `data-theme` y los colores calculados cambian correctamente
- [ ] Verificación en vivo de "Inicio con el sistema" (**requiere tu aprobación explícita**: toca `app.setLoginItemSettings`, un cambio real de arranque de Windows — el sandbox de la sesión ya bloqueó un intento automático de probarlo por este motivo, correctamente)

---

## 7. Reglas por carpeta desde Ajustes (S5)

**`listPins`/`pinFolder`/`unpinFolder` ya existen en `main`, construidos en `docs/specs/changes/en-curso/06-motor-de-identidad/`** — no reimplementar, solo conectar:

- [x] IPC `pickFolder` (`main`, nuevo — no lo agregó `06-motor-de-identidad`)
- [x] Exponer `pinFolder`/`unpinFolder`/`listPins`/`pickFolder` en el preload (`DossierApi`)
- [x] ~~Sección "Carpetas" en `Ajustes.tsx`~~ — **rediseñado tras feedback de uso real** (ver abajo): en vez de una sección en Ajustes con "carpeta primero, cuenta después", cada cuenta en la pantalla principal tiene un botón "Carpetas de esta cuenta" que abre `AccountFoldersDialog.tsx` (modal), ya con la cuenta fijada: lista + agregar (solo la carpeta) + mensaje claro si la promesa rechaza con `FolderOverlapError`

**Verificado en vivo (CDP):** el diálogo abre desde el botón nuevo en `AccountCard.tsx`, muestra el título "Carpetas de {cuenta}", el estado vacío correcto y el botón "+ Agregar carpeta"; `listPins()` responde de verdad contra el `rulesStore` real, a través de todo el camino de IPC. No se probó el flujo de agregar una carpeta en vivo (abre un diálogo nativo de Windows que no se puede cerrar de forma automatizada) — queda cubierto por los tests de integración de `06-motor-de-identidad`.

## 8. Clave de firma al cambiar de cuenta (S6)

**`selectAccount` ya llama `setActiveAccount` (`06-motor-de-identidad`)** — esto solo agrega la clave de firma al mismo perfil, no el mecanismo de cuenta activa:

- [x] Campo `applySigningKeyOnSwitch` en `Settings`
- [x] Campo `signingKey` opcional en `Account` (`core/features/accounts`) — quedó ahí, con `setSigningKey` (mismo patrón que `rename`)
- [x] `writeSigningKey` en `core/features/identity` (mismo `active.gitconfig` que `setActiveAccount` ya escribe, `getActiveConfigPath`)
- [x] `selectAccount` (handler de `main`, ya existente) aplica la clave si `applySigningKeyOnSwitch` está activo, después de `setActiveAccount`
- [x] Interruptor en Ajustes, apagado por defecto

**Pendiente, anotado a propósito (no se construyó en esta sección):** todavía no hay ninguna pantalla para asignarle una clave de firma a una cuenta — `AccountsStore.setSigningKey` existe y está probado, pero nada en la UI lo llama. El interruptor de Ajustes queda visible pero sin efecto hasta que exista esa UI (se documentó así en el propio texto de Ajustes, no se ocultó el hueco).

## 9. Comportamiento al clonar (S7) — revertido

- [x] ~~Campos `defaultCloneFolder`/`isolateAccountOnClone` en `Settings`~~
- [x] ~~UI en Ajustes (sin lógica de clonado, `cloneRepo` no existe todavía)~~

**Revertido a propósito, no es un bug:** decidiste que Quick Clone va a pedir carpeta y cuenta en el momento de clonar (mismo patrón que `AccountFoldersDialog`, sección 7), no desde una preferencia global en Ajustes — no hace falta "carpeta por defecto" ni "aislar cuenta" como settings aparte. Se sacaron los dos campos de `Settings`, del store del renderer y de la sección "Próximamente" de Ajustes; `pnpm typecheck && pnpm lint && pnpm test && pnpm build` en verde después de sacarlos.

**Hallazgo real de paso:** el interruptor de "Firmar commits con la clave de la cuenta" (S6) nunca persistía — el schema de `IPC.setSettings` en `main` no incluía `applySigningKeyOnSwitch`, así que zod lo descartaba en silencio antes de llegar a `settingsStore.update`. Se agregó al schema y a `applySettings`.

## 10. Integración con Windows ampliada (S8)

- [x] Texto informativo en Ajustes sobre "cerrar oculta a la bandeja, no cierra la app" (distinto de minimizar, que va a la barra de tareas) — ya existe, no es un interruptor nuevo (corregido: el texto original confundía los dos verbos)
- [x] Atajo de teclado global (`globalShortcut`, `Ctrl+Shift+D`) para mostrar/ocultar la ventana

**Verificado:** typecheck/lint/test/build en verde; registro confirmado por ausencia del log de error (`globalShortcut.register` devuelve `false` y se loguea si otra app ya usa la combinación — no se logueó nada). No se probó presionando la combinación física real: CDP no puede simular atajos globales de SO, solo eventos dentro de la página.

## 11. Mantenimiento de credenciales (S9)

- [x] **Probado en vivo contra el binario real** (`git-credential-manager.exe --help`): no hay listado genérico, pero sí `github list` (específico de GitHub) — GitLab y otros hosts no tienen equivalente. Diseño actualizado en consecuencia (ver design.md).
- [x] `AccountsStore.remove` ahora recuerda host+username (único rastro para hosts sin listado propio)
- [x] `core/features/credential-maintenance`: `findOrphans` (pura, combina GitHub real + recordado, sin duplicar ni marcar como huérfana una cuenta re-vinculada)
- [x] Acción de limpieza con confirmación explícita, reusando `runGitCredential('reject', …)`
- [x] IPC `listOrphanedCredentials`/`removeOrphanedCredential` + sección en Ajustes

**Verificado en vivo:** la llamada real a `github list` a través de todo el camino de IPC (main → preload → renderer) no rompe nada; un fallo ahí se loguea, ya no queda en silencio total. No se pudo probar con una cuenta de GitHub huérfana real (el sandbox de la sesión bloquea correctamente tocar credenciales reales de GitHub) — cubierto por los tests de `findOrphans` con datos sintéticos.

## 12. Menú de la bandeja (S10)

- [x] Factorizar `setSettings` para que tanto el handler de IPC como el menú llamen la misma función (`applySettings`)
- [x] Submenú "Tema" (radio) + ítem "Inicio con Windows" (checkbox) en el menú de la bandeja
- [x] El menú se reconstruye en cada cambio, no solo al iniciar

**Verificado por vos en vivo:** confirmaste el menú de la bandeja funcionando ("la bandeja está genial"). Se sacó además "Probar notificación" (ítem de prueba de un change anterior, ya sin motivo para estar — ver sección 13) y el ícono de la bandeja pasó de un PNG plano a `app-icon.ico` (multi-tamaño), con el glifo rebalanceado tras comparar lado a lado con el ícono de otra app en la bandeja real.

## 13. Rediseño de Ajustes (feedback de uso real, no estaba en el plan original)

**Hallazgo real:** después de completar las secciones 7-10 una por una, la pantalla de Ajustes quedó con demasiado texto explicativo (tu feedback: "no estás respetando la ui & uix, [...] muy horrible, hay mucho texto"). Se rehizo la pantalla completa, no un parche puntual:

- [x] Se saca la sección "Carpetas" de Ajustes — ver sección 7, ahora vive en un diálogo por cuenta (`AccountFoldersDialog.tsx`) desde la pantalla principal
- [x] Se funden "Gestor de credenciales" + "Mantenimiento de credenciales" en una sola sección "Credenciales"
- [x] Se agrupan los dos campos sin efecto todavía (clave de firma al cambiar de cuenta, preferencias de clonado) en una sola sección "Próximamente", visualmente atenuada, con un único texto explicativo en vez de tres párrafos repartidos
- [x] Se recorta el texto de "Inicio" de 4 oraciones a una sola línea (ya no hace falta explicar minimizar/cerrar en detalle, ahora se comportan como cualquier aplicación estándar — ver sección 10/11)
- [x] Se quita el `text-transform: uppercase` de los títulos de sección (ver `frontend-design`: es un tic típico de diseño genérico)
- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` en verde
- [x] Verificado en vivo (CDP/DOM): cinco secciones en el orden correcto (Apariencia, Inicio, Credenciales, Próximamente, Acerca de) y el diálogo de carpetas por cuenta abre con el contenido correcto

## 14. Guardia de identidad por carpeta (S11) — señal de alto riesgo

- [x] `core/features/identity-guard/`: instala/verifica `pre-commit`+`pre-push`, detecta un hook ajeno y no lo pisa (`installHook`/`uninstallHook`, 14 tests con TDD, incluye integración con Git real)
- [x] Script del hook: compara identidad esperada (`user.email` real de esa cuenta) vs. real (`git config user.email`), código de salida + mensaje en texto plano, sin depender de que Dossier esté corriendo
- [x] Registro de conflicto (un archivo por carpeta en conflicto, `<dataDir>/identity-conflicts/<hash>.json`) que `main` relee en cada `after-show` — nunca una espera en vivo
- [x] Notificación con Aplicar/Bloquear/Reconectar — tarjeta en la pantalla principal (`IdentityConflicts.tsx`), no notificación nativa de Windows; las tres acciones visibles a la vez (decisión en requirements.md S11.5)
- [x] Interruptor "Guardia de identidad" por regla en `AccountFoldersDialog`, apagado por defecto

**Verificado en vivo, de punta a punta, con un repo temporal real** (no solo los tests automatizados): `pinFolder` + `setEnforced` reales desde la app → el hook queda escrito en `.git/hooks/` → un commit con `user.email` correcto pasa, uno con otro distinto se corta con el mensaje esperado y deja el registro de conflicto → la tarjeta aparece en la pantalla principal con el texto y los tres botones correctos → "Bloquear" la limpia y la hace desaparecer → `setEnforced(..., false)` saca los hooks → `unpinFolder` limpia todo.

**Revisión en sesión separada (agente independiente, sin el historial de esta sesión, a partir de spec+diff — como pide `CLAUDE.md` para esta señal de alto riesgo):** un hallazgo bloqueante y tres importantes, los cuatro corregidos antes de cerrar esta sección:

- **Bloqueante — corregido:** "Aplicar" reasignaba la regla a la cuenta correcta pero nunca reinstalaba los hooks con el nuevo email esperado (el email queda grabado como texto en el script al instalarlo, no se relee de `rules.json` — ver S11.3 en requirements.md). El mismo commit que "Aplicar" decía resolver seguía cortándose después. Fix: `src/main/index.ts`, rama `aplicar` de `IPC.resolveIdentityConflict` ahora reinstala los hooks (misma función `installHooks` que usa `setEnforced`) si `rule.enforced` sigue activo. **Verificado en vivo** con un repo temporal real: conflicto → Aplicar → el mismo commit que antes se cortaba ahora pasa.
- **Importante — corregido:** errores de `resolveIdentityConflict`/`removeOrphanedCredential` no llegaban a la UI (promesas sin manejar). `IdentityConflicts.tsx` y la sección de credenciales huérfanas en `Ajustes.tsx` ahora muestran el error con el mismo patrón ya usado en `AccountFoldersDialog.tsx` (try/catch + estado de error).
- **Importante — corregido:** `IPC.removeOrphanedCredential` no revalidaba en `main` que la credencial fuera realmente huérfana antes de borrarla (confiaba en que la UI solo ofreciera el botón para las correctas). Ahora revalida contra `findOrphans()` del lado de `main` antes de ejecutar `reject`.
- **Importante — corregido:** `buildHookScript`/`installHook` no tenían ningún test con caracteres que importan para un shell (comillas, `$`, backtick, espacios) — justo lo que `escapeForDoubleQuotedShell` existe para neutralizar. Se agregaron dos tests de integración con Git real (ruta con espacios; email con comillas/`$`/backtick) — confirmaron que el escape ya era correcto, no había una inyección real, pero tampoco había evidencia de eso antes.
- Hallazgos menores (sin acción, documentados en el reporte de la revisión): `json_escape` del hook no escapa saltos de línea (no alcanzable en la práctica — Windows no permite `\n` en rutas de archivo); `writeSigningKey` nunca escribe `commit.gpgsign` (ya anotado como hueco pendiente en la sección 8, sin UI que lo necesite todavía).

## 15. Verificación (Parte 2)

- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` en verde (105 tests)
- [x] Verificación en vivo con un repo temporal real: commit con la cuenta equivocada se corta, con el mensaje esperado; Aplicar/Bloquear funcionan (ver sección 14); un `pre-commit` ajeno no se pisa (cubierto por tests)

## 16. Cierre del change

- [x] Los criterios de Parte 1 y Parte 2 verificados y anotados acá
- [x] Lecciones anotadas en `docs/lessons/README.md` si algo no obvio ocurrió
- [x] Revisión en sesión separada de la Parte 2 (señal de alto riesgo) antes de mergear — hecha, 1 hallazgo bloqueante + 3 importantes, todos corregidos y verificados
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
