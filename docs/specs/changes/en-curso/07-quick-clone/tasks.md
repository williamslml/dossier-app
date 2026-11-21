# Tasks — Quick Clone

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de credenciales/GCM e `includeIf`. Revisión obligatoria en sesión separada, a partir de esta spec + diff, antes de mergear — no del historial de la sesión que implementó.

## 1. `core/features/clone/` — validación + clone (Q1, Q2) — TDD

- [ ] RED/GREEN: `validateCloneUrl` — tabla de casos válidos/inválidos (Q2.1/Q2.2)
- [ ] RED/GREEN: `cloneRepo` — test de integración real (sin mockear Git): clona un repo público real de GitHub a un directorio temporal, confirma el remoto resultante; un segundo caso con una URL/host inválido confirma que rechaza con el error de Git real
- [ ] Wire en `core/index.ts`

## 2. `core/features/rules/` — chequeo de solapamiento reusable (Q5)

- [ ] RED/GREEN: extraer la lógica de solapamiento que hoy vive privada dentro de `pin()` a una función exportada (`findOverlap` o nombre similar) — `pin()` pasa a usarla internamente, ningún test existente de `rules.test.ts` debería cambiar de comportamiento
- [ ] Wire en `core/index.ts`

## 3. IPC y preload (Q6)

- [ ] Canales `IPC.cloneRepo`/`IPC.cloneProgress` en `src/shared/ipc-channels.ts`
- [ ] Handler `IPC.cloneRepo` en `main` (orden exacto: cuenta → validar URL → chequear solapamiento → clonar → Auto-Pin, ver design.md)
- [ ] `cloneRepo`/`onCloneProgress` en `src/preload/index.ts`

## 4. `CloneDialog.tsx` (renderer) (Q3)

- [ ] Componente nuevo, mismo patrón visual que `GithubLinkDialog.tsx`
- [ ] Filtro de cuentas por host de la URL (Q3.2/Q3.3)
- [ ] Estados clonando/listo/error (Q3.4/Q3.5/Q3.6), reusa `showToast`
- [ ] `store.ts`: función que invoca `cloneRepo` + se suscribe a `onCloneProgress`

## 5. Habilitar el botón (Q7)

- [ ] `AddButtons.tsx`: saca `disabled`/el tooltip "Próximamente", conecta `CloneDialog`

## 6. Verificación

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` en verde
- [ ] Verificación en vivo (CDP/DOM): diálogo abre, campos en el orden correcto, filtro de cuentas por host funciona
- [ ] Verificación en vivo con un repo real: clonar un repositorio público real hacia una carpeta temporal vacía, confirmar que termina clonado y fijado a la cuenta elegida; intentar clonar hacia una carpeta ya fijada y confirmar que se rechaza antes de tocar la red

## 7. Cierre del change

- [ ] Criterio de éxito de `proposal.md` verificado y anotado acá
- [ ] Lecciones anotadas en `docs/lessons/README.md` si algo no obvio ocurrió
- [ ] Revisión en sesión separada (señal de alto riesgo) antes de mergear
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
