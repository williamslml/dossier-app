# Capa de especificación (documentos libres)

Sin herramienta externa: cada **cambio no trivial** (varios archivos/módulos, cambia comportamiento o contrato, riesgo medio/alto — y en este proyecto, cualquier cambio que toque credenciales/GCM/`includeIf`/OAuth/firma/release, aunque sea pequeño) se planifica primero aquí, **antes** de escribir código.

## Estructura

```
docs/specs/
├── changes/
│   ├── en-curso/<nombre-del-change>/     # mientras está activo
│   │   ├── proposal.md       # por qué, qué cambia, qué queda fuera
│   │   ├── requirements.md   # requisitos con escenarios verificables
│   │   ├── design.md         # enfoque técnico
│   │   └── tasks.md          # checklist, unidad de trabajo; estado compartido entre sesiones
│   └── archivados/<nombre-del-change>/   # al cerrarse, se mueve aquí tal cual
```

Un cambio **trivial** (fix puntual, ajuste de texto, nada de lo anterior) se implementa directo con verificación básica, sin pasar por aquí.

## Flujo por sesión (sin orquestador)

Cada sesión de agente es independiente: lee la spec → toma un ítem de `tasks.md` → implementa → verifica → marca el ítem → si algo no obvio ocurrió, anota una lección en `../lessons/`. El estado compartido entre sesiones es `tasks.md`, no el historial del chat.

La revisión de un change (sobre todo si toca una señal de alto riesgo) se hace en una **sesión separada**, a partir de la spec + `tasks.md` + diff — no del historial de la sesión que implementó.

## Frontera con ADR

La spec responde **qué** se construye en este cambio y se archiva cuando termina. Si el cambio revela una decisión arquitectónica permanente (que otros cambios futuros deben respetar), eso se documenta como ADR en `../adr/`, no aquí — nunca la misma decisión en los dos lugares.
