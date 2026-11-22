# Design — Doctor

## `core/features/doctor/doctor.ts`

```ts
export interface DoctorCheck {
  path: string
  accountId: string
  accountLabel: string
  hasRepo: boolean
  ok: boolean
  detail?: string
}

export interface RunDoctorOptions {
  /** Solo para tests: fuerza GIT_CONFIG_GLOBAL a un archivo aislado. */
  env?: Record<string, string>
}

export function runDoctor(
  rulesStore: RulesStore,
  accountsStore: AccountsStore,
  dataDir: string,
  options?: RunDoctorOptions,
): Promise<DoctorCheck[]>
```

Internamente: `git -C <path> config --get <key>` (vía `simple-git`, `unsafe: { allowUnsafeConfigPaths: true }`) para el caso con repo — exactamente la misma resolución que vería un `git commit` real en esa carpeta, `includeIf` incluido. Para el caso sin repo: `git config --file <profilePath> --get user.email`, mismo mecanismo que ya usa `writeAccountProfile`/`writeProfileConfig` (nunca parsear `.ini` a mano, ADR 0004).

`options.env` es la misma técnica ya usada en `core/features/identity/end-to-end.test.ts` (`GIT_CONFIG_GLOBAL` aislado) — en producción se omite, para que Doctor lea la config global real del usuario.

## IPC / preload / renderer

Mismo molde que el resto: `IPC.runDoctor` → `ipcMain.handle` llama `runDoctor(rulesStore, accountsStore, dataDir)` (sin `options.env` — producción) → preload expone `runDoctor()` → `store.ts` tiene `$doctorChecks`/`$doctorLoading`/`runDoctorCheck`.

`Ajustes.tsx` agrega el componente `Doctor()`, mismo patrón que `MantenimientoCredenciales()` (carga al montar, estado local de error/confirmación si hiciera falta — acá no hace falta, es de solo lectura). Lista con la misma clase `.pins-list`/`.pin-row`/`.pin-info` ya usada por "Credenciales huérfanas" y el diálogo de carpetas, para no introducir un segundo sistema visual de listas.
