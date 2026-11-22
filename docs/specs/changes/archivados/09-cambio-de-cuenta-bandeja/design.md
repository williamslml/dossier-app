# Design — Cambio de cuenta activa desde la bandeja

Ver `proposal.md`/`requirements.md` para el porqué y los requisitos. Acá, el enfoque técnico.

## R1 — Función compartida

Hoy (`src/main/index.ts`, dentro del handler de `IPC.selectAccount`):

```ts
ipcMain.handle(IPC.selectAccount, async (_event, payload: unknown) => {
  const { id } = selectAccountSchema.parse(payload)
  stateStore.setActiveId(id)
  const account = accountsStore.list().find((a) => a.id === id)
  if (account) {
    await setActiveAccount(dataDir, account)
    if (settingsStore.get().applySigningKeyOnSwitch && account.signingKey) {
      await writeSigningKey(dataDir, account.signingKey)
    }
  }
  return getState()
})
```

Se extrae la parte sin el `parse`/`getState()` (específicos de IPC) a una función de módulo:

```ts
async function selectAccount(id: string): Promise<void> {
  stateStore.setActiveId(id)
  const account = accountsStore.list().find((a) => a.id === id)
  if (!account) return
  await setActiveAccount(dataDir, account)
  if (settingsStore.get().applySigningKeyOnSwitch && account.signingKey) {
    await writeSigningKey(dataDir, account.signingKey)
  }
}

ipcMain.handle(IPC.selectAccount, async (_event, payload: unknown) => {
  const { id } = selectAccountSchema.parse(payload)
  await selectAccount(id)
  return getState()
})
```

El item del menú de la bandeja llama a `selectAccount(id)` directo (ver R2).

## R2 — `buildTrayMenu`

Firma actual: `function buildTrayMenu(settings: ReturnType<typeof getSettingsForRenderer>)`. Pasa a:

```ts
function buildTrayMenu(
  settings: ReturnType<typeof getSettingsForRenderer>,
  accounts: Account[],
  activeId: string | undefined
) {
  return Menu.buildFromTemplate([
    { label: 'Abrir', click: () => mb.showWindow() },
    { type: 'separator' },
    {
      label: 'Cuenta activa',
      enabled: accounts.length > 0,
      submenu: accounts.map((account) => ({
        label: account.label,
        type: 'radio' as const,
        checked: account.id === activeId,
        click: () => {
          void selectAccount(account.id)
            .catch((err: unknown) => log.error('no se pudo cambiar de cuenta desde la bandeja', err))
            .finally(() => mb.setContextMenu(buildTrayMenu(getSettingsForRenderer(), accountsStore.list(), stateStore.getActiveId())))
        },
      })),
    },
    { type: 'separator' },
    {
      label: 'Tema',
      // ... resto sin cambios
```

Nota: con `accounts.length === 0`, `submenu: []` — Electron acepta un submenú vacío sin romper; `enabled: false` además lo deja claro visualmente (R2.4).

Cada llamador de `buildTrayMenu` pasa también `accountsStore.list()` y `stateStore.getActiveId()` — los tres call sites existentes (`applySettings`, el nuevo tras vincular, y el de `mb.on('ready', ...)`).

## R3 — Reconstruir tras vincular

En `IPC.startGithubLink` y `IPC.linkGitlab`, después del `notify(...)` de éxito que ya existe, agregar:

```ts
mb.setContextMenu(buildTrayMenu(getSettingsForRenderer(), accountsStore.list(), stateStore.getActiveId()))
```

Mismo patrón exacto que ya usa `applySettings` — no se crea ninguna abstracción nueva para esto.

## R4 — Logueo de error

El `.catch()` del snippet de R2 ya cubre esto — `log.error(...)`, mismo logger (`electron-log`) que el resto de `main`. No hace falta nada más: no hay UI disponible desde un click de `Menu` nativo para mostrar el error de otra forma, y la app no debe caerse por esto (de ahí el `.catch()`, no dejar la promesa sin manejar).
