# Requirements — Doctor

## D1. `core`: `runDoctor`

- D1.1: un `DoctorCheck` por cada `Rule` de `rulesStore.list()`, nunca escribe nada.
- D1.2: si la cuenta fijada (`rule.accountId`) ya no existe en `accountsStore`, `ok: false` con detalle, sin lanzar.
- D1.3: si la carpeta ya no existe en el disco, `ok: false` con detalle, sin lanzar.
- D1.4: si la carpeta tiene `.git` (archivo o carpeta — cubre worktrees): `hasRepo: true`, compara `user.email` y `credential.<host>.username` resueltos por Git contra la cuenta; `ok` solo si los dos coinciden.
- D1.5: si la carpeta NO tiene `.git`: `hasRepo: false`, compara el `user.email` del archivo de perfil (`getProfilePath`) contra la cuenta; si el archivo no existe, `ok: false`.
- D1.6: sin ninguna carpeta fijada, devuelve `[]`.

## D2. IPC

- D2.1: `runDoctor` sin payload, llama a la función de `core` con `rulesStore`/`accountsStore`/`dataDir` reales de `main/index.ts`.

## D3. UI — sección "Doctor" en `Ajustes.tsx`

- D3.1: se verifica sola al entrar a la pantalla de Ajustes (igual que "Credenciales huérfanas").
- D3.2: botón "Verificar de nuevo", deshabilitado mientras carga.
- D3.3: sin ninguna carpeta fijada: "No hay carpetas fijadas todavía.", nunca una lista vacía sin explicación.
- D3.4: cada resultado muestra la carpeta, la cuenta (y si no tiene repo todavía), y un ✓/✗; si falla, el detalle legible debajo.

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo de solo lectura (Playwright `_electron`): `runDoctor()` contra las carpetas fijadas reales, comparado a mano con `git config --get user.email` en esas mismas carpetas.
