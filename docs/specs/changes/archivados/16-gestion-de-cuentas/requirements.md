# Requirements — Gestión de cuentas

## F1. Clave de firma, parte del perfil

- F1.1: con `signingKey` asignada, el perfil generado tiene `user.signingkey`, `gpg.format` (según el formato) y `commit.gpgsign = true`.
- F1.2: sin `signingKey`, el perfil no tiene ninguna de esas tres claves.
- F1.3: sacar una clave ya asignada borra esas tres claves del perfil (nunca quedan de una asignación anterior).
- F1.4: `clearSigningKey` con un id inexistente lanza, igual que `setSigningKey`.

## F2. Desvincular cuenta

- F2.1: `removeLinkedAccount` desfija todas las carpetas de la cuenta (`rulesStore.unpin`) y saca su bloque `includeIf` de la región, antes de borrar la cuenta.
- F2.2: borra el archivo de perfil de la cuenta.
- F2.3: nunca toca GCM/el token real.
- F2.4: una cuenta sin carpetas fijadas se borra igual, sin lanzar.
- F2.5: un id inexistente no lanza (mismo criterio que `accountsStore.remove`).

## F3. IPC

- F3.1: `setSigningKey`/`clearSigningKey` regeneran el perfil (llaman `writeAccountProfile`) antes de devolver el estado — nunca queda desincronizado.
- F3.2: `removeAccount` usa `removeLinkedAccount`, nunca reimplementa la cascada en `main`.

## F4. UI

- F4.1: la sección de clave de firma vive en `AccountFoldersDialog.tsx` (donde ya se eligen las carpetas), no en un lugar aparte.
- F4.2: el botón de desvincular de `AccountCard.tsx` abre una confirmación explícita (`RemoveAccountDialog`), que muestra cuántas carpetas se van a desfijar si hay alguna.
- F4.3: cancelar la confirmación no tiene ningún efecto.

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo: clave de firma asignada/quitada en una cuenta real, confirmado el contenido exacto del perfil en cada paso, revertido al final. Diálogo de desvincular verificado en vivo (abre, aviso correcto, cancela sin efecto) — la confirmación real no se ejecuta contra una cuenta de producción; la cascada de limpieza queda cubierta por tests de integración con Git real.
