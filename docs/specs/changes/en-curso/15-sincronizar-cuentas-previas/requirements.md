# Requirements — Sincronizar cuentas previas a Dossier (parte b: `gh` CLI)

## C1. `core`: detección

- C1.1: `findGithubCliToken()` nunca lanza — `gh` ausente o sin sesión da `undefined`.
- C1.2: `findImportableGithubCliAccount` confirma el token contra `GET /user` (`fetchGithubUser`, nunca confía ciegamente en lo que imprime el CLI).
- C1.3: si la cuenta (host `github.com` + ese `username`) ya está en `accountsStore`, no la ofrece de nuevo.
- C1.4: si el token ya no es válido, el error de la API se propaga tal cual (nunca se oculta ni se convierte en "no hay nada que importar").

## C2. IPC

- C2.1: `checkGithubCliImport` nunca devuelve el token — solo `username`/`name`/`email`.
- C2.2: `importGithubCliAccount(label)` vuelve a correr la detección del lado de `main` (nunca recibe el token del renderer) y recién ahí llama a `saveLinkedAccount`.

## C3. UI — `GithubLinkDialog.tsx`

- C3.1: al abrir el diálogo, si hay algo para importar, aparece el cartel con el `username` detectado.
- C3.2: "Usar esta cuenta" exige una etiqueta ya escrita (mismo criterio que "Vincular").
- C3.3: mientras se importa, el botón queda deshabilitado; si falla, el diálogo pasa a su estado de error ya existente (mismo que un fallo de Device Flow).

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo de solo lectura: `checkGithubCliImport()` real + el cartel en el diálogo — nunca se completa la importación contra la cuenta real durante la verificación, para no crear una cuenta sin que el usuario lo pida.
