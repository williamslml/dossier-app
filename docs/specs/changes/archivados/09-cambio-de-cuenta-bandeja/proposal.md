# Proposal — Cambio de cuenta activa desde la bandeja

**Señal de alto riesgo** (`CLAUDE.md`): toca el flujo de identidad (`includeIf`/cuenta activa) — revisión obligatoria en sesión separada antes de mergear, aunque el cambio en sí sea chico.

## Por qué

`docs/product.md` §2 (alcance completo): "Cambio de cuenta activa con un clic desde la bandeja" — listado, sin implementar. Hoy, cambiar de cuenta activa exige abrir la ventana principal y hacer clic en una tarjeta de cuenta (`IPC.selectAccount`, ya implementado y probado). El menú de la bandeja (clic derecho) hoy solo tiene Abrir/Tema/Inicio con Windows/Salir — no hay forma de cambiar de cuenta sin abrir la ventana.

## Qué cambia

1. **`src/main/index.ts`**: la lógica de `IPC.selectAccount` (fijar `activeId`, llamar `setActiveAccount`, aplicar la clave de firma si corresponde) se extrae a una función compartida, para que el handler de IPC y el nuevo item del menú de la bandeja llamen exactamente al mismo camino — nunca una copia paralela.
2. **`buildTrayMenu`**: nuevo submenú "Cuenta activa" (debajo de "Abrir", antes de "Tema"), un item tipo radio por cada cuenta vinculada (`label` de la cuenta), marcando la activa. Clic en una cuenta → la función compartida del punto 1 → reconstruir el menú (mismo patrón que ya usa `Tema`/`Inicio con Windows`).
3. El menú de la bandeja se reconstruye también después de vincular una cuenta nueva (`startGithubLink`/`linkGitlab`), para que aparezca sin tener que cerrar/reabrir la app — hoy esos dos handlers no reconstruyen el menú porque no había nada en él que dependiera de la lista de cuentas.

## Qué NO cambia / queda fuera

- **Ningún comportamiento nuevo de identidad**: se reusa `setActiveAccount`/la clave de firma exactamente como ya funciona desde la pantalla principal — esto es una segunda entrada a la misma lógica ya probada, no lógica nueva.
- **Renombrar o quitar cuentas desde la bandeja**: fuera de alcance (`docs/product.md` ya lo lista aparte como "Etiquetas editables", pendiente, sin spec todavía).
- **Indicar la cuenta activa en el ícono de la bandeja** (p. ej. un badge): no lo pide `docs/product.md`, se puede agregar después si hace falta.
- **Ordenar las cuentas en el menú**: se listan en el orden que ya devuelve `accountsStore.list()` (el mismo orden que usa la pantalla principal) — no se agrega ningún criterio nuevo de orden.

## Riesgos

- **Con cero cuentas vinculadas**: el submenú "Cuenta activa" debe quedar vacío o deshabilitado, nunca romper la construcción del menú.
- **Reconstruir el menú en el momento equivocado** podría perder el submenú de Tema/Inicio con Windows si no se pasan los mismos datos que antes — se prueba que las dos secciones siguen presentes después de cada reconstrucción.
- **Mismo riesgo ya aceptado por `IPC.selectAccount`**: si `setActiveAccount` falla (p. ej. no puede escribir el perfil), el error debe verse — no silenciarse solo porque ahora el disparador es un clic de menú nativo en vez de un IPC con promesa que el renderer puede mostrar. A definir al implementar cómo se reporta un error desde un click handler de `Menu` (no hay una pantalla ahí para mostrarlo).

## Criterio de éxito

- Con dos o más cuentas vinculadas: clic derecho en la bandeja muestra "Cuenta activa" con todas, la activa marcada; clic en otra cambia la identidad (confirmado con `git config --get user.email` en una carpeta sin fijar) y el menú refleja el cambio en la próxima apertura.
- Vincular una cuenta nueva (GitHub o GitLab) la hace aparecer en el submenú sin reiniciar la app.
- Con cero cuentas: el menú no rompe, el submenú queda vacío/deshabilitado.
- `pnpm typecheck && pnpm lint && pnpm test` en verde.
