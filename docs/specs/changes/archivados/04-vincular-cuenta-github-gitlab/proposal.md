# Proposal — Vincular cuenta (GitHub Device Flow + GitLab PAT)

**Señal de alto riesgo** (`CLAUDE.md`): toca OAuth (GitHub) y credenciales (GCM). Spec completa antes de tocar código, revisión en sesión separada antes de mergear.

## Por qué

`docs/product.md` §5, Fase 3: "cambias de cuenta desde la bandeja y un commit sale con la identidad correcta" — todavía falta la mitad de esa frase: **vincular** una cuenta nueva. `core/features/providers/{github,gitlab}` (Fase 2) ya saben hablar con GitHub/GitLab y devolver `{ username, id, name, email, token }`; `core/features/git-credential` ya sabe guardar un token en GCM; `core/features/accounts` ya sabe guardar el registro de la cuenta. Lo que falta es la pieza que los conecta (`main`) y la pantalla que el usuario toca (`renderer`): hoy los botones "GitHub"/"GitLab" de la pantalla principal están deshabilitados con el tooltip "próximamente" (Fase 3, parte 1, `S5.5`).

## Qué cambia

1. **`core/features/link-account/`** (nuevo): orquesta lo que hoy son piezas sueltas — llama al proveedor, guarda el token con `git credential approve` + verifica con `fill` (ADR 0004, "Flujo de guardado y borrado de tokens"), y si todo sale bien crea el registro en `accounts.json`. Si falla el guardado en GCM, no crea la cuenta y lo informa con un error claro.
2. **IPC nuevo** (`main`): `startGithubLink` (dispara el Device Flow, emite el `user_code`/`verification_uri` al renderer por evento mientras espera), `linkGitlab` (host + token, una sola llamada) — subconjunto de la lista completa de `docs/product.md` §3.4; el resto (`renameAccount`, `removeAccount`, `listPins`, Quick Clone, Ajustes) queda para sus propios changes.
3. **Diálogos en el renderer**: uno para GitHub (muestra el código y el enlace de verificación, con un botón para copiarlo y abrir el enlace; estado de espera; éxito o error) y uno para GitLab (host + token, con validación y mensaje de error claro). Reemplazan el tooltip "próximamente" de los botones existentes (`AddButtons.tsx`).
4. **Notificación real** (ya existe el módulo, `src/main/notify.ts`, Fase 3 parte 1 — sin evento real todavía): "vinculación completada" pasa a ser un evento real, el primero que dispara el módulo de notificaciones fuera del menú de prueba.

## Qué NO cambia / queda fuera

- Cancelar un Device Flow en curso (`cancelGithubLink` de la lista de `product.md`): `@octokit/auth-oauth-device` no expone ninguna forma de abortar el polling interno (verificado en sus tipos, `node_modules/@octokit/auth-oauth-device/dist-types/types.d.ts` — ni `signal` ni `abort`). Cerrar el diálogo deja de esperar su resultado en la UI, pero el polling de fondo sigue hasta que GitHub lo expira solo (`expires_in`, normalmente 15 minutos) o hasta que la app se cierra. Se documenta como limitación conocida, no se inventa un mecanismo de cancelación que la librería no tiene.
- Editar la etiqueta de una cuenta, desvincular una cuenta, Carpetas fijadas, Ajustes, Quick Clone — siguen deshabilitados con su propio tooltip, son changes aparte.
- Verificación en vivo del "Doctor" (detectar otro `credential.helper` por delante) — fuera de alcance, es una pantalla distinta (`docs/product.md` §6, riesgos).
- GitLab autoalojado probado con una instancia real (sigue siendo soporte de diseño, no verificación en vivo — decisión abierta, `docs/product.md` §5 "Después").

## Riesgos

- **Token nunca llega al renderer**: el `token` que devuelven los proveedores se queda en `main`; el renderer solo recibe `username`/`name`/`email`/estado, nunca el secreto (ADR 0006).
- **Guardado en GCM puede fallar silenciosamente** si `approve` no se completa, o si `fill` no devuelve lo esperado: la orquestación de `core/features/link-account` no da la cuenta por vinculada hasta que `fill` confirma, igual que ya exige ADR 0004.
- **Device Flow huérfano** (ver "Qué NO cambia"): aceptado, documentado, no bloquea este change.

## Criterio de éxito

- Vincular una cuenta de GitHub real (Device Flow completo, con tu aprobación para la parte interactiva) y una de GitLab real (PAT tuyo) desde la pantalla principal, y ver la cuenta aparecer en la lista.
- Si el guardado en GCM falla a propósito (simulado), la cuenta no queda creada a medias.
- `pnpm typecheck && pnpm lint && pnpm test` en verde, incluida la nueva orquestación con tests que no dependen de red real.
