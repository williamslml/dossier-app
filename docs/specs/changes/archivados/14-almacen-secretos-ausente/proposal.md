# Proposal — Detección de almacén de secretos ausente

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de credenciales/GCM (round-trip real de `approve`/`fill`/`reject` contra un host de prueba) — revisión obligatoria en sesión separada antes de mergear.

## Por qué

`docs/product.md` §2 y tabla de riesgos: "Detección de almacén de secretos ausente con bloqueo del guardado y aviso (defensivo; no se publica para Linux)" — listado, sin implementar. `12-gcm-detectado` ya confirma que GCM está *configurado* (`credential.helper` incluye `manager`), pero no confirma que GCM pueda de verdad *guardar y leer* algo — en Windows, GCM usa Windows Credential Manager, casi siempre disponible, pero "casi siempre" no es una garantía. Hoy, si el almacén de secretos real fallara, el usuario lo descubriría recién al final de vincular una cuenta (Device Flow completo o token de GitLab ya pegado), con un error genérico.

## Qué cambia

1. **`core/features/git-credential/git-credential.ts`**: `checkSecretStoreHealth()` — guarda un valor descartable en un host reservado `.invalid` (nunca choca con cuentas reales), lo relee, confirma que coincide, y siempre lo borra al final (pase lo que pase). Reusa `runGitCredential`, nada nuevo a nivel de protocolo.
2. **IPC**: `checkSecretStore` (sin payload).
3. **`AddButtons.tsx`**: antes de abrir el diálogo de vincular GitHub o GitLab, corre el chequeo. Si falla, nunca abre el diálogo — un toast explica que no se puede vincular ahora mismo, con el detalle real del error.

## Qué NO cambia / queda fuera

- **No reemplaza la verificación ya existente dentro de `saveLinkedAccount`** (`fill` antes de crear la cuenta, ya implementado) — esta es una capa *antes*, para no hacerle completar todo el flujo a alguien cuyo almacén ya está roto.
- **No corre en cada arranque de la app** (a diferencia de `getCredentialStatus`, que sí): un round-trip de escritura/lectura/borrado en cada arranque sería ruido para un chequeo que, en la práctica, en Windows, prácticamente nunca falla — se corre solo en el momento en que de verdad importa (justo antes de vincular).
- **No se publica para Linux** (ya fuera del roadmap, `docs/product.md` §1), pero el código se mantiene multiplataforma a propósito.

## Riesgos

- **Nunca debe dejar basura de prueba** en el Credential Manager real, pase lo que pase (éxito, error, timeout) — `reject` corre en un `finally`, con su propio catch silencioso. **Riesgo residual conocido** (hallazgo de revisión, no corregido — probabilidad baja): si `approve`+`fill` salieron bien (`healthy: true`) y ese `reject` final falla de forma independiente (p. ej. el almacén momentáneamente bloqueado), la credencial de prueba queda huérfana sin que nada lo reporte — el resultado ya se decidió antes de llegar al `finally`. Aceptado por ahora: host `.invalid` reservado fijo, username/password aleatorios y descartables (nunca una cuenta real), y el chequeo corre solo al clickear "GitHub"/"GitLab", no en cada arranque.
- **Falso positivo por red/latencia**: el round-trip usa el mismo timeout ya existente de `runGitCredential` (5s) — no hace falta uno nuevo.

## Criterio de éxito

- En esta máquina (GCM real y funcional): `checkSecretStoreHealth()` da `{ healthy: true }`, dos veces seguidas, sin dejar ninguna credencial de prueba.
- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo: abrir el diálogo de vincular GitHub/GitLab en la app real sigue funcionando (el chequeo pasa, nunca bloquea un almacén sano).
