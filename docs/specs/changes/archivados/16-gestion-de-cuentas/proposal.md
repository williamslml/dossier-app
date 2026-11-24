# Proposal — Gestión de cuentas: desvincular y clave de firma

**Señal de alto riesgo** (`CLAUDE.md`): toca `includeIf`/perfiles de identidad (escribe y borra bloques, regenera perfiles) — revisión obligatoria en sesión separada antes de mergear.

## Por qué

Dos pendientes de `docs/product.md` §2:

1. **Desvincular cuenta**: el botón ya existía en `AccountCard.tsx`, deshabilitado ("próximamente"). `accountsStore.remove()` (core) ya existe desde Fase 1 — nunca se conectó a nada.
2. **Clave de firma como parte del perfil de la cuenta**: decisión de diseño ya tomada y documentada (el switch global viejo se sacó junto con "cuenta activa") — "cualquier carpeta fijada a esa cuenta firma automáticamente con su clave". `accountsStore.setSigningKey()` (core) también existe desde `05-ajustes` — pero **nunca se escribía en el perfil real** (`accountToProfileValues` no incluía ningún campo de firma): asignar una clave no tenía ningún efecto real en Git hasta este change.

## Qué cambia

1. **`core/features/identity/identity.ts`**: `accountToProfileValues` agrega `user.signingkey`/`gpg.format`/`commit.gpgsign` cuando la cuenta tiene `signingKey`. `writeAccountProfile` borra el perfil antes de regenerarlo (hallazgo real: `writeProfileConfig` nunca hace `unset`, así que sacar una clave después de asignarla dejaba basura del perfil anterior).
2. **`core/features/accounts/accounts.ts`**: `clearSigningKey(id)` — no existía forma de sacar una clave ya asignada.
3. **`core/features/account-lifecycle/account-lifecycle.ts`** (nuevo): `removeLinkedAccount` — desvincular una cuenta también desfija sus carpetas y saca sus bloques `includeIf` (nunca deja una carpeta apuntando a un perfil que ya no corresponde a nada), y borra el archivo de perfil. **Nunca toca el token en GCM** — desvincular y revocar son dos decisiones distintas, ya resueltas por separado ("Credenciales huérfanas", `05-ajustes`).
4. **IPC**: `setSigningKey`, `clearSigningKey`, `removeAccount`.
5. **UI**:
   - `AccountFoldersDialog.tsx` (el lugar donde ya se eligen las carpetas de una cuenta, por pedido explícito del usuario en una sesión anterior): sección "Clave de firma de commits" — asignar (formato + ID de clave) o quitar.
   - `AccountCard.tsx`: el botón de desvincular, ya no deshabilitado. Abre `RemoveAccountDialog` (nuevo) con confirmación explícita, nunca un solo clic.

## Qué NO cambia / queda fuera

- **Dossier nunca genera ni importa una clave** — solo referencia una ya existente (`~/.ssh/...pub` o un fingerprint OpenPGP), igual que documenta el tipo `Account.signingKey` desde que existe.
- **Desvincular nunca borra el token de GCM** — queda como huérfana, limpiable a propósito desde Ajustes (ya existente).
- **Ningún escaneo ni validación de que la clave realmente exista/sea válida** — Dossier no tiene forma de verificar eso de forma segura y multiplataforma; si la clave no existe, `git commit` fallará con su propio error real, igual que sin Dossier de por medio.

## Riesgos

- **Perder la cascada de limpieza** (carpeta fijada a una cuenta ya borrada, `includeIf` huérfano apuntando a un perfil que ya no existe): por eso `removeLinkedAccount` desfija y saca el `includeIf` de cada carpeta antes de borrar la cuenta, nunca al revés.
- **Clave de firma vieja sobreviviendo en el perfil tras sacarla**: por eso `writeAccountProfile` regenera el archivo entero, nunca acumula.
- **Desvincular sin confirmar**: es destructivo (desfija carpetas) — `RemoveAccountDialog` exige un clic explícito de confirmación, mostrando cuántas carpetas se van a desfijar.

## Criterio de éxito

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo: asignar y quitar una clave de firma real en una cuenta real (reversible, confirmado que el perfil generado tiene exactamente lo esperado en cada paso, y que vuelve a su estado original al quitarla). El diálogo de desvincular se verificó en vivo (abre, muestra el aviso correcto, cancela sin efecto) — **la confirmación real nunca se ejecutó contra una cuenta de producción** (es irreversible sin volver a vincular manualmente); la cascada de limpieza se verificó con 4 tests de integración con Git real en `core/features/account-lifecycle/account-lifecycle.test.ts`.
