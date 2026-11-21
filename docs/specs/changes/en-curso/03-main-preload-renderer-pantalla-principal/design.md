# Design — Fase 3 (parte 1)

## Estructura (ADR 0001, convención de `electron-vite` manda en el nivel superior)

```
dossier-app/
├── electron.vite.config.ts        # target node24.22/chrome156 (ADR 0002)
├── core/
│   ├── features/
│   │   ├── brand/brand.ts         # S2 — único lugar con los literales de marca (ADR 0005)
│   │   └── state/{state.ts,state.test.ts}  # S1
│   └── index.ts                   # re-exporta brand y state también
└── src/
    ├── shared/ipc-channels.ts     # nombres de canal IPC, importé por main y preload (nunca strings sueltos)
    ├── main/
    │   └── index.ts               # ventana, bandeja, handlers IPC
    ├── preload/
    │   └── index.ts               # contextBridge, solo getState/selectAccount
    └── renderer/
        ├── index.html
        └── src/
            ├── main.tsx           # entry, monta <App/>
            └── features/principal/
                ├── App.tsx
                ├── TitleBar.tsx
                ├── ActiveBanner.tsx
                ├── AccountCard.tsx
                ├── AddButtons.tsx
                ├── StatusToast.tsx
                ├── Footer.tsx
                └── store.ts        # nanostores: cuentas + activeId, alimentado por getState()
```

## S1 — `core/features/state/state.ts`

Mismo patrón exacto que `accounts.ts`/`rules.ts`: `conf`, `cwd` opcional para tests.

```ts
export interface StateStore {
  getActiveId(): string | undefined
  setActiveId(id: string): void
}
export function createStateStore(options?: { cwd?: string }): StateStore
```

## S2 — `core/features/brand/brand.ts`

Vive en `core` (sin dependencia de Electron) porque lo van a consumir tanto `main` como, más adelante, scripts de build/CI (ADR 0005, verificación de que el nombre no se repite suelto). Valores exactos de ADR 0005: `displayName: 'Dossier'`, `slug: 'dossier'`, `appId: 'com.dossier.app'`, `dataDir: 'dossier'`, `gitConfigMarker: 'dossier'`, `githubOAuthAppName: 'Dossier'`.

## S3/S4 — IPC

`src/shared/ipc-channels.ts`:

```ts
export const IPC = {
  getState: 'getState',
  selectAccount: 'selectAccount',
} as const
```

Esquemas `zod` del lado `main` (S3.3), solo para el payload de entrada (la salida no necesita validarse, la genera `core`):

```ts
const selectAccountSchema = z.object({ id: z.string().min(1) })
```

`getState()` no recibe payload. Devuelve `{ accounts: Account[], activeId: string | undefined }` (sin tokens, `Account` ya los excluye por tipo — ADR 0004).

`main/index.ts`: `electron-menubar` para la ventana/bandeja (ADR 0003/0007), fuses leídos de un `electron-builder.yml` mínimo (S4.4) que se amplía en la Fase 5 real.

## S5 — Renderer

Componentes = tabla de ADR 0007 exactamente. CSS: el mismo bloque `<style>` del apéndice congelado, movido a `index.html` tal cual (sin reescribir valores). `store.ts` (nanostores): un átomo con `{ accounts, activeId }`, poblado al montar con `window.api.getState()`; `selectAccount(id)` llama `window.api.selectAccount(id)` y vuelve a pedir `getState()` (fuente de verdad es `core`, el renderer no mantiene su propio estado derivado por separado).

## Verificación de este change

- `core/features/state`: TDD completo, sin Electron, mismo patrón que `accounts`/`rules`.
- `pnpm build` (vía `electron-vite build`) compila los 3 procesos sin error.
- Arranque headless con auto-quit (mismo truco que el spike R6, `R6_SPIKE_AUTO_QUIT` → acá `DOSSIER_AUTO_QUIT`): confirma que la ventana carga, la bandeja se crea y no hay excepciones, sin depender de que un humano la cierre a mano para la verificación automatizada.
- No hay test automatizado de "clic en una cuenta cambia el banner" en este change (necesitaría Playwright, Fase 3 posterior según `docs/adr/0008-testing-y-ci.md`); se verifica manualmente arrancando la app de verdad, una vez, reportando el resultado.
