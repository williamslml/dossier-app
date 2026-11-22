# Requirements — Detección de almacén de secretos ausente

## S1. `core`: `checkSecretStoreHealth`

- S1.1: usa un host reservado `.invalid` + username/password aleatorios por corrida — nunca toca una cuenta real.
- S1.2: `approve` → `fill` → compara el valor devuelto contra el guardado; si coincide, `{ healthy: true }`.
- S1.3: si el valor leído no coincide, o cualquier paso lanza, `{ healthy: false, detail: <mensaje legible> }` — nunca deja que la excepción se propague.
- S1.4: `reject` corre siempre al final (éxito o error), con su propio catch silencioso — nunca deja la credencial de prueba en el Credential Manager real.

## S2. IPC

- S2.1: `checkSecretStore`, sin payload, llama a la función de `core`.

## S3. UI — `AddButtons.tsx`

- S3.1: clic en "GitHub" o "GitLab" corre el chequeo antes de abrir el diálogo correspondiente.
- S3.2: mientras se verifica, los dos botones quedan deshabilitados (nunca dos chequeos en paralelo).
- S3.3: si `healthy: false`, nunca se abre el diálogo — un toast explica el problema con el detalle real.
- S3.4: si `healthy: true` (el caso normal), el diálogo se abre exactamente igual que antes de este cambio.

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo con GCM real de esta máquina: `healthy: true` dos veces seguidas, sin credenciales de prueba residuales; abrir los diálogos de vincular sigue funcionando igual.
