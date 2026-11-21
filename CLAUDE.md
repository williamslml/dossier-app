# Metodología de trabajo — Spec-First Protocol (SFP)

Variante: **sin orquestador**. Este archivo es autocontenido: no depende de abrir ningún otro documento para trabajar día a día. También existe una carpeta de metodología global en `C:\Users\2510TK0506260\sfp\` (principios completos, reutilizable en futuros proyectos) — se consulta solo si hace falta algo que no esté aquí; no es necesaria para usar la metodología completa en este proyecto.

## Reglas que se usan todos los días

1. **Git es la fuente de verdad del software.** Las specs (`docs/specs/`) documentan _qué_ se construye en un cambio activo y se archivan al cerrarlo; los ADR (`docs/adr/`) documentan _por qué_ de una decisión permanente. Nunca la misma decisión en los dos lugares.
2. **Trivial vs no trivial:** no trivial = varios archivos/módulos, cambia comportamiento o contrato, riesgo medio/alto, **o toca una señal de alto riesgo** (ver más abajo) aunque sea un cambio pequeño → crear primero la spec en `docs/specs/changes/en-curso/<nombre>/` (proposal → requirements → design → tasks), luego implementar por ítems de `tasks.md`, verificar, revisar y archivar en `docs/specs/changes/archivados/`. Trivial (fix puntual, ajuste de texto) → implementar directo con verificación básica.
3. **Sesión independiente** (sin orquestador): leer la spec → tomar un ítem de `tasks.md` → implementar → verificar → marcar el ítem → si algo no obvio ocurrió, anotar una lección en `docs/lessons/`. El estado compartido entre sesiones es `tasks.md`, nunca el historial del chat.
4. **Revisión:** en cambios que toquen una señal de alto riesgo, hacer la revisión en una sesión separada, a partir de spec + `tasks.md` + diff — no del historial de la sesión que implementó.
5. **Contexto mínimo:** cargar solo lo que la tarea necesita; no releer documentos completos de metodología sin motivo. Las decisiones ya tomadas viven como ADR en `docs/adr/` y no se reabren salvo que cambien.
6. **El chat es temporal.** El conocimiento permanente vive en Git, ADRs, `docs/runbooks/` y `docs/lessons/`.

## Dónde vive cada cosa en este proyecto

- Visión, alcance, funcionalidades, fases, riesgos, decisiones abiertas: `docs/product.md`
- Prototipo de referencia visual/UX (no arquitectura): código fuente congelado en el apéndice de `docs/adr/0007-frontend.md` (el `.html` original ya no existe en el repo)
- Decisiones arquitectónicas (ADR), ya tomadas: `docs/adr/` (0001 estructura de carpetas, 0002 target de `electron-vite`, 0003 stack fundacional, 0004 credenciales/identidad, 0005 marca, 0006 seguridad, 0007 frontend, 0008 testing/CI)
- Código: `core/` (Fase 1, hecho) — `main`/`preload`/`renderer` llegan en la Fase 3 (ver `docs/adr/0007-frontend.md`)
- Specs por cambio: `docs/specs/` (ver su `README.md`)
- Runbooks: `docs/runbooks/`
- Lecciones aprendidas: `docs/lessons/`
- Metodología global (reutilizable en otros proyectos): `C:\Users\2510TK0506260\sfp\SYSTEM.md`

## Verificación (comandos reales)

- Tests: `pnpm test` (Vitest)
- Lint: `pnpm lint` (ESLint; `core/**` no puede importar `electron`)
- Format: `pnpm format` / `pnpm format:write` (Prettier)
- Tipos: `pnpm typecheck` (TypeScript estricto)

Rigor acordado: **estricto** (el proyecto maneja tokens de autenticación, aunque nunca se guardan en disco) — todo cambio no trivial pasa por lint + typecheck + tests antes de mergear, y los cambios de seguridad/credenciales llevan revisión obligatoria.

Comandos de evidencia (estos mismos de verificación, además del manifiesto y el retiro) se ejecutan con `RTK_DISABLED=1` — RTK no debe comprimir la salida que SFP necesita completa.

## Aprobación humana obligatoria

Producción, operaciones destructivas, secretos, pagos, infraestructura crítica, eliminación masiva, cambios globales o de metodología, **y además en este proyecto**:

- Cualquier cambio al flujo de `git credential` / GCM / `includeIf` (`docs/adr/0004-modelo-de-credenciales-e-identidad.md`, `docs/adr/0006-seguridad.md`).
- Cualquier paso de firma o publicación de release (SignPath, tags, GitHub Releases).

## Roles disponibles

Ninguno formal por ahora (proyecto en solitario, sin orquestador). Se puede definir alguno más adelante si hace falta separar explícitamente "implementar" de "revisar".

## Skills/herramientas y precedencia

Instaladas vía `integrations.sh` (a nivel proyecto, excepto RTK que es global): `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `receiving-code-review`, `finishing-a-development-branch` (subconjunto de Superpowers), Serena (MCP, `.mcp.json`), archify, frontend-design, RTK (hook global, ya existente). **SFP manda en specs, planes, tareas, sub-agentes, worktrees, revisión, gates y memoria del proyecto** — ninguna de estas herramientas decide eso. Cada una actúa solo con su disparador:

| Disparador                                                                                                    | Herramienta                      | Prohibido explícitamente                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementar un ítem de `tasks.md` (o un cambio trivial) con comportamiento verificable                        | `test-driven-development`        | Saltarse la spec en cambios no triviales; el gate de tests sigue corriendo la suite completa después                                         |
| Un bug, test que falla, comportamiento inesperado                                                             | `systematic-debugging`           | Aplicar un arreglo que cambie contratos/comportamiento sin pasar por la spec                                                                 |
| A punto de declarar terminado, commit o PR                                                                    | `verification-before-completion` | Inventar comandos: usa los de "Verificación" de arriba                                                                                       |
| Llegan hallazgos de revisión (del Reviewer de SFP o de una persona)                                           | `receiving-code-review`          | Iniciar revisiones — eso es SFP                                                                                                              |
| Trabajo terminado y verificado: merge, PR, conservar o descartar rama                                         | `finishing-a-development-branch` | Merge/push/borrar ramas sin tu aprobación; crear worktrees                                                                                   |
| Encontrar/renombrar/refactorizar por símbolo en código real (hoy el repo es chico; aplica cuando haya código) | Serena                           | Leer/listar/buscar texto (herramientas nativas); memorias, onboarding, documentación                                                         |
| Diagramar arquitectura **ya decidida o existente**                                                            | archify                          | Proponer o decidir arquitectura (eso es la fase de diseño de la spec); explainers proactivos                                                 |
| Crear o rediseñar UI visual (Fase 3, portar el prototipo — `docs/adr/0007-frontend.md`)                       | frontend-design                  | Backend, APIs, datos, arquitectura general, elección de stack; no sustituye los gates                                                        |
| Salida de comandos de shell rutinarios                                                                        | RTK (hook automático)            | Comprimir evidencia de SFP (scripts de `spec-first-protocol` excluidos; comandos de evidencia con `RTK_DISABLED=1`); adoptar su proxy de API |

## Modelos por tier

Por ahora, un solo modelo para todo: **la mejor versión disponible de Sonnet** (sin diferenciación de tiers todavía; revisable cuando se quiera usar más de un modelo).

Señales de alto riesgo (siempre tratar el cambio como no trivial, sin importar cuántos archivos toque): flujo de credenciales/GCM/`includeIf`, autenticación OAuth (GitHub)/PAT (GitLab), firma y publicación de release, cualquier dato que pudiera filtrar un token.

## Métricas

Anotación manual por tarea (sin archivo dedicado): si hace falta medir algo puntual, se anota directamente en el `tasks.md` del change correspondiente.

## Contexto

Cargar solo lo necesario para la tarea actual. No leer `C:\Users\2510TK0506260\sfp\` completo salvo que algo aquí remita explícitamente a él.
