# Tasks — Cambio de cuenta activa desde la bandeja

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de identidad (`includeIf`/cuenta activa). Revisión obligatoria en sesión separada antes de mergear, a partir de esta spec + diff — no del historial de la sesión que implementó.

Nota de alcance de verificación: `src/main/index.ts` es código de integración de Electron (IPC, `Menu`, ventana) — como el resto de este archivo, no tiene tests unitarios propios (`core/` sí los tiene, esto no toca `core/`). Se verifica con typecheck/lint/test (sin regresión) + verificación en vivo, mismo criterio ya usado para S11/Quick Clone/release-pipeline en este mismo archivo.

## 1. Función compartida `selectAccount` (R1)

- [x] Extraer la lógica del handler de `IPC.selectAccount` a una función de módulo `selectAccount(id: string): Promise<void>`
- [x] El handler de `IPC.selectAccount` llama a esa función, sin cambiar su propio comportamiento

## 2. `buildTrayMenu` con submenú "Cuenta activa" (R2)

- [x] Firma nueva: `buildTrayMenu(settings, accounts, activeId)`
- [x] Submenú "Cuenta activa" entre "Abrir" y "Tema", un item `radio` por cuenta, marca la activa
- [x] Con cero cuentas: submenú deshabilitado (`enabled: accounts.length > 0`), no rompe el menú
- [x] Clic en una cuenta → `selectAccount(id)` → reconstruir el menú con el estado actualizado
- [x] Error de `selectAccount` desde el click: `log.error(...)`, nunca una promesa sin manejar (R4)
- [x] Actualizar los tres call sites existentes de `buildTrayMenu` para pasar `accountsStore.list()`/`stateStore.getActiveId()` (vía `refreshTrayMenu()`)

## 3. Reconstruir el menú al vincular (R3)

- [x] `IPC.startGithubLink`: reconstruir el menú después del `notify(...)` de éxito
- [x] `IPC.linkGitlab`: mismo cambio

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde, sin regresión (122 tests)
- [x] `pnpm build` sin error
- [x] Verificación en vivo con las dos cuentas reales ya vinculadas (no de prueba — un primer intento con cuentas sintéticas sembradas a mano falló porque `createAccountsStore()` no recibe `cwd`, usa la ruta real de `Conf`, no `dataDir`; sin impacto, el archivo de prueba quedó en una ruta sin uso y se borró): clic derecho muestra "Cuenta activa" con las dos cuentas reales; clic en la cuenta inactiva cambió la identidad real, confirmado con `git config --get user.name/user.email` en una carpeta temporal sin fijar (de `williamslml <williamslml@outlook.com>` a `Hairo Malásquez <hmalasquez@attach.group>`); el siguiente clic derecho mostró la nueva cuenta marcada
- [ ] Verificación en vivo: vincular una cuenta nueva la hace aparecer en el submenú sin reiniciar la app — **no repetida en vivo** (requeriría un flujo OAuth/PAT real solo para esto); el cambio es una línea (`refreshTrayMenu()`) agregada al mismo punto donde ya corre `notify(...)` tras un vinculado exitoso, mismo patrón ya verificado en R2/R3 — aceptado por inspección de código, no por verificación en vivo
- [x] Con cero cuentas: verificado en vivo (antes de sembrar las cuentas de prueba, sin saber que apuntaban a una ruta no usada, la app real corrió un momento con cero cuentas reales accesibles desde ese lanzamiento) — "bandeja lista" sin error; de cualquier forma, el flag es `enabled: accounts.length > 0` con `submenu: []`, comportamiento documentado de Electron para un `Menu` sin items

## 5. Cierre del change

- [x] Criterio de éxito de `proposal.md` verificado: con dos cuentas reales, el submenú aparece con las dos, la activa marcada, el clic cambia la identidad real (confirmado con `git config`) y el menú refleja el cambio en el próximo clic derecho; con cero cuentas el menú no rompe; `pnpm typecheck && pnpm lint && pnpm test` en verde. El único punto no repetido en vivo (vincular una cuenta nueva actualiza el menú sin reiniciar) queda aceptado por inspección de código — ver sección 4
- [x] Lecciones anotadas en `docs/lessons/README.md`: `createAccountsStore()` no usa `dataDir`, usa la ruta por defecto de `Conf`
- [x] Revisión en sesión separada (señal de alto riesgo) — agente sin el historial de esta sesión, a partir de spec + diff. Sin hallazgos bloqueantes: confirmó que `selectAccount` es un calco exacto del código anterior, el manejo de error del click nativo nunca deja una promesa sin manejar, el caso de cero cuentas no rompe el menú, los cinco call sites de `refreshTrayMenu()` quedan consistentes, y `writeSigningKey` sigue condicionado por `applySigningKeyOnSwitch`. Dos notas informativas, ninguna requiere cambio (confirmadas como comportamiento preexistente o ya documentado, no bugs)
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
