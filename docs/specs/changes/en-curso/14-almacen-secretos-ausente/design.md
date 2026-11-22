# Design — Detección de almacén de secretos ausente

## `core/features/git-credential/git-credential.ts`

```ts
export interface SecretStoreHealth {
  healthy: boolean
  detail?: string
}

export async function checkSecretStoreHealth(): Promise<SecretStoreHealth> {
  const host = 'dossier-health-check.invalid'
  const username = `health-${randomUUID().slice(0, 8)}`
  const password = `probe-${randomUUID().slice(0, 8)}`
  const credential = { protocol: 'https', host, username }
  try {
    await runGitCredential('approve', { ...credential, password })
    const filled = await runGitCredential('fill', credential)
    if (filled.password !== password) {
      return { healthy: false, detail: 'El almacén de credenciales devolvió un valor distinto del que se le pidió guardar.' }
    }
    return { healthy: true }
  } catch (err) {
    return { healthy: false, detail: err instanceof Error ? err.message : String(err) }
  } finally {
    await runGitCredential('reject', credential).catch(() => {})
  }
}
```

Reusa `runGitCredential` (ya probado contra GCM real) — ningún protocolo nuevo, solo un round-trip con limpieza garantizada.

## IPC / preload / renderer

`IPC.checkSecretStore` → `ipcMain.handle` llama `checkSecretStoreHealth()` → preload expone `checkSecretStore()` → `store.ts` tiene `checkSecretStore()` (sin atom propio: es un chequeo puntual, no un estado que se muestre persistentemente en pantalla — a diferencia de `$credentialStatus`, que sí vive en el footer).

`AddButtons.tsx`: estado local `checking: boolean`. `openLinkDialog(dialog)` reemplaza el `onClick` directo de los botones GitHub/GitLab — corre el chequeo, y según el resultado abre el diálogo o muestra un toast (`showToast`, ya existente) sin abrir nada.
