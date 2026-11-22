# Requirements — Etiquetas editables

## E1. `core`: `rename` probado

- E1.1: `rename(id, label)` actualiza el `label` de la cuenta indicada y devuelve la cuenta actualizada.
- E1.2: `rename` con un `id` que no existe lanza (mismo criterio que `setSigningKey`, ya probado).
- E1.3: `rename` no toca ningún otro campo de la cuenta (`username`, `email`, `signingKey`, etc.).

## E2. IPC `renameAccount`

- E2.1: valida `{ id: string no vacío, label: string no vacío (tras `trim`) }` con `zod` antes de tocar `core`.
- E2.2: devuelve el `DossierState` actualizado (mismo patrón que `linkGitlab`/`startGithubLink`), para que el renderer solo necesite `applyState(...)`.
- E2.3: un `id` inexistente rechaza la promesa con el error real de `core` — el renderer lo muestra, no lo silencia.

## E3. UI — `AccountCard.tsx`

- E3.1: un ícono de editar (`#icon-edit`) aparece en `.account-actions`, junto al de desvincular.
- E3.2: clic en el ícono de editar (con `stopPropagation`, nunca abre el diálogo de carpetas) pone la tarjeta en modo edición: el `<h4>` se reemplaza por un `<input>` con el valor actual, foco y selección automáticos.
- E3.3: Enter confirma si el valor (tras `trim`) es distinto y no vacío; si es igual o vacío, sale del modo edición sin llamar al IPC.
- E3.4: perder el foco (`blur`) se comporta igual que Enter (confirma si corresponde, si no revierte).
- E3.5: Escape cancela siempre, sin guardar, aunque el valor haya cambiado.
- E3.6: mientras se guarda, el input se deshabilita; si el IPC rechaza, se muestra un toast con el mensaje de error y se revierte al valor anterior.
- E3.7: clics/teclas dentro del input nunca disparan el `onClick` de la tarjeta (abrir carpetas).

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo con una cuenta real: editar su etiqueta, confirmar que persiste tras cerrar y reabrir la app.
