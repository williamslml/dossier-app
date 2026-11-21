# 0006. Seguridad: tokens, ventana, IPC, empaquetado endurecido

## Status

Aceptado

## Context

Dossier maneja tokens de autenticación de GitHub/GitLab. Aunque nunca se guardan en disco propio (ADR 0004), la superficie de ataque de una app Electron con esta responsabilidad exige medidas explícitas desde el diseño, no añadidas después.

## Decision

| Área                 | Medida                                                                                                                                   | Estado                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Tokens               | Solo en el almacén del SO a través de GCM. Nunca en JSON, logs, URLs remotas ni renderer                                                 | **Implementado** (ADR 0004)                                               |
| Persistencia fallida | `git credential approve` no basta por sí solo: verificar con `git credential fill`; si no vuelve el token, bloquear el guardado y avisar | **Implementado**                                                          |
| Interactividad       | `GIT_TERMINAL_PROMPT=0`, `credential.interactive=false`, `credential.guiPrompt=false`, timeout en todas las llamadas                     | **Implementado**                                                          |
| Config Git           | Región delimitada, backup inicial, conservar todo lo ajeno, rechazar carpetas solapadas                                                  | **Implementado** (`core/features/rules`, `gitconfig`)                     |
| Ventana              | `contextIsolation` activo, `nodeIntegration` desactivado, `sandbox` activo, CSP estricta                                                 | Pendiente (Fase 3)                                                        |
| IPC                  | Validar origen del mensaje y esquema (zod) en cada handler                                                                               | Pendiente (Fase 3)                                                        |
| Clonado              | Validar la URL antes de Git; token por GCM, no en la URL                                                                                 | Pendiente (Fase 4)                                                        |
| Scopes               | Mínimos: `repo` (GitHub), `write_repository` (GitLab). Documentados                                                                      | Pendiente (Fase 2)                                                        |
| Red                  | Sin puertos abiertos. Sin telemetría                                                                                                     | Por diseño (ADR 0003)                                                     |
| Cadena de suministro | Dependencias fijadas con lockfile, Dependabot gratuito en GitHub                                                                         | Lockfile fijado desde la Fase 0; Dependabot pendiente de publicar el repo |

### Empaquetado endurecido (Fase 5)

**Fuses de producción (obligatorios):** `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`, `enableNodeCliInspectArguments: false`, `enableEmbeddedAsarIntegrityValidation: true`, `onlyLoadAppFromAsar: true`. Verificar con `npx @electron/fuses read --app …` en CI antes de publicar.

Al no existir helper propio (ADR 0003/0004), no hay segundo `.exe` que firmar y no se necesita `ELECTRON_RUN_AS_NODE`.

## Alternatives

Ver ADR 0003 — `keytar`, `@napi-rs/keyring` en la app y `safeStorage` para credenciales Git se descartaron ahí como alternativa a GCM, no aquí.

## Consequences

- Cada fase futura (2–5) hereda estas medidas como requisito de aceptación, no como algo a "añadir después si da tiempo" — quedan en `docs/product.md` como parte del criterio de terminado de su fase.
- Un cambio que afloje cualquiera de estas medidas (p. ej. desactivar `sandbox` para depurar) es una señal de alto riesgo por `CLAUDE.md` y necesita aprobación explícita antes de mergear, no solo antes de publicar.

## References

- ADR 0004 (modelo de credenciales)
- `docs/product.md` §6 (riesgos)
- `CLAUDE.md` (aprobación humana obligatoria, señales de alto riesgo)
