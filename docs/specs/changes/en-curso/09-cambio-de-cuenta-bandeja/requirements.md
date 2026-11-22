# Requirements — Cambio de cuenta activa desde la bandeja

Ver `proposal.md` para el porqué, el alcance completo y los riesgos. Acá, los requisitos con sus escenarios verificables.

## R1 — Función compartida para cambiar de cuenta activa

- **R1.1** `IPC.selectAccount` y el nuevo item del menú de la bandeja llaman a la misma función (p. ej. `selectAccount(id: string)` en `src/main/index.ts`) — nunca una copia paralela de la lógica de `setActiveAccount`/clave de firma.
- **R1.2** La función hace exactamente lo que ya hace el handler de `IPC.selectAccount` hoy: `stateStore.setActiveId(id)`, buscar la cuenta, `setActiveAccount(dataDir, account)`, y si `applySigningKeyOnSwitch` está prendido y la cuenta tiene `signingKey`, `writeSigningKey(dataDir, account.signingKey)`.

**Escenario verificable:** cambiar de cuenta desde la pantalla principal sigue funcionando exactamente igual que antes (mismo comportamiento, mismo código ejecutado) — ningún test existente de `IPC.selectAccount` cambia de resultado.

## R2 — Submenú "Cuenta activa" en la bandeja

- **R2.1** `buildTrayMenu` recibe también la lista de cuentas y el `activeId` actual (además de `settings`, que ya recibía).
- **R2.2** Nuevo submenú "Cuenta activa", ubicado entre "Abrir" y "Tema". Un item tipo `radio` por cuenta, `label` = `account.label`, `checked` = `account.id === activeId`.
- **R2.3** Clic en una cuenta → llama a la función de R1 con ese `id` → reconstruye el menú de la bandeja (mismo patrón que ya usan los clics de Tema/Inicio con Windows).
- **R2.4** Con cero cuentas vinculadas: el submenú existe pero queda deshabilitado (o no se agrega), nunca rompe la construcción del menú completo.

**Escenario verificable:** con dos cuentas vinculadas, clic derecho en la bandeja muestra "Cuenta activa" con las dos, la activa marcada; clic en la otra cambia `user.email` real (confirmado con `git config` en una carpeta sin fijar) y el próximo clic derecho ya muestra la nueva marcada.

## R3 — Reconstruir el menú al vincular una cuenta

- **R3.1** Después de que `IPC.startGithubLink` o `IPC.linkGitlab` terminan con éxito, se reconstruye el menú de la bandeja (mismo `mb.setContextMenu(buildTrayMenu(...))` que ya usa `applySettings`), para que la cuenta nueva aparezca en "Cuenta activa" sin reiniciar la app.

**Escenario verificable:** vincular una cuenta de GitHub o GitLab nueva la hace aparecer en el submenú de la bandeja en la siguiente apertura del menú, sin cerrar/reabrir la app.

## R4 — Manejo de error desde un click de menú nativo

- **R4.1** Si `setActiveAccount` (o `writeSigningKey`) lanza una excepción al hacer clic en el submenú, se loguea (`electron-log`, mismo criterio que el resto de `main`) — un click handler de `Menu` no tiene una promesa que el renderer pueda mostrar como error, así que el logueo es el único canal disponible acá (a diferencia de `IPC.selectAccount`, donde el error ya le llega al renderer tal cual).

**Escenario verificable:** si la escritura del perfil fallara (p. ej. permisos), la app no se cae ni queda en un estado roto — el error queda en el log, el menú sigue funcionando para el próximo intento.
