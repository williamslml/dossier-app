# Design — Spike: base del proyecto + GCM + includeIf

## Estructura (solo para este change — provisional)

La organización final de `core`/`main`/`preload`/`renderer` es de la Fase 1 en adelante (docs/product.md §4.1, §9: "se define aparte"). Para este spike, lo mínimo que permite verificar R1–R6 sin construir nada que se vaya a descartar:

```
dossier-app/
├── package.json                  # pnpm, root único (sin workspaces todavía: no hay 2º paquete real)
├── pnpm-workspace.yaml            # NO se crea en este change: un solo paquete no lo necesita (R1)
├── tsconfig.json                  # strict: true y afines (docs/product.md §9)
├── vitest.config.ts
├── eslint.config.js + .prettierrc
├── .github/workflows/ci.yml       # matriz Windows+macOS+Linux, solo tests (R2)
└── spike/                         # código temporal de este change; se borra o se promueve a core/ al cerrarlo
    ├── git-credential.ts          # protocolo `git credential` vía child_process (R3)
    ├── git-credential.spike.test.ts
    ├── includeif.ts               # lectura/escritura de includeIf vía simple-git (R4)
    ├── includeif.spike.test.ts
    └── electron-target/           # scaffold mínimo electron-vite+preact solo para R6, descartable
```

`spike/` es explícitamente temporal: al cerrar este change, lo que se valida se migra a `core` (Fase 1) y esta carpeta se borra. Se anota así para que nadie lo confunda con la arquitectura final.

## R3 — Protocolo `git credential` (approve/fill/reject)

docs/product.md §4.1/§4.6: `child_process` para el protocolo de credenciales (es línea a línea por stdin, no algo que `simple-git` envuelva). Un helper mínimo:

```ts
// spike/git-credential.ts
function runGitCredential(
  action: 'approve' | 'fill' | 'reject',
  input: Record<string, string>,
): Promise<Record<string, string>>
```

- Ejecuta `git credential <action>`, escribe `key=value\n` por stdin (protocol, host, username, password) terminado en línea vacía, lee stdout si `action === 'fill'`.
- Entorno de cada llamada: `GIT_TERMINAL_PROMPT=0`, y config de proceso con `credential.interactive=false`, `credential.guiPrompt=false` (vía `-c` o `GIT_CONFIG_*`, no tocando el config global real).
- Timeout explícito (ej. 5s); si expira, matar el proceso y rechazar la promesa — nunca dejarlo colgado (R3.5).
- `approve`/`reject` no devuelven cuerpo; se consideran exitosos solo si el proceso sale con código 0 **y** (para approve) una llamada `fill` posterior confirma el valor — exactamente la regla de verificación obligatoria del docs/product.md (§8: "`git credential approve` no basta por sí solo").

## R4 — `includeIf` vía `simple-git`

docs/product.md §4.4: `git config --file` vía `simple-git`, sin parsear `.ini` a mano.

```ts
// spike/includeif.ts
function writeProfileConfig(
  profilePath: string,
  values: { 'user.name': string; 'user.email': string; [credentialKey: string]: string },
): Promise<void>
function writeIncludeIf(
  globalConfigPath: string,
  gitdirPattern: string,
  profilePath: string,
): Promise<void>
```

- `simple-git({ baseDir })` apuntando al archivo de config objetivo con `.raw(['config', '--file', path, ...])`, nunca editando el archivo como texto.
- El `includeIf` se añade al final del archivo de config "global de prueba" (ver aislamiento más abajo), replicando la regla real del producto (docs/product.md §4.4: la región va al final, de menos a más específico).

## R5 — Aislamiento del entorno de pruebas (obligatorio)

Ninguna prueba toca `~/.gitconfig` real ni el Credential Manager real del usuario fuera de lo estrictamente necesario para probar GCM de verdad (R3 necesita GCM real porque es lo que se está verificando):

- **Config de Git:** cada test usa `GIT_CONFIG_GLOBAL=<archivo temporal>` (variable de entorno soportada desde Git 2.32; verificar versión disponible como prerrequisito) en vez de escribir en `~/.gitconfig`. Los repos de prueba se crean con `git init` en carpetas bajo el directorio temporal de Vitest (`fs.mkdtempSync`).
- **Credenciales:** R3 sí necesita golpear el GCM real (es la hipótesis a validar), pero con **usuarios y tokens de prueba inventados** (no cuentas reales de GitHub/GitLab) y con `reject` de limpieza en el `afterEach`/`afterAll` del test, para no dejar basura en el Credential Manager del usuario.
- Antes de ejecutar R3, el test verifica `git config --get-all credential.helper` incluye `manager`/`manager-core` (docs/product.md §4.6) y aborta con mensaje claro si no.

## R6 — Target `electron-vite` (independiente del resto)

Carpeta descartable `spike/electron-target/`: proyecto mínimo generado a partir de `vanilla-ts` + `@preact/preset-vite` (docs/product.md §5.2, no hay plantilla oficial de Preact), con `target: node24.22 / chrome156` fijado en `electron.vite.config.ts`. Se verifica con `pnpm build` + arranque manual del ejecutable. Este sub-task no depende de R1–R5 y puede hacerse en paralelo.

## Verificación de este change

- `pnpm typecheck && pnpm lint && pnpm test` en CI (R1, R2).
- Los tests de `spike/*.spike.test.ts` son los que verifican R3–R5; corren en la matriz de CI, pero **R3 solo puede validarse de verdad en el runner Windows** (GCM es específico de Git for Windows) — en macOS/Linux ese test se marca `skip`/`todo` explícitamente, no se fuerza a pasar.
- R6 se verifica manualmente una vez (no es parte de la suite automatizada de CI todavía).
