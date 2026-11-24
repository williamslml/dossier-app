# Dossier

*[Read in English](README.md)*

Una app de bandeja para Windows que administra varias identidades de Git por carpeta. Configura **Git Credential Manager (GCM)** y reglas `includeIf` de Git para que varias cuentas de GitHub y GitLab convivan en la misma máquina — cada carpeta elige sola la identidad del commit y la cuenta HTTPS que usa, sin tener que cambiar nada a mano.

Pensado para desarrolladores y consultores que manejan cuentas personales, de cliente y corporativas en la misma computadora.

## Qué hace

- Vincula cuentas de GitHub (Device Flow de OAuth) y de GitLab (token de acceso personal, incluidas instancias propias, no solo gitlab.com).
- Guarda los tokens en el Administrador de Credenciales de Windows vía GCM — nunca en un archivo en disco.
- Fija una carpeta a una cuenta: cada `clone`, `pull`, `push` y commit desde esa carpeta sale con la identidad correcta, sin tocar `git config` a mano.
- Quick Clone: clona un repositorio directo con la identidad de una cuenta, ya fijada.
- Una guardia de identidad opcional (hooks `pre-commit`/`pre-push`) corta un commit si la identidad real de la carpeta no coincide con la cuenta a la que está fijada.
- Un chequeo "Doctor" valida, a pedido, que cada carpeta fijada resuelva de verdad la cuenta correcta.
- Detecta si GCM y el almacén de credenciales real están funcionando, con un aviso claro cuando no.
- La clave de firma (SSH u OpenPGP) es parte del perfil de la cuenta, no un switch global — cualquier carpeta fijada a esa cuenta firma sus commits sola. Dossier nunca genera ni importa una clave, solo referencia una que el usuario ya creó.
- Si `gh` CLI ya tiene sesión en la máquina, Dossier puede ofrecer esa sesión en vez de pedir un login nuevo de GitHub.
- Se actualiza sola desde GitHub Releases.

## Qué NO hace

- No reemplaza al cliente de Git ni a Git Credential Manager, ni instala un credential helper propio.
- No usa SSH para el transporte remoto (`clone`/`fetch`/`push` siempre sobre HTTPS) — aunque el perfil de una cuenta sí puede tener una clave SSH asignada solo para *firmar* commits, una función de Git aparte del transporte.
- No tiene servidor, base de datos ni cuentas propias — no es SaaS, y ningún token sale nunca de la máquina.

## Plataforma

Solo Windows, a propósito — ver `docs/product.md` §1 para el porqué (el costo de firma de macOS, Linux fuera de alcance). El código se mantiene multiplataforma en principio (sin rutas exclusivas de Windows sin motivo), pero solo se construye, prueba y distribuye para Windows.

## Estado

La funcionalidad principal ya está construida y verificada de punta a punta contra cuentas reales de GitHub/GitLab y un Administrador de Credenciales de Windows real: vincular cuentas, identidad por carpeta, Quick Clone, la guardia de identidad, Doctor, chequeos de salud de GCM/almacén de secretos, sincronizar una sesión ya existente de `gh` CLI, gestión de cuentas (renombrar, asignar/quitar clave de firma, desvincular), Ajustes, y el pipeline de release (instalador + auto-actualización).

Queda pendiente: el instalador todavía no está firmado (pendiente de una postulación a SignPath Foundation), la importación de `glab` CLI y la detección de una credencial ya cacheada en GCM (parte de "sincronizar cuentas vinculadas antes de tener Dossier"), verificación contra una instancia real autoalojada de GitLab o GitHub Enterprise Server, y la publicación en `winget`/Scoop. El detalle completo fase por fase está en `docs/product.md` §5.

## Dónde conseguirlo

Bajá el instalador desde [GitHub Releases](https://github.com/williamslml/dossier-app/releases). Todavía no está firmado, así que Windows SmartScreen va a avisar antes de correrlo — es esperado hasta que se apruebe la postulación a SignPath Foundation.

## Compilar desde el código

Ver `docs/runbooks/arrancar-el-proyecto.md` para la configuración completa (dependencias, un paso manual obligatorio con Electron, y cómo correrlo).

```
pnpm install
node node_modules/electron/install.js   # paso manual obligatorio, ver el runbook
pnpm dev                                 # desarrollo con recarga en caliente
```

## Contribuir

Ver `CONTRIBUTING.md`. Este proyecto sigue una metodología spec-first documentada en `CLAUDE.md` — leerlo antes de proponer un cambio no trivial.

## Seguridad

Ver `SECURITY.md` para reportar una vulnerabilidad.

## Documentación

- `docs/product.md` — visión, alcance y el estado de cada fase.
- `docs/adr/` — decisiones de arquitectura ya tomadas, con el porqué de cada una.
- `docs/specs/` — qué construye cada cambio, en curso o archivado al cerrarse.
- `docs/lessons/` — hallazgos no obvios del desarrollo, para no repetir la misma investigación.

## Licencia

MIT — ver `LICENSE`.
