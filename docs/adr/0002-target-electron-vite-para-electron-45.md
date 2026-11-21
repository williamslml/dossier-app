# 0002. Target de `electron-vite` fijado a mano para Electron 45

## Status

Aceptado

## Context

Decisión abierta original (hoy resuelta, ver `docs/product.md` §7.5): "Target de `electron-vite` 6: verificar build con Electron 45 y dejar fijado `node24.22 / chrome156`." El mapa interno de `electron-vite` 6.0.0 solo conoce versiones hasta Electron 44 (`docs/adr/0003-stack-fundacional-y-sin-backend.md`, fila "Build"), así que no se puede confiar en que la herramienta detecte el target correcto para Electron 45 por sí sola.

## Decision

En `electron.vite.config.ts`, fijar `build.target` explícitamente en las 3 secciones:

```ts
main: {
  build: {
    target: 'node24.22'
  }
}
preload: {
  build: {
    target: 'node24.22'
  }
}
renderer: {
  build: {
    target: 'chrome156'
  }
}
```

Verificado en el spike R6 (`docs/specs/changes/en-curso/00-spike-base-y-gcm/`): compila sin error con Electron 45.4.1 real, `electron-vite` 6.0.0, `@preact/preset-vite` 2.10.6 (versiones exactas del catálogo, `docs/adr/0003-stack-fundacional-y-sin-backend.md`), y la app arranca y renderiza sin error (`R6-SPIKE-OK`, `exit=0`).

## Alternatives

- **Dejar que `electron-vite` detecte el target automáticamente**: descartada — su mapa interno no llega a Electron 45; el resultado sería un target más viejo del real, con riesgo de usar sintaxis/APIs que el runtime real no soporta o de no aprovechar las que sí soporta.

## Consequences

- Si el proyecto actualiza de Electron 45 a una versión mayor, hay que volver a fijar `node<version>`/`chrome<version>` a mano aquí (y revisar si `electron-vite` ya lo soporta nativamente en ese momento).
- El preload se emite como `index.mjs` (no `.js`) por el `"type": "module"` del `package.json`; cualquier referencia a la ruta del preload desde `main` debe usar esa extensión (lección en `docs/lessons/README.md`).

## References

- `docs/adr/0003-stack-fundacional-y-sin-backend.md` (catálogo de librerías), `docs/product.md` §7.5 (decisión abierta)
- `docs/specs/changes/en-curso/00-spike-base-y-gcm/` (R6: `design.md`, `requirements.md`, `tasks.md`)
- `docs/lessons/README.md` (hallazgos de implementación)
