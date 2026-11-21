# Runbooks

Procedimientos operativos **repetibles**: pasos concretos para una situación que va a volver a pasar (no decisiones, eso son los ADRs; no planificación de un cambio, eso son las specs).

Candidatos para este proyecto, a medida que existan (no se crean por adelantado, solo cuando la situación ya ocurrió o es inminente):

- Release: cómo publicar un tag, qué hace `electron-builder`/`electron-updater`, cómo verificar el instalador antes de publicar.
- Rollback de una release con auto-update ya distribuido.
- Qué hacer si GCM no está disponible o la cadena de `credential.helper` tiene otro helper por delante (`docs/product.md` §6, riesgos).
- Migración de `appId`/`dataDir` si cambia el nombre de marca después de la primera release (`docs/adr/0005-configuracion-de-marca-reemplazable.md`).
- Troubleshooting de notificaciones nativas sin `AppUserModelID`/`ToastActivatorCLSID` correctos.

## Formato sugerido

```markdown
# Nombre del runbook

## Cuándo usar esto

## Prerrequisitos

## Pasos

## Verificación

## Si algo falla
```
