# Proposal — Motor de identidad (cuenta activa + carpetas fijadas)

**Señal de alto riesgo** (`CLAUDE.md`): toca `includeIf` e identidad de commit. Revisión obligatoria en sesión separada antes de mergear.

## Por qué

`docs/adr/0004-modelo-de-credenciales-e-identidad.md` ya decidió cómo funciona la selección de cuenta (`active.gitconfig` + `includeIf` por carpeta, región delimitada movida al final, copia de respaldo antes del primer cambio) — pero **nada de eso está conectado todavía**. Lo que existe (`core/features/rules`, `core/features/gitconfig`) son piezas sueltas, probadas de forma aislada, nunca unidas entre sí ni con `core/features/accounts`. `docs/product.md` ya lo marca sin tildar: "Cambio de cuenta activa con un clic desde la bandeja" sigue pendiente.

Encontrado al investigar "reglas por carpeta" para la spec de Ajustes (`05-ajustes`, cambio separado) — se separa acá porque es infraestructura que también necesitan "Carpetas fijadas" (su propia pantalla) y Quick Clone (Fase 4), no solo Ajustes.

## Qué cambia

1. **Región delimitada en el config global** (`core/features/gitconfig`, nuevo): marcadores fijos que delimitan todo lo que Dossier escribe en `~/.gitconfig`, para poder encontrarla, leerla y volver a escribirla sin tocar nada ajeno. Si el usuario agrega configuración propia después de esa región, se mueve al final en la siguiente escritura.
2. **Copia de respaldo** del config global, una sola vez, antes de la primera modificación de Dossier.
3. **Perfil por cuenta** (`~/.<dataDir>/profiles/<id>.gitconfig`): `user.name`, `user.email`, `credential.<host>.username`, `credential.<host>.useHttpPath=false` — generado a partir de los datos que ya tiene `accounts.json`.
4. **`active.gitconfig`**: mismo bloque para la cuenta activa, incluido sin condición (`[include]`, no `includeIf`) como primera entrada de la región — para que sea el valor por defecto en carpetas sin fijar.
5. **`selectAccount`** (ya existe en `main`, hoy solo cambia `state.json`): además, regenera `active.gitconfig` con los datos de la cuenta recién activada.
6. **Fijar/desfijar una carpeta** (IPC nuevo en `main`, orquestación nueva en `core`): al fijar, asegura que el perfil de esa cuenta exista, agrega su `includeIf` dentro de la región (después del `active.gitconfig`, de menos a más específico); al desfijar, quita esa entrada (`rulesStore.unpin` ya existe, falta conectarlo a la región delimitada).

## Qué NO cambia / queda fuera

- **Pantalla de "Carpetas fijadas"**: sigue siendo su propio change (`docs/adr/0007-frontend.md`). Este change solo construye el motor; la UI para fijar/desfijar manualmente puede vivir en Ajustes (`05-ajustes`, que referencia este change como su dependencia) o en su pantalla dedicada — se decide al construir esa UI, no acá.
- **Quick Clone / Auto-Pin**: Fase 4, fuera de alcance — este change deja lista la pieza que Quick Clone va a necesitar (fijar una carpeta a una cuenta), no el flujo de clonado en sí.
- **Clave de firma (GPG/SSH)**: `05-ajustes` S6 depende de que `writeProfileConfig` exista (ya existe) y de la región delimitada (este change) — pero la clave de firma en sí queda en `05-ajustes`, no se adelanta acá.
- **Verificación con "Doctor"** (confirmar que Git resuelve la identidad correcta dentro de un repo real): fuera de alcance, es su propio pendiente en `docs/product.md`.

## Riesgos

- **Mover la región delimitada mal podría perder configuración del usuario** que no es de Dossier — por eso la detección de los marcadores y el respaldo previo son obligatorios antes de escribir nada, y se verifican con un repo/config de prueba real, nunca `~/.gitconfig` del desarrollador en los tests.
- **Actualizar `active.gitconfig` en el momento equivocado** (p. ej. a mitad de un `git push` en curso) podría firmar algo con la identidad equivocada — se escribe de forma atómica (archivo temporal + rename, mismo patrón que ya usa `conf` para los JSON) para que nunca quede a medio escribir.
- **Dos cuentas fijadas a carpetas que se solapan**: ya lo resuelve `FolderOverlapError` (`core/features/rules`, existente) — este change no reimplementa esa validación, solo la usa.

## Criterio de éxito

- Activar una cuenta desde la pantalla principal y, en una carpeta sin fijar, confirmar con `git config user.email` que cambió a la de esa cuenta.
- Fijar una carpeta a una cuenta distinta de la activa y confirmar que esa carpeta usa su propia identidad, sin importar cuál esté activa globalmente.
- Agregar configuración ajena a Dossier después de la región, volver a fijar otra carpeta, y confirmar que la región se movió al final sin perder esa configuración ajena.
- `pnpm typecheck && pnpm lint && pnpm test` en verde, con tests de integración sobre un config global de prueba real (mismo patrón que `gitconfig.test.ts`), nunca contra `~/.gitconfig` del desarrollador.
