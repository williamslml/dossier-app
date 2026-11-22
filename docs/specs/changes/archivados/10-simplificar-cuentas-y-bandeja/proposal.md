# Proposal — Simplificar cuentas (pantalla principal) y bandeja

**Señal de alto riesgo** (`CLAUDE.md`): borra funciones del motor de identidad (`core/features/identity`: `setActiveAccount`, `writeSigningKey`) — revisión obligatoria en sesión separada antes de mergear.

## Por qué

Spec atípica: no se escribió antes de implementar, sino como cierre de una sesión de feedback en vivo, en tiempo real, con el usuario probando la app recién mergeada (`09-cambio-de-cuenta-bandeja`). Encadenado, en orden:

1. Al probar el cambio de cuenta desde la bandeja, el usuario notó que la tarjeta de cuenta en la pantalla principal también tenía un punto tipo radio y un badge "En uso" — pidió sacarlos: "da a entender que solo 1 está activo, por más que hay varios". Para este usuario, "activa" = "vinculada" — todas las cuentas lo están a la vez, cada una en sus propias carpetas fijadas.
2. Siguiente paso: pidió sacar el submenú "Cuentas vinculadas" de la bandeja directamente — en su flujo real todo está fijado, "cuenta activa" (el default para una carpeta sin fijar) no resuelve ningún problema que tenga.
3. Encadenado: simplificó el menú de la bandeja a 3 opciones (Abrir/Tema/Salir, sin "Inicio con Windows" — sigue en Ajustes), cambió el clic de la tarjeta de cuenta para que abra directo sus carpetas (en vez de "seleccionarla como activa"), sacó el ícono de pin/carpeta (ya no hace falta, la tarjeta entera es el botón), y agregó un hover con borde negro en su lugar.
4. Pedido explícito: "borra código muerto" — con el clic de la tarjeta ya no llamando a `IPC.selectAccount`, toda la cadena quedó sin ningún llamador real: `store.ts` → preload → canal IPC → handler/función en `main` → `core/features/identity`: `setActiveAccount`/`writeSigningKey`. Se confirmó con el usuario antes de tocar el núcleo (`core/`) y sus tests.
5. Efecto secundario encontrado en el camino: la carpeta del propio proyecto (`dossier-app`) nunca estuvo fijada a ninguna cuenta — probar el cambio de cuenta activa le cambió la identidad de Git real a esta carpeta (confirmado: commits de esa sesión quedaron firmados con la cuenta de prueba). Corregido manualmente (`active.gitconfig` reescrito, 3 commits recreados con `git cherry-pick -n` + `git commit --author` para el autor correcto) — ver `docs/lessons/README.md` para el detalle completo.
6. Encontrado al revisar consecuencias: el switch "Firmar commits con la clave de la cuenta" (Ajustes, sección "Próximamente") dependía de `writeSigningKey`/"cuenta activa" — ya no servía para nada (y tampoco antes: nunca existió la UI para asignarle una clave a una cuenta). Se sacó el switch y el setting (`applySigningKeyOnSwitch`), y se anotó en `docs/product.md` el diseño correcto para el futuro: la clave de firma como parte del perfil de la cuenta (`writeAccountProfile`), no de un switch global — propuesto por el propio usuario.

## Qué cambia

- `src/renderer/.../AccountCard.tsx`: sin radio, sin badge "En uso", sin botón de carpeta aparte — toda la tarjeta es clickeable y abre las carpetas de esa cuenta directo. Hover con borde `var(--fg)`.
- `src/main/index.ts`: menú de la bandeja reducido a Abrir/Tema/Salir. Borrado: `IPC.selectAccount` (handler, función, schema), `refreshTrayMenu` simplificado a solo `settings`.
- `src/preload/index.ts`, `src/shared/ipc-channels.ts`, `src/renderer/.../store.ts`: sin `selectAccount`.
- `core/features/identity/identity.ts` (+ `core/index.ts`, + tests): sin `setActiveAccount`/`writeSigningKey`. `getActiveConfigPath`/`getProfilePath`/`writeAccountProfile` intactos (siguen en uso real).
- `core/features/settings/settings.ts` (+ `Ajustes.tsx`, + tests): sin `applySigningKeyOnSwitch` ni la sección "Próximamente".
- `docs/product.md`: dos ítems del checklist de alcance actualizados reflejando las decisiones de arriba.

## Qué NO cambia

- El fallback de identidad para carpetas sin fijar (`ensureActiveInclude` + `active.gitconfig`) sigue existiendo a nivel de mecanismo de Git — solo que ya no hay ninguna UI que lo cambie. Queda congelado en lo que cada usuario tenga escrito ahí (o vacío/inexistente, en cuyo caso Git cae al `[user]` estático de su `~/.gitconfig`).
- El resto de "Ajustes" (tema, inicio con Windows, mantenimiento de credenciales) no cambia.

## Criterio de éxito

- `pnpm typecheck && pnpm lint && pnpm test` en verde.
- Verificado en vivo con el usuario real, en cada paso de la cadena (no al final): menú de bandeja de 3 opciones, tarjetas sin marcas de "activa", clic en tarjeta abre sus carpetas, hover con borde negro, sección "Próximamente" ya no aparece.
- Identidad de `dossier-app` restaurada y commits mal firmados corregidos.
