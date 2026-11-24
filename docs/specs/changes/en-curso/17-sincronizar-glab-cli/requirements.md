# Requirements — Sincronizar cuentas previas a Dossier (parte b: `glab` CLI)

## G1. `core`: detección

- G1.1: `findGitlabCliToken(host)` mira stdout **y** stderr (hallazgo real: la línea sale por stderr).
- G1.2: nunca confía en el código de salida — un token encontrado junto con un error de verificación de red igual cuenta como "token encontrado".
- G1.3: sin `glab` instalado, sin sesión para ese host, o salida irreconocible → `undefined`, nunca lanza.
- G1.4: `findImportableGitlabCliAccount` confirma el token contra `GET /api/v4/user` (`linkGitlab`) antes de ofrecerlo.
- G1.5: si la cuenta (mismo host + username) ya está en `accountsStore`, no la ofrece de nuevo. Dos cuentas con el mismo username pero host distinto no cuentan como la misma.
- G1.6: si el token ya no es válido, el error de `linkGitlab` se propaga tal cual.

## G2. IPC

- G2.1: `checkGitlabCliImport(host)` nunca devuelve el token — solo `username`/`name`/`email`.
- G2.2: `importGitlabCliAccount(label, host)` vuelve a correr la detección del lado de `main`, nunca confía en el renderer.

## G3. UI — `GitlabLinkDialog.tsx`

- G3.1: el cartel se chequea al montar (host por defecto) y de nuevo cada vez que el usuario termina de editar el dominio (`onBlur`), nunca en cada tecla.
- G3.2: un fallo al verificar (host no resuelve, token inválido) nunca se muestra como error de diálogo durante la detección pasiva — se trata como "no hay nada para ofrecer".
- G3.3: "Usar esta cuenta" exige una etiqueta ya escrita, igual que "Vincular".

## Verificación

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo contra el binario real de `glab` (instalado solo para esto, host `.invalid`, nunca una cuenta real): confirma la detección real del token (el bug de stdout/stderr se encontró así, no con un test) y que un fallo de verificación de red no rompe nada ni crea una cuenta a medias.
