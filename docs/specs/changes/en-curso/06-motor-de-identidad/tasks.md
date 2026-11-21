# Tasks — Motor de identidad

Señal de alto riesgo (`includeIf`/identidad): revisión obligatoria en sesión separada antes de mergear, a partir de esta spec + diff — no del historial de la sesión que implementó.

## 1. Región delimitada (M1, M2) — TDD

- [x] RED/GREEN: `parse`/`serialize` (funciones internas) — región ausente, región presente con contenido ajeno antes/después, región vacía
- [x] RED/GREEN: `ensureBackup` — crea el respaldo una sola vez, no lo pisa en la segunda llamada
- [x] RED/GREEN: `updateRegion` — aplica `mutate` solo al contenido de la región, preserva lo de afuera, siempre deja la región al final

**Hallazgo real:** la primera implementación dejaba el contenido agregado *después* de la región (de una escritura manual del usuario) pegado después de la región reescrita, en vez de juntarlo con "lo de afuera" — el test de "mueve la región al final" lo encontró de inmediato. Corregido: `before` y `after` se juntan antes de volver a serializar.

## 2. Resolver la ruta real del config global (M3)

- [x] `resolveGlobalConfigPath` en `src/main/identity.ts`
- [x] Test de integración con `GIT_CONFIG_GLOBAL` de prueba — con contenido previo y con el archivo completamente vacío (fuerza la clave sentinela)

**Hallazgo real:** `--show-origin` cita la ruta al estilo `.gitconfig` (comillas + `\\`) cuando hace falta escapar algo — había que des-escaparla, no tomarla tal cual. Además, un archivo global que ni siquiera existe todavía hace fallar el comando (no devuelve vacío) — son dos casos distintos, los dos cubiertos por test. También se verificó (test dedicado) que la función funciona igual sin pasarle un `env` explícito, con `GIT_CONFIG_GLOBAL` solo heredado del proceso — así es como la llama `main/index.ts` de verdad.

## 3. Perfil por cuenta y cuenta activa (M4) — TDD

- [x] RED/GREEN: `getProfilePath`/`getActiveConfigPath`
- [x] RED/GREEN: `writeAccountProfile` — confirma con `git config --file <perfil> --get user.email` que quedó bien
- [x] RED/GREEN: `setActiveAccount` — escritura atómica (archivo temporal + rename)
- [x] `renderIncludeIfBlock` (helper interno, `core/features/gitconfig`)

**Hallazgo real:** `git config --file` no crea directorios intermedios — `writeAccountProfile` y `setActiveAccount` necesitan `mkdirSync(..., { recursive: true })` antes de escribir, nada lo hacía por sí solo.

## 4. Conectar `selectAccount` (M5)

- [x] El handler ya existente también llama `setActiveAccount`
- [x] Test de integración: activar una cuenta, confirmar con `git config --get user.email` en una carpeta sin fijar (`core/features/identity/end-to-end.test.ts`)

## 5. Fijar/desfijar carpeta (M6)

- [x] IPC nuevos: `pinFolder`, `unpinFolder`, `listPins` en `src/shared/ipc-channels.ts` + handlers en `main`
- [x] `pinFolder`: perfil de la cuenta (si no existe) → `rulesStore.pin` → agregar el `includeIf` a la región
- [x] `unpinFolder`: `rulesStore.unpin` → quitar el `includeIf` de la región (`removeIncludeIfBlock`, nuevo en `region.ts`)
- [x] Test de integración: fijar una carpeta a una cuenta distinta de la activa, confirmar que esa carpeta resuelve su propia identidad; desfijarla, confirmar que vuelve a la activa

**Hallazgo real, el más serio de este change:** `ensureActiveInclude` armaba la línea `[include] path = …` pegando la ruta de Windows (con `\`) como texto suelto — Git interpreta `\` dentro de un valor como inicio de un escape, y `\U` (de `\Users`) no es válido: el config entero quedaba roto ("bad config line"). Lo encontró el test de punta a punta, no uno que solo revisaba el texto esperado. `writeIncludeIf` ya evitaba este problema (normaliza a `/`) pero `ensureActiveInclude` no reutilizó ese criterio al escribirse. Corregido, y agregado un test dedicado en `region.test.ts` que usa Git real (no una comparación de texto) para que esto no se repita en silencio. Detalle completo en `docs/lessons/README.md`.

## 6. `dataDir` real

- [x] `join(homedir(), '.' + brand.dataDir)` (ver design.md) — se crea con `mkdirSync({recursive:true})` donde hace falta, no se asume que ya exista

## 7. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (13 suites, 61 tests)
- [x] `pnpm build` sin error
- [x] Verificación de punta a punta (`core/features/identity/end-to-end.test.ts`, Git real, nunca `~/.gitconfig`): activar cuenta, fijar carpeta a otra cuenta, desfijar, dos carpetas fijadas a cuentas distintas — las cuatro resuelven lo que corresponde. No se hizo contra la app Electron completa porque todavía no hay UI conectada a estos IPC (fuera de alcance, ver proposal.md) — nada que clickear para probarlo end-to-end por ahí.

## 8. Cierre del change

- [x] Los criterios (M1-M6) verificados y anotados acá
- [x] Lecciones anotadas en `docs/lessons/README.md` (región delimitada + ruta de Windows sin escapar, directorios intermedios faltantes, resolución de la ruta global real)
- [x] Actualizar `docs/specs/changes/en-curso/05-ajustes/` para que S5/S6 referencien este change como su dependencia, en vez de reimplementar la orquestación ahí
- [ ] Revisión en sesión separada (señal de alto riesgo) antes de mergear
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
