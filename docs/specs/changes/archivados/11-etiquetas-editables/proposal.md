# Proposal — Etiquetas editables

No toca ninguna señal de alto riesgo (`CLAUDE.md`): la etiqueta (`label`) es un dato puramente de presentación en `accounts.json`, nunca participa de `includeIf`, credenciales, GCM ni OAuth. No requiere revisión obligatoria en sesión separada.

## Por qué

`docs/product.md` §2: "Etiquetas editables" — listado, sin implementar. Hoy la etiqueta de una cuenta se define una sola vez, al vincularla (`GithubLinkDialog`/`GitlabLinkDialog`), y no hay forma de corregirla después sin desvincular y volver a vincular la cuenta (lo cual ni siquiera es posible todavía: "desvincular" está deshabilitado en `AccountCard.tsx`, "próximamente").

`core/features/accounts/accounts.ts` ya tiene `rename(id, label)` implementado desde la Fase 1 — nunca se conectó a IPC/UI, y no tiene test propio.

## Qué cambia

1. **`core/features/accounts/accounts.test.ts`**: agregar el test que falta para `rename` (no existía ninguno).
2. **IPC nuevo**: `renameAccount` (`src/shared/ipc-channels.ts`, handler en `src/main/index.ts` con validación `zod`, preload).
3. **`AccountCard.tsx`**: el ícono `#icon-edit` del sprite (`src/renderer/index.html`, ya existe, nunca se usó) se agrega a `.account-actions`, junto al de desvincular. Clic → la etiqueta (`<h4>`) se vuelve un `<input>` editable in situ; Enter o perder el foco confirma, Escape cancela. Guarda llamando al IPC nuevo.

## Qué NO cambia / queda fuera

- **Desvincular cuenta**: sigue deshabilitado, fuera de alcance de este change.
- **Renombrar desde la bandeja**: el menú de la bandeja no tiene (ni tuvo) una lista de cuentas — fuera de alcance, ver `docs/lessons/README.md` sobre por qué se simplificó a Abrir/Tema/Salir.
- **Validación de unicidad de etiqueta**: nunca fue una restricción real (dos cuentas de proveedores distintos, o incluso del mismo, pueden tener la misma etiqueta sin que rompa nada — no es una clave).
- **Permitir etiqueta vacía**: si el usuario la deja vacía, se cancela la edición y se vuelve al valor anterior (mismo criterio ya usado en otros formularios de la app: `required`/`canSubmit`).

## Riesgos

- **Click dentro del input no debe abrir el diálogo de carpetas** de la cuenta (la tarjeta entera tiene `onClick` para eso) — mismo patrón que ya usa el botón de desvincular (`e.stopPropagation()`).
- **Carrera con una cuenta borrada mientras se edita**: hoy no hay forma de borrar una cuenta desde la UI (deshabilitado), así que no es un escenario real todavía; igual se maneja el rechazo del IPC con un toast de error, no con una pantalla rota.

## Criterio de éxito

- Clic en el ícono de editar de una cuenta cambia su etiqueta visible a un input con el valor actual, foco puesto y texto seleccionado.
- Confirmar con Enter o con blur (si el valor cambió y no quedó vacío) persiste en `accounts.json` y se refleja de inmediato en la tarjeta.
- Escape cancela sin guardar nada.
- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo: renombrar una cuenta real, confirmar que el nuevo nombre sobrevive a cerrar y reabrir la app.
