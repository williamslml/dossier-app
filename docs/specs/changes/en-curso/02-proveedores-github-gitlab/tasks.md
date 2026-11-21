# Tasks — Fase 2: proveedores

`[⚠APROBACIÓN]` = toca autenticación OAuth/PAT real (`CLAUDE.md`): parar y pedir aprobación explícita antes de ejecutar ese paso.

## 1. GitHub (P1) — TDD para lo testeable sin red

- [x] RED: test de `deriveNoreplyEmail` — confirmado, fallaba por módulo inexistente
- [x] GREEN: `deriveNoreplyEmail` (2/2 tests) + `linkGithub` implementado completo (Device Flow + `GET /user`), typecheck/lint en verde — **sin ejecutar el Device Flow todavía**
- [ ] `[⚠APROBACIÓN]` Correr `linkGithub` completo contra GitHub real (interactivo: abrir `verification_uri`, escribir `user_code`) — pendiente de tu confirmación
- [ ] Con el token real obtenido: confirmar que `core/features/git-credential` lo guarda/recupera correctamente con `username=login`
- [ ] Si falla con `username=login`, repetir con `username=x-access-token` — documentar cuál funcionó como ADR (actualiza ADR 0004) y como resolución de la decisión abierta de `docs/product.md` §7.6

## 2. GitLab (P2) — TDD con servidor de prueba local

- [x] RED: test con servidor HTTP efímero simulando `/api/v4/user` — confirmado
- [x] GREEN: `linkGitlab` implementado
- [x] Caso 200 sin `email`/`public_email` (devuelve `undefined`, no inventa un patrón)
- [x] Caso 401 (mensaje de error claro, sin filtrar el token — verificado explícitamente en el test)
- [x] `host` es parámetro real, probado contra dos servidores de prueba distintos, no hardcodeado

**5/5 tests en verde** (`gitlab.test.ts`), verde a la primera corrida.

## 3. Cierre del change

- [ ] Los 2 criterios (P1–P2) verificados y anotados aquí
- [ ] Decisión abierta `docs/product.md` §7.6 (`x-access-token`) resuelta
- [ ] Si algo no obvio ocurrió, anotar lección en `../../../lessons/`
- [ ] Mover esta carpeta a `../archivados/`
- [ ] Revisar si el change `00` ya puede archivarse (con esto se resuelve su último pendiente real)
