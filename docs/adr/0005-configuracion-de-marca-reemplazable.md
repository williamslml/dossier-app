# 0005. Configuración de marca: un solo lugar, nombre reemplazable

## Status

Aceptado

## Context

"Dossier" es un nombre de trabajo y puede cambiar. Debía existir en **un solo lugar**, con todo lo demás leyendo de ahí — para no repetir el nombre en código, tests, CI ni rutas, y para poder renombrar el producto sin una búsqueda-y-reemplazo manual riesgosa.

## Decision

Un único módulo/archivo de configuración de marca (ubicación exacta a definir cuando se construya `main`, Fase 3) con estos campos:

| Campo                | Uso                                                                                      | Valor actual    |
| -------------------- | ---------------------------------------------------------------------------------------- | --------------- |
| `displayName`        | UI, tooltip de bandeja, título de ventana, avisos, instalador                            | Dossier         |
| `slug`               | identificadores técnicos en minúscula (`groupId` de notificaciones, nombre de artefacto) | dossier         |
| `appId`              | `AppUserModelID` y `appId` de electron-builder                                           | com.dossier.app |
| `dataDir`            | carpeta de datos en el home (`~/.<dataDir>`)                                             | dossier         |
| `gitConfigMarker`    | marcadores de la región generada en `.gitconfig`                                         | dossier         |
| `githubOAuthAppName` | nombre mostrado de la OAuth App                                                          | Dossier         |

**Reglas:**

- Ningún literal del nombre en código, textos, rutas, tests ni CI: se importa de la configuración. Los tests de integración y los scripts de build también la leen.
- Los nombres de **carpetas y paquetes internos son neutros** (`core`, `main`, `renderer`…) y no llevan el nombre de la app — ya aplicado en `core/` (Fase 1). El nombre solo aparece en la carpeta raíz del repositorio (hoy `dossier-app`), que se renombra sin afectar al código.
- `package.json` (`name`, `productName`) y la configuración de electron-builder se alimentan de la misma fuente o se verifican contra ella en CI.
- Verificación en CI: un chequeo falla si encuentra el nombre en archivos fuera de la configuración de marca, README y LICENSE. _(Pendiente: se agrega cuando exista la configuración real, Fase 3.)_

## Alternatives

- **Literales repetidos por archivo**: descartada — es exactamente lo que se quiere evitar; cambiar el nombre después de publicar ya es delicado (ver Consequences) sin además tener que auditar todo el repo.

## Consequences

**Qué implica cambiar el nombre.** Cambiar `displayName`/`slug` es trivial. Cambiar `appId` o `dataDir` **después de publicar** rompe la continuidad: nueva identidad para el auto-update y el `AppUserModelID`, y carpeta de datos distinta. Para ese caso, `core` incluye una **migración de arranque** que mueve `~/.<dataDirAnterior>` al nuevo y reescribe los marcadores de la región en `.gitconfig` _(pendiente de implementar junto con la configuración de marca)_. Recomendación: fijar `appId` y `dataDir` **antes de la primera release**. Los iconos y el nombre de la OAuth App en GitHub son pasos manuales.

## References

- ADR 0004 (`dataDir`, `gitConfigMarker` los usa el generador de `includeIf`)
- `docs/product.md` §7.1 (decisión abierta: `client_id` de la OAuth App)
