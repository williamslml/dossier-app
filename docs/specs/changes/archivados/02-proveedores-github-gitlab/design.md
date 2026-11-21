# Design — Fase 2: proveedores

## Estructura (ADR 0001, feature-first)

```
core/features/providers/
├── github/
│   ├── github.ts          # linkGithub(), deriveNoreplyEmail()
│   └── github.test.ts
└── gitlab/
    ├── gitlab.ts           # linkGitlab()
    └── gitlab.test.ts
```

## P1 — GitHub

```ts
export interface LinkedAccount {
  provider: 'github' | 'gitlab'
  username: string
  id: string | number
  name: string
  email: string | undefined
  token: string
}

export interface GithubVerification {
  verification_uri: string
  user_code: string
  expires_in: number
  interval: number
}

export function deriveNoreplyEmail(login: string, id: number, createdAt: string): string

export function linkGithub(
  onVerification: (v: GithubVerification) => void,
): Promise<LinkedAccount>
```

- `@octokit/auth-oauth-device` (ya en el catálogo, ADR 0003) con `clientType: 'oauth-app'`, `clientId: 'Ov23liZi9KS6Wf5C1aJ5'` (constante en `github.ts` — **no es secreto**, Device Flow es un cliente público por diseño; el propio paquete lo trata como dato no sensible), `scopes: ['repo']`.
- `GET https://api.github.com/user`: **`fetch` nativo de Node** (disponible desde Node 18+, el proyecto usa 24.22) con `Authorization: Bearer <token>` y `User-Agent` (GitHub API lo exige). No se agrega `@octokit/request`/`@octokit/core` como dependencia nueva solo para una llamada: ya está fuera del catálogo decidido (ADR 0003) y `fetch` nativo la cubre sin más.
- `deriveNoreplyEmail` separado y puro (sin red) para poder probarlo unitariamente sin depender del Device Flow real.
- Fecha de corte: `2017-07-18` (blueprint original / `docs/product.md` §3.2), comparación de fechas con `Date`, no con comparación de strings.

## P2 — GitLab

```ts
export function linkGitlab(host: string, token: string): Promise<LinkedAccount>
```

- `fetch` nativo a `${host}/api/v4/user` con header `PRIVATE-TOKEN: ${token}` (no `Authorization: Bearer` — así autentica GitLab un PAT, distinto de un token OAuth). `host` admite protocolo explícito (`http://`/`https://`, útil para el servidor de prueba local); si no lo trae, se asume `https://`.
- 200 → parsear `username`, `id`, `name`, `email ?? public_email ?? undefined`.
- No 200 → `throw new Error('Token de GitLab inválido o sin permiso')`, sin interpolar el token ni el body de la respuesta en el mensaje.

## Verificación de este change

- `github.test.ts`: unitario de `deriveNoreplyEmail` (antes/después del corte), sin red.
- `gitlab.test.ts`: `node:http` crea un servidor de prueba efímero en `127.0.0.1` que responde `/api/v4/user` según el caso (200 completo, 200 sin email, 401) — nunca contra `gitlab.com` real ni con un token verdadero.
- `linkGithub` en sí (el Device Flow completo) **no tiene test automatizado**: es interactivo por diseño de OAuth (el usuario tiene que abrir un link y escribir un código). Se verifica en vivo, una vez, con aprobación explícita — igual que el spike de GCM en `00-spike-base-y-gcm`.
