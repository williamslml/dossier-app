# Tasks — Fase 2: proveedores

`[⚠APROBACIÓN]` = toca autenticación OAuth/PAT real (`CLAUDE.md`): parar y pedir aprobación explícita antes de ejecutar ese paso.

## 1. GitHub (P1) — TDD para lo testeable sin red

- [x] RED: test de `deriveNoreplyEmail` — confirmado, fallaba por módulo inexistente
- [x] GREEN: `deriveNoreplyEmail` (2/2 tests) + `linkGithub` implementado completo (Device Flow + `GET /user`), typecheck/lint en verde — **sin ejecutar el Device Flow todavía**
- [x] `[⚠APROBACIÓN]` Correr `linkGithub` completo contra GitHub real — **aprobado y ejecutado** con la cuenta real `williamslml`: `login=williamslml`, `id=146768773`, email derivado correcto
- [x] Confirmar `approve`/`fill` con el `login` real y con `x-access-token` — **hallazgo real, no el esperado**: ninguno de los dos dio un match limpio porque ya existía una credencial real previa para `github.com`; `fill(x-access-token)` no encontró nada (consistente con que GCM resuelve la identidad real del token para hosts conocidos, no confía en el `username` de `approve` — ver `docs/lessons/README.md`)
- [x] Resuelto sin usar `x-access-token`: se confirma con el login real. `git ls-remote` contra un repo privado real confirmó que la credencial de `github.com` del usuario sigue operativa — nada se rompió
- [x] Documentado como lección (`docs/lessons/README.md`) y actualizado ADR 0004 + decisión abierta de `docs/product.md` §7.6

## 2. GitLab (P2) — TDD con servidor de prueba local

- [x] RED: test con servidor HTTP efímero simulando `/api/v4/user` — confirmado
- [x] GREEN: `linkGitlab` implementado
- [x] Caso 200 sin `email`/`public_email` (devuelve `undefined`, no inventa un patrón)
- [x] Caso 401 (mensaje de error claro, sin filtrar el token — verificado explícitamente en el test)
- [x] `host` es parámetro real, probado contra dos servidores de prueba distintos, no hardcodeado

**5/5 tests en verde** (`gitlab.test.ts`), verde a la primera corrida.

## 3. Cierre del change

- [x] Los 2 criterios (P1–P2) verificados: GitHub con vinculación real (31→33 tests en la suite completa), GitLab 5/5 con servidor de prueba
- [x] Decisión abierta `docs/product.md` §7.6 (`x-access-token`) resuelta — no hace falta, se usa el login real
- [x] Lección anotada en `../../../lessons/` (hallazgo de GCM resolviendo identidad para hosts conocidos)
- [ ] Mover esta carpeta a `../archivados/` — pendiente de tu confirmación
- [ ] El change `00` ya puede archivarse también (su último pendiente real quedó resuelto acá) — pendiente de tu confirmación
