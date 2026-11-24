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

- [ ] Revisión en sesión separada (señal de alto riesgo)
- [ ] Merge con `finishing-a-development-branch`
- [ ] Mover la spec a `../archivados/`
