# Proposal — GCM detectado y usable, con estado claro cuando falte

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de credenciales/GCM (lee `credential.helper`) — revisión obligatoria en sesión separada antes de mergear, aunque sea de solo lectura.

## Por qué

`docs/product.md` §2 y tabla de riesgos: "GCM detectado y usable, con estado claro cuando falte" — listado, sin implementar. El pie de la pantalla principal (`Footer.tsx`) ya mostraba "Windows Credential Manager" con un punto de estado, pero `synced` era `state.accounts.length > 0` — una cuenta vinculada no dice nada sobre si GCM sigue instalado y en la cadena de `credential.helper` en este momento. Dos riesgos reales, ya documentados en la tabla de riesgos sin mitigación: "GCM no instalado o cadena de helpers ajena" y "Otro helper responde antes que GCM".

## Qué cambia

1. **`core/features/git-credential/git-credential.ts`**: nueva `getCredentialStatus()` — lee `git config --get-all credential.helper` (nunca escribe nada), devuelve `{ gcmConfigured, helpers, otherHelperBeforeGcm }`.
2. **IPC**: `getCredentialStatus` (al cargar) y `recheckCredentials` (a pedido) — las dos llaman a la misma función de `core`, ya anticipadas por nombre en `docs/product.md`.
3. **`Footer.tsx`**: deja de inferir el estado de las cuentas vinculadas. Tres estados reales: "Sincronizado" (GCM en la cadena, nada antes), "Otro gestor puede interferir" (GCM en la cadena, pero no es el primero), "GCM no detectado" (no está en la cadena). Clic: si falta GCM, abre la página de descarga de Git for Windows (que lo incluye); siempre vuelve a verificar.

## Qué NO cambia / queda fuera

- **Nunca reordena ni modifica `credential.helper`** — la tabla de riesgos es explícita: "nunca reordenar sin consentimiento". Esto es puramente informativo.
- **Detección de otros proveedores de credenciales** (p. ej. GitLab-propio): fuera de alcance, `credential.helper` es una sola cadena compartida por todos los hosts.
- **Instalar GCM automáticamente**: fuera de alcance — se lleva al usuario a la página oficial de descarga, nunca se descarga/ejecuta nada en su nombre.

## Riesgos

- **Falso negativo** (GCM instalado pero no detectado): el regex `/manager/` cubre tanto `manager` (actual) como la legada `manager-core`, igual que el chequeo ad-hoc ya usado en los tests existentes de este proyecto (`git-credential.test.ts`, `link-account.test.ts`).
- **`git config --get-all` sin ninguna clave configurada** sale con código de error (no es un error real, es "no hay nada configurado") — se maneja como `helpers: []`, nunca se lanza ni rompe la carga de la app.

## Criterio de éxito

- En esta máquina (GCM real instalado, sin otro helper): el pie muestra "Sincronizado".
- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificación en vivo (Playwright `_electron`, de solo lectura — no toca cuentas reales): `getCredentialStatus()` devuelve `gcmConfigured: true` y el pie lo refleja; un clic en el pie vuelve a verificar sin errores.
