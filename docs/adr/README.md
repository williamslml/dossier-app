# ADRs (Architecture Decision Records)

Decisiones arquitectónicas **permanentes** de este proyecto: el _por qué_ de una decisión que no cambia con cada feature. No confundir con una spec (`../specs/`), que documenta la ejecución de un cambio concreto — nunca documentar la misma decisión en los dos lugares.

Un ADR se crea cuando este proyecto se desvía deliberadamente de un default de la metodología, o cuando se toma una decisión estructural que otros cambios futuros deben respetar (ej. formato del correo noreply, estrategia de `includeIf`, elección de `electron-menubar` sobre `menubar`).

## Formato

Archivo `NNNN-titulo-corto.md` (numeración secuencial):

```markdown
# NNNN. Título

## Status

Propuesto | Aceptado | Reemplazado por NNNN | Obsoleto

## Context

Qué situación obliga a decidir.

## Decision

Qué se decidió.

## Alternatives

Qué otras opciones se consideraron y por qué no.

## Consequences

Qué implica esta decisión, qué queda más difícil o más fácil.

## References

Enlaces, issues, discusiones relacionadas.
```

Las decisiones fundacionales del producto ya están documentadas como ADR (0003–0008); no es necesario reescribirlas aquí a menos que cambien o que la implementación revele una desviación respecto a lo ahí documentado.
