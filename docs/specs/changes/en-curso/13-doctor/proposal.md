# Proposal — Doctor

**Señal de alto riesgo** (`CLAUDE.md`): toca resolución de identidad/`includeIf` (lee, nunca escribe) — revisión obligatoria en sesión separada antes de mergear.

## Por qué

`docs/product.md` §2: "Doctor: valida que Git resuelve identidad y `username` correctos dentro de un repo de cada carpeta fijada; en carpetas sin repo solo valida el archivo generado" — listado, sin implementar. Hoy la única forma de enterarse de un desajuste de identidad es reactiva (la guardia de `identity-guard`, que solo corta un commit si está activada para esa carpeta) o indirecta (abrir una terminal y correr `git config` a mano). No hay una vista que, a pedido, diga "¿están bien todas mis carpetas fijadas, ahora mismo?".

## Qué cambia

1. **`core/features/doctor/doctor.ts`**: `runDoctor(rulesStore, accountsStore, dataDir)` — un `DoctorCheck` por carpeta fijada. Si la carpeta tiene `.git`, corre `git -C <carpeta> config --get user.email` / `--get credential.<host>.username` (la resolución real, incluyendo `includeIf`) y compara contra la cuenta fijada. Si no tiene `.git` todavía, no hay forma de que `includeIf` se evalúe (depende de que Git descubra un repo) — se valida en cambio que el archivo de perfil generado (`getProfilePath`) exista y tenga el `user.email` esperado.
2. **IPC**: `runDoctor` (sin payload) → mismo chequeo.
3. **`Ajustes.tsx`**: sección nueva "Doctor", debajo de "Credenciales huérfanas". Se verifica sola al entrar a Ajustes, con un botón "Verificar de nuevo". Cada carpeta fijada aparece con ✓/✗ y, si falla, el detalle legible de qué se esperaba vs. qué se encontró.

## Qué NO cambia / queda fuera

- **Nunca corrige nada automáticamente** — Doctor es puro diagnóstico. Arreglar un desajuste sigue siendo manual (o, si la guardia de identidad está activa para esa carpeta, pasa por su flujo de "Aplicar/Bloquear/Reconectar" ya existente).
- **No reemplaza a `identity-guard`**: esa guardia sigue siendo la única que corta un commit en el momento. Doctor es un chequeo a pedido, no reactivo.
- **No valida nada de `credential.helper`/GCM**: eso ya lo cubre `12-gcm-detectado`. Doctor es sobre identidad por carpeta, no sobre si GCM está instalado.

## Riesgos

- **Carpeta fijada cuya cuenta ya no existe, o que ya no existe en el disco**: nunca debe lanzar ni romper el chequeo de las demás carpetas — se reporta como "no ok" con un detalle, no como una excepción.
- **Config local del repo gana sobre `includeIf`** (riesgo ya documentado en `docs/product.md`): es exactamente el caso que Doctor debe detectar y mostrar, no evitar.

## Criterio de éxito

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo (Playwright `_electron`, de solo lectura): contra las carpetas fijadas reales de esta máquina, cada resultado de `runDoctor()` coincide con lo que `git config --get user.email` devuelve a mano en esa misma carpeta.
