# Dossier

Gestor de identidades Git por carpeta: configura **Git Credential Manager (GCM)** y reglas `includeIf` de Git para que varias cuentas de GitHub y GitLab convivan en la misma máquina. Cada carpeta elige sola la identidad del commit y la cuenta que usa `clone`, `pull` y `push` — sin tocar nada a mano cada vez que cambiás de proyecto.

Pensado para quien trabaja con cuentas personales, de cliente y corporativas a la vez.

## Qué hace

- Vincula cuentas de GitHub (con el flujo de autorización de GitHub) y de GitLab (con un token de acceso personal, incluidas instancias propias, no solo gitlab.com).
- Guarda los tokens en el gestor de credenciales del sistema operativo — nunca en un archivo del disco.
- Fija qué cuenta usa cada carpeta: el commit y el `push`/`pull` salen con la identidad correcta sin intervención manual.

## Qué NO hace

- No reemplaza al cliente de Git ni a Git Credential Manager.
- No instala un credential helper propio ni usa SSH.
- No tiene servidor, base de datos ni cuentas propias — no es SaaS.
- No envía ningún token fuera de la máquina.

## Plataforma

Solo Windows por ahora (ver `docs/product.md` §1 para el porqué).

## Estado

En desarrollo activo. Ya funcionan: el guardado de credenciales, vincular una cuenta de GitHub o de GitLab desde la app, y que cada carpeta resuelva su propia identidad. Faltan: Ajustes, Clonado rápido y el instalador para distribuirlo. El detalle fase por fase está en `docs/product.md` §5.

## Cómo levantar el proyecto

Ver `docs/runbooks/arrancar-el-proyecto.md` (instalar dependencias, el paso manual pendiente de Electron, y cómo correrlo).

## Documentación

- `docs/product.md` — visión, alcance y estado de cada fase.
- `docs/adr/` — decisiones de arquitectura ya tomadas, con el porqué de cada una.
- `docs/specs/` — qué se construye en cada cambio en curso.
- `docs/lessons/` — hallazgos no obvios del desarrollo, para no repetir la misma investigación.

## Licencia

MIT.
