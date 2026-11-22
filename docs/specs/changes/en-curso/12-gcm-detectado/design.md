# Design — GCM detectado y usable

## `core/features/git-credential/git-credential.ts`

```ts
export interface CredentialStatus {
  gcmConfigured: boolean
  helpers: string[]
  otherHelperBeforeGcm: boolean
}

export function parseCredentialHelperChain(stdout: string): string[] {
  return stdout.split('\n').map((l) => l.trim()).filter(Boolean)
}

export function getCredentialStatus(): Promise<CredentialStatus> {
  return new Promise((resolve) => {
    execFile('git', ['config', '--get-all', 'credential.helper'], { encoding: 'utf8' }, (err, stdout) => {
      const helpers = err ? [] : parseCredentialHelperChain(stdout)
      const gcmIndex = helpers.findIndex((h) => /manager/.test(h))
      resolve({
        gcmConfigured: gcmIndex !== -1,
        helpers,
        otherHelperBeforeGcm: gcmIndex > 0,
      })
    })
  })
}
```

`execFile` (no `spawn` con stdin): este chequeo no necesita escribir nada al proceso, a diferencia de `runGitCredential`.

## IPC / preload / renderer

Mismo molde que el resto de la app: `IPC.getCredentialStatus`/`IPC.recheckCredentials` → `ipcMain.handle` llama `getCredentialStatus()` de `core` sin validación de entrada (no reciben payload) → preload expone las dos funciones → `store.ts` tiene `$credentialStatus` (atom) + `loadCredentialStatus`/`recheckCredentials`.

`App.tsx` carga `loadCredentialStatus()` en el mismo `useEffect` que ya carga `loadState`/`loadSettings`/`loadIdentityConflicts`, y pasa `$credentialStatus` a `Footer` en los dos lugares donde se renderiza (pantalla principal y Ajustes).

`Footer.tsx` reemplaza la prop `synced: boolean` por `status: CredentialStatus | null`, con una función pura `describe(status)` que decide label + variante (`ok`/`warn`/`error`) — los tres casos de G3. El elemento cambia de `<span>` a `<button>` (con reset de estilos de botón nativo) para que el clic dispare `recheckCredentials`.
