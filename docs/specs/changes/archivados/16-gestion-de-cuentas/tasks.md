# Tasks — Gestión de cuentas: desvincular y clave de firma

Señal de alto riesgo (`includeIf`/perfiles de identidad): revisión obligatoria en sesión separada antes de mergear.

## 1. `core` (F1, F2)

- [x] `accountToProfileValues`/`writeAccountProfile` con config de firma + regeneración completa del perfil
- [x] `clearSigningKey` en `AccountsStore`
- [x] `removeLinkedAccount` en `core/features/account-lifecycle/` (nuevo)
- [x] Tests: `identity.test.ts` (+3: con firma, sin firma, sacar firma borra la config vieja) · `accounts.test.ts` (+2: quitar firma, quitar firma de id inexistente) · `account-lifecycle.test.ts` (4, nuevo: cascada completa, sin carpetas fijadas, dos carpetas, id inexistente)

## 2. IPC (F3)

- [x] `setSigningKey`/`clearSigningKey`/`removeAccount` en `ipc-channels.ts`, handlers en `main/index.ts` (usan `removeLinkedAccount`, nunca reimplementan la cascada), preload

## 3. Renderer (F4)

- [x] `AccountFoldersDialog.tsx`: `SigningKeySection` (asignar/quitar)
- [x] `AccountCard.tsx`: botón de desvincular habilitado
- [x] `RemoveAccountDialog.tsx` (nuevo): confirmación explícita, muestra cuántas carpetas se desfijan
- [x] `App.tsx`: estado + render de `RemoveAccountDialog`

## 4. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde (20 archivos, 142 tests)
- [x] `pnpm electron-vite build` + verificación en vivo con Playwright (`_electron`):
  - Clave de firma: asignada vía UI real a la cuenta de GitHub real, confirmado el contenido exacto del perfil (`user.signingkey`/`gpg.format`/`commit.gpgsign`) en cada paso; quitada de nuevo, confirmado que el perfil vuelve a su estado original exacto. **Hallazgo real de la propia verificación**: 800ms no alcanza para las 7 escrituras secuenciales de `git config --file` (7 procesos externos) — una espera corta da un falso negativo (parece que no escribió nada); con una espera generosa (4s) el resultado es el esperado. No es un bug de la app, fue un error del script de verificación.
  - Desvincular: diálogo abre, muestra el aviso correcto (sin carpetas fijadas en este caso), cancelar no tiene efecto (mismo número de cuentas antes/después). La confirmación real nunca se probó contra la cuenta de producción (irreversible sin re-vincular a mano) — la cascada de limpieza queda cubierta por los 4 tests de integración con Git real

## 5. Cierre del change

- [x] Revisión en sesión separada (señal de alto riesgo) — sin hallazgos bloqueantes. Confirmó (typecheck/lint/test propios, 142 tests en verde) que la clave de firma se arma correctamente para los dos formatos, que `clearSigningKey` no tiene efectos secundarios, que `removeLinkedAccount` nunca toca GCM/el token real (grep sobre todo el diff), que el camino feliz de la cascada es correcto, y que `RemoveAccountDialog` nunca se autodispara (el clic en la tarjeta solo abre el diálogo; "Desvincular" es la única acción que llama al IPC real). Dos hallazgos no bloqueantes, los dos corregidos: (1) el orden `unpin` → sacar `includeIf` hacía que un reintento tras una falla a mitad de camino (config global bloqueado) ya no encontrara la regla para terminar de limpiar el `includeIf` huérfano — invertido: ahora se saca el `includeIf` primero, recién después se desfija; (2) `removeAccount` en `store.ts` no recargaba `$pins` tras desvincular (invisible en la práctica porque el próximo diálogo ya lo hace, pero inconsistente con el resto de `store.ts`) — agregado `await loadPins()`
- [x] Merge con `finishing-a-development-branch` — mergeado localmente a `main` (fast-forward, sin conflictos, incluye los 2 fixes de la revisión), `pnpm typecheck && pnpm lint && pnpm test` en verde sobre el resultado (142 tests), rama `feat/gestion-de-cuentas` borrada
- [x] Mover la spec a `../archivados/`
