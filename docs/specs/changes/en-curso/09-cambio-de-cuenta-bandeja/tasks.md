# Tasks — Cambio de cuenta activa desde la bandeja

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de identidad (`includeIf`/cuenta activa). Revisión obligatoria en sesión separada antes de mergear, a partir de esta spec + diff — no del historial de la sesión que implementó.

Nota de alcance de verificación: `src/main/index.ts` es código de integración de Electron (IPC, `Menu`, ventana) — como el resto de este archivo, no tiene tests unitarios propios (`core/` sí los tiene, esto no toca `core/`). Se verifica con typecheck/lint/test (sin regresión) + verificación en vivo, mismo criterio ya usado para S11/Quick Clone/release-pipeline en este mismo archivo.

## 1. Función compartida `selectAccount` (R1)

- [ ] Extraer la lógica del handler de `IPC.selectAccount` a una función de módulo `selectAccount(id: string): Promise<void>`
- [ ] El handler de `IPC.selectAccount` llama a esa función, sin cambiar su propio comportamiento

## 2. `buildTrayMenu` con submenú "Cuenta activa" (R2)

- [ ] Firma nueva: `buildTrayMenu(settings, accounts, activeId)`
- [ ] Submenú "Cuenta activa" entre "Abrir" y "Tema", un item `radio` por cuenta, marca la activa
- [ ] Con cero cuentas: submenú deshabilitado, no rompe el menú
- [ ] Clic en una cuenta → `selectAccount(id)` → reconstruir el menú con el estado actualizado
- [ ] Error de `selectAccount` desde el click: `log.error(...)`, nunca una promesa sin manejar (R4)
- [ ] Actualizar los tres call sites existentes de `buildTrayMenu` para pasar `accountsStore.list()`/`stateStore.getActiveId()`

## 3. Reconstruir el menú al vincular (R3)

- [ ] `IPC.startGithubLink`: reconstruir el menú después del `notify(...)` de éxito
- [ ] `IPC.linkGitlab`: mismo cambio

## 4. Verificación

- [ ] `pnpm typecheck && pnpm lint && pnpm test` en verde, sin regresión en los tests existentes de `IPC.selectAccount` (si los hay) ni del resto de la suite
- [ ] `pnpm build` sin error
- [ ] Verificación en vivo (dev, con al menos dos cuentas reales vinculadas): el submenú aparece con las dos, la activa marcada; clic en la otra cambia `user.email` real (confirmado con `git config` en una carpeta sin fijar); el próximo clic derecho ya muestra la nueva marcada
- [ ] Verificación en vivo: vincular una cuenta nueva la hace aparecer en el submenú sin reiniciar la app
- [ ] Verificación en vivo o por inspección: con cero cuentas, el menú no rompe

## 5. Cierre del change

- [ ] Criterio de éxito de `proposal.md` verificado y anotado acá
- [ ] Lecciones anotadas en `docs/lessons/README.md` si algo no obvio ocurrió
- [ ] Revisión en sesión separada (señal de alto riesgo) antes de mergear
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
