# Tasks — Simplificar cuentas y bandeja

Ver `proposal.md` para la secuencia completa (feedback en vivo, un paso a la vez). Esta spec documenta trabajo ya implementado y verificado en vivo con el usuario real durante la propia sesión — no precedió al código, lo registra.

## 1. Pantalla principal (`AccountCard.tsx`)

- [x] Sacar el punto tipo radio y el badge "En uso" — verificado en vivo (capturas reales)
- [x] El clic en la tarjeta entera abre las carpetas de esa cuenta (antes: seleccionaba la cuenta activa)
- [x] Sacar el botón/ícono de carpeta aparte (ya redundante)
- [x] Hover con borde negro (`var(--fg)`) en vez del borde de "seleccionado" — verificado en vivo

## 2. Bandeja (`main/index.ts`)

- [x] Menú reducido a Abrir / Tema / Salir
- [x] Sacado el submenú "Cuentas vinculadas" (probado en vivo primero, antes de sacarlo)
- [x] Sacado "Inicio con Windows" de la bandeja (sigue en Ajustes)
- [x] "Sistema" en vez de "Según el sistema" (Tema, bandeja y Ajustes)

## 3. Código muerto (confirmado con el usuario antes de tocar `core/`)

- [x] `src/renderer/.../store.ts`: sin `selectAccount`
- [x] `src/preload/index.ts`: sin `selectAccount`
- [x] `src/shared/ipc-channels.ts`: sin el canal `selectAccount`
- [x] `src/main/index.ts`: sin el handler/función/schema de `IPC.selectAccount`
- [x] `core/features/identity/identity.ts` + `core/index.ts`: sin `setActiveAccount`/`writeSigningKey` (`getActiveConfigPath`/`getProfilePath`/`writeAccountProfile` intactos, siguen en uso real)
- [x] Tests ajustados, no solo borrados a ciegas: `identity.test.ts` sin los describe de las funciones borradas; `end-to-end.test.ts` reescrito para no depender de `setActiveAccount` donde el test seguía siendo válido (M6: carpeta fijada vs. sin fijar), y sin el test que probaba específicamente "activar cuenta cambia la identidad" (ya no existe esa acción)

## 4. Switch de firma huérfano (`Ajustes.tsx`, "Próximamente")

- [x] Confirmado con el usuario qué hacía el switch y por qué ya no servía (ni antes de hoy: nunca existió UI para asignar una clave a una cuenta)
- [x] Sacado el switch + la sección "Próximamente" completa (era su único contenido)
- [x] `core/features/settings/settings.ts` (+ test) sin `applySigningKeyOnSwitch`
- [x] `docs/product.md` anota el diseño correcto para el futuro (propuesto por el usuario): la clave de firma como parte del perfil de la cuenta, no de un switch global

## 5. Efecto secundario real (no hipotético) encontrado en el camino

- [x] La identidad de Git de la carpeta `dossier-app` (nunca fijada a ninguna cuenta) cambió al probar el switch de cuenta activa — restaurada manualmente (`active.gitconfig` reescrito con los valores originales)
- [x] 3 commits locales que quedaron firmados con la cuenta de prueba, recreados con el autor correcto (`git cherry-pick -n` + `git commit --author`, nunca `--reset-author`: no existe en `git cherry-pick` de la versión instalada, a pesar de la memoria/intuición de que sí) — árbol final verificado idéntico al original (`git diff` vacío contra una rama de respaldo, borrada después)
- [x] Lección anotada en `docs/lessons/README.md`

## 6. Verificación

- [x] `pnpm typecheck && pnpm lint && pnpm test` en verde en cada paso (115 tests al final, bajando desde 122 por los tests borrados/ajustados de las secciones 3 y 4)
- [x] Verificado en vivo con el usuario real en cada paso de la cadena, no solo al final

## 7. Cierre del change

- [x] Revisión en sesión separada (señal de alto riesgo: borra funciones de `core/features/identity`) — sin hallazgos bloqueantes; confirmó (corriendo typecheck/lint/test ella misma, no solo leyendo) que nada quedó roto o a medias, que `ensureActiveInclude`/`getActiveConfigPath` siguen intactos, que las aserciones reescritas de `end-to-end.test.ts` reflejan comportamiento real (no solo compilan), que el switch de firma se sacó consistente en las 4 capas, y que no quedó CSS huérfano. Un hallazgo menor no bloqueante: `activeId`/`setActiveId`/`getActiveId` (`core/features/state`, un módulo aparte de `identity`) había quedado sin ningún caller ni lector real — mismo patrón de código muerto, en un feature que la spec original no cubrió. Corregido: se borró el módulo entero (`core/features/state`, con su test), y `activeId` de `DossierState`/preload/renderer — typecheck/lint/test en verde (112 tests, bajando de 115)
- [ ] Merge con `finishing-a-development-branch` — pendiente de tu aprobación
- [ ] Mover la spec a `../archivados/` — pendiente de tu confirmación
