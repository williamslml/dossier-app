# Design — Etiquetas editables

## `core`

Nada nuevo: `AccountsStore.rename(id, label)` ya existe (`core/features/accounts/accounts.ts:79-81`), ya exportado desde `core/index.ts`. Solo le falta un test dedicado.

## IPC

`src/shared/ipc-channels.ts`: agregar `renameAccount: 'renameAccount'`.

`src/main/index.ts`:

```ts
const renameAccountSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1),
})

ipcMain.handle(IPC.renameAccount, (_event, payload: unknown) => {
  const { id, label } = renameAccountSchema.parse(payload)
  accountsStore.rename(id, label)
  return getState()
})
```

Mismo patrón que `linkGitlab`: valida, muta vía `core`, devuelve `getState()` completo (nunca el objeto parcial) para que el renderer no tenga que mezclar estados a mano.

## Preload (`src/preload/index.ts`)

```ts
renameAccount(data: { id: string; label: string }): Promise<DossierState>
// ...
renameAccount: (data: { id: string; label: string }) => ipcRenderer.invoke(IPC.renameAccount, data),
```

## Renderer

`src/renderer/src/features/principal/store.ts`: función `renameAccount`, mismo molde que `pinFolder`:

```ts
export async function renameAccount(id: string, label: string): Promise<void> {
  applyState(await window.dossier.renameAccount({ id, label }))
}
```

`AccountCard.tsx`: estado local `editing: boolean` + `draft: string`.

- Ícono `#icon-edit` en `.account-actions`, antes del de desvincular, `title="Renombrar cuenta"`, `onClick` con `stopPropagation` → `setEditing(true)`, `setDraft(account.label)`.
- En modo edición, `<h4>` se reemplaza por `<input class="account-label-input" />` con `ref` que hace `focus()` + `select()` al montar (un `useEffect`/`useLayoutEffect` de Preact, patrón ya usado en otros diálogos de este proyecto para autofocus).
- `onKeyDown`: `Escape` → `setEditing(false)` sin llamar nada. `Enter` → `commit()`.
- `onBlur` → `commit()`.
- `commit()`: si `draft.trim() === account.label` o `draft.trim() === ''`, solo `setEditing(false)`. Si no, `setSaving(true)`, llama `renameAccount(account.id, draft.trim())`; si falla, `showToast(mensaje)` y revierte (`setDraft(account.label)`); en cualquier caso, `setEditing(false)` al terminar.
- El `<input>` lleva su propio `onClick` con `stopPropagation` (no hace falta en `onKeyDown`/`onBlur`, que nunca burbujean al `onClick` del contenedor).

No hace falta un diálogo modal ni un componente nuevo — es edición in situ, igual que los inputs ya usados en los diálogos de vincular cuenta, pero sin overlay.
