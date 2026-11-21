# Design — Vincular cuenta

## `core/features/link-account/`

Se separa en dos capas, para que la parte que de verdad hace falta testear (guardar en GCM + crear la cuenta) no dependa de una llamada de red real a GitHub/GitLab en cada test:

```ts
// Capa baja, testable sin red: ya tiene un LinkedAccount (de linkGithub/linkGitlab
// o de un objeto de prueba) y hace lo que exige ADR 0004 ("Flujo de guardado y
// borrado de tokens"): approve → fill → (si fill confirma) crear la cuenta.
export async function saveLinkedAccount(
  accountsStore: AccountsStore,
  linked: LinkedAccount,
  label: string,
): Promise<Account> {
  await runGitCredential('approve', {
    protocol: 'https',
    host: linked.provider === 'github' ? 'github.com' : linked.host, // ver nota
    username: linked.username,
    password: linked.token,
  })
  const filled = await runGitCredential('fill', {
    protocol: 'https',
    host: linked.provider === 'github' ? 'github.com' : linked.host,
    username: linked.username,
  })
  if (filled.password !== linked.token) {
    throw new Error('No se pudo confirmar el token guardado en el gestor de credenciales.')
  }
  return accountsStore.create({
    provider: linked.provider,
    host: linked.provider === 'github' ? 'github.com' : linked.host,
    label,
    username: linked.username,
    name: linked.name,
    email: linked.email ?? '',
  })
}

// Capa alta: la que llama `main`.
export function linkGithubAccount(
  accountsStore: AccountsStore,
  label: string,
  onVerification: (v: GithubVerification) => void,
): Promise<Account> {
  return linkGithub(onVerification).then((linked) => saveLinkedAccount(accountsStore, linked, label))
}

export function linkGitlabAccount(
  accountsStore: AccountsStore,
  label: string,
  host: string,
  token: string,
): Promise<Account> {
  return linkGitlab(host, token).then((linked) =>
    saveLinkedAccount(accountsStore, { ...linked, host }, label),
  )
}
```

**Nota sobre `host` en `LinkedAccount`:** el tipo `LinkedAccount` (Fase 2, `core/features/providers/github/github.ts`) no incluye `host` — GitHub no lo necesita (siempre `github.com`), pero GitLab sí (host variable). Tarea de este change: agregar `host` opcional a `LinkedAccount`, o pasarlo aparte como hace `linkGitlabAccount` arriba (`{ ...linked, host }`). Se decide al implementar, según lo que quede más simple de tipar con `exactOptionalPropertyTypes` (ya activo, `tsconfig.json`).

`email: linked.email ?? ''`: `Account.email` es `string` (no opcional, Fase 1); `LinkedAccount.email` puede ser `undefined` (GitLab sin email público). Se decidió cadena vacía en vez de hacer `Account.email` opcional, para no tocar el tipo que ya usa el resto de `core` — revisar si esto genera un caso raro en la UI (email vacío) y, si molesta, reabrir la decisión como ítem de tasks.md, no cambiarla a mitad de implementación sin anotarlo.

## IPC (`main`)

Canal nuevo en `src/shared/ipc-channels.ts`: `startGithubLink`, `linkGitlab`, y un canal de **evento** (no invoke/handle) `githubVerification` para el `user_code` mientras se espera:

```ts
// main
ipcMain.handle(IPC.startGithubLink, async (event, payload: unknown) => {
  const { label } = startGithubLinkSchema.parse(payload)
  await linkGithubAccount(accountsStore, label, (verification) => {
    event.sender.send(IPC.githubVerification, verification)
  })
  return getState()
})
```

El renderer se suscribe a `githubVerification` **antes** de invocar `startGithubLink` (si se suscribiera después, podría perderse el evento si la librería lo dispara muy rápido — en la práctica tarda lo que tarda la llamada a la API de GitHub, pero no hay que depender de eso).

`linkGitlab` es un `handle` normal (sin evento intermedio, es una sola llamada con host+token).

Ningún canal nuevo expone el `token`: lo que cruza IPC es `GithubVerification` (código público, pensado para mostrarse) y al final `DossierState` (sin secretos, ya el tipo existente de Fase 3 parte 1).

## Preload

```ts
export interface DossierApi {
  // … getState, selectAccount, hideWindow (ya existentes)
  startGithubLink(label: string): Promise<DossierState>
  onGithubVerification(callback: (v: GithubVerification) => void): () => void // devuelve función para des-suscribirse
  linkGitlab(data: { label: string; host: string; token: string }): Promise<DossierState>
}
```

`onGithubVerification` envuelve `ipcRenderer.on`/`removeListener` — nunca se expone `ipcRenderer` crudo al renderer (ADR 0006, ya establecido).

## Renderer

Dos componentes nuevos en `src/renderer/src/features/principal/`: `GithubLinkDialog.tsx`, `GitlabLinkDialog.tsx`. Estado local simple (no hace falta nanostores para esto, es efímero y vive solo mientras el diálogo está abierto):

```ts
type LinkState =
  | { step: 'form' }
  | { step: 'waiting-github'; verification: GithubVerification }
  | { step: 'linking' } // GitLab: entre enviar el form y la respuesta
  | { step: 'error'; message: string }
```

`AddButtons.tsx` pierde `disabled`/el tooltip "próximamente" en los dos botones y pasa a abrir el diálogo correspondiente (`onClick`, estado en `App.tsx` o en el propio `AddButtons` — a decidir al implementar según cuál quede con menos prop-drilling).

Abrir el enlace de verificación: `window.dossier` necesita un método para abrir una URL externa, o se agrega directo al preload (`openExternal`, ya está en la lista de `product.md` §3.4, pero quedaba fuera de alcance — se adelanta solo este método mínimo, justificado porque el diálogo de GitHub no tiene sentido sin él). En `main`: `shell.openExternal(url)`, nunca `window.open`/navegación interna.

## Notificación real

Tras `startGithubLink`/`linkGitlab` exitoso, antes de devolver `getState()`:

```ts
notify({ title: brand.displayName, body: `${label} vinculada` })
```

No `important: true` — es informativa, no un error ni algo que deba quedar fijo en el Centro de notificaciones (ADR 0007, regla de `urgency`).

## Verificación

- Tests unitarios de `saveLinkedAccount` con GCM real en Windows (mismo patrón que `core/features/git-credential.test.ts`: host `.invalid`, sufijo aleatorio, limpieza con `reject`), inyectando un `LinkedAccount` de prueba — sin red a GitHub/GitLab.
- Verificación en vivo (con tu aprobación, interactiva): vincular una cuenta de GitHub real y una de GitLab real desde la app, confirmar que aparecen en la lista y que el token quedó en GCM.
- `pnpm typecheck && pnpm lint && pnpm test` en verde.
