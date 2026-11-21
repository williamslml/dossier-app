# 0004. Modelo de credenciales e identidad: GCM + `includeIf`

## Status

Aceptado

## Context

Dossier necesita que varias cuentas de GitHub/GitLab convivan en la misma máquina, sin SSH, sin backend y sin guardar secretos propios (`docs/product.md` §1). Había que elegir cómo se guardan los tokens y cómo Git decide qué identidad/cuenta usar en cada carpeta.

## Decision

| Tema                            | Decisión                                                             | Motivo                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credenciales                    | **Git Credential Manager**, vía `git credential approve/fill/reject` | Incluido en Git for Windows, usa el almacén del SO, soporta varias cuentas en el mismo host y evita escribir tokens en JSON. No hay helper propio ni segundo binario que firmar   |
| Selección de cuenta por carpeta | **`includeIf` + `credential.<URL>.username`**                        | Git resuelve la cuenta por `cwd`; no hace falta un resolvedor en tiempo de ejecución ni un proceso extra. Patrón documentado por GCM y usado por proyectos maduros del ecosistema |
| Identidad de commits            | **`includeIf` de Git**                                               | Evita carreras al cambiar `user.name`/`user.email` globales                                                                                                                       |

**Confirmado en Windows real** (`docs/specs/changes/en-curso/00-spike-base-y-gcm/`): `approve`→`fill` devuelve el token correcto por `username` en el mismo host, sin red cuando hay una credencial cacheada que coincide. Si no hay coincidencia, GCM intenta un _probe_ de red para autodetectar el proveedor del host — ver `docs/lessons/README.md`, relevante para el diseño del futuro "Doctor".

### Arquitectura de procesos

```
  Editores y terminales
  (VS Code · Zed · Cursor · Warp …)
                  │  git clone / pull / push
                  ▼
           ┌─────────────┐
           │     git     │
           └──┬───────┬──┘
              │       │
   includeIf  │       │  credential.<URL>.username
   (user.*)   │       │
              ▼       ▼
        ┌──────────────────────┐
        │ GCM (Git for Windows)│
        └──────────┬───────────┘
                   ▼
        Windows Credential Manager

  Main (Electron) ── IPC (zod) ── Renderer (Preact)
        │
        ▼
  core → accounts.json · rules.json · state.json · ~/.gitconfig
```

### Flujo de un `git push`

1. Git entra al repositorio y aplica los `includeIf` generados: `user.name`, `user.email`, `credential.<host>.username` y `credential.<host>.useHttpPath=false` para los hosts gestionados.
2. Git llama a GCM con `protocol`, `host`, `path` y el `username` inyectado.
3. GCM devuelve el token guardado para ese `host + username`.
4. Si no hay token o GCM pide interacción, Git falla de forma no interactiva; la app solo informa de errores en operaciones que ella misma lanza, sin abrir ventanas o terminales de credenciales de forma silenciosa.
5. Después de vincular una cuenta, `core` guarda el token con `git credential approve` y comprueba con `git credential fill`.

### Flujo de guardado y borrado de tokens

1. El proveedor entrega `username` y `token`.
2. `core` ejecuta `git credential approve` con `protocol=https`, `host=<host>`, `username=<login>`, `password=<token>`.
3. Las ejecuciones usan `GIT_TERMINAL_PROMPT=0`, `credential.interactive=false` y `credential.guiPrompt=false`; timeout y `stderr` nunca se envían al renderer.
4. `git credential fill` verifica que el par `username/token` volvió del almacén. Si no vuelve, se bloquea el guardado y se avisa.
5. Al quitar una cuenta se usa `git credential reject` con los mismos campos.

Las tres reglas anteriores **ya están implementadas** en `core/features/git-credential/` (migrado del spike, Fase 1).

### Selección de cuenta (implementado en `core/features/rules` + `core/features/gitconfig`, salvo lo marcado)

1. **Cuenta activa:** `active.gitconfig` se incluye al final del config global para que sus valores prevalezcan sobre `user.*` globales previos. _(Pendiente: todavía no hay consumidor de `state.json`/`activeId`.)_
2. **Carpeta fijada:** los bloques `includeIf "gitdir/i:<ruta>/"` se escriben después de ese include, de menos a más específico, porque Git aplica los valores en orden de aparición. **Implementado**: `core/features/gitconfig` escribe con `--add` (crece al final).
3. **Solapamientos:** una carpeta solo puede pertenecer a una cuenta; al fijar una carpeta dentro de otra se rechaza el cambio indicando el conflicto. No hay competencia por prefijo. **Implementado**: `core/features/rules`, `FolderOverlapError`.
4. **Quick Clone:** se lanza `git -c credential.<URL>.username=<login> clone <url>`; el token sale de GCM, nunca de la URL ni de una variable de entorno con el secreto. _(Pendiente, Fase 4 — ver `docs/product.md` §3.3.)_

La distinción de mayúsculas en Windows la resuelve `gitdir/i:`; `core/features/rules` usa el mismo criterio (normaliza a minúsculas) para detectar solapamientos antes de llegar a Git.

### Identidad y `includeIf` (archivos)

- `~/.<dataDir>/active.gitconfig`: `user.name`, `user.email`, `credential.<host>.username` y `credential.<host>.useHttpPath=false` de la cuenta activa.
- `~/.<dataDir>/profiles/<id>.gitconfig`: el mismo bloque para cada cuenta.
- `<dataDir>` y los marcadores de la región delimitada salen de la configuración de marca (ADR 0005), nunca de literales.
- La región delimitada va **al final** del config global: primero el include de `active.gitconfig`, después los `includeIf` de los pins, de menos a más específico. Todo lo ajeno a esa región se conserva; si el usuario añade líneas nuevas, la región vuelve a moverse al final.
- Se hace una copia única del config global antes de la primera modificación.
- La lectura/escritura usa `git config --file` vía `simple-git`, sin parsear `.ini` a mano. **Implementado.**

### Integración con GCM

- Git for Windows instala GCM por defecto. La app verifica `git config --get-all credential.helper` y exige que aparezca `manager` o `manager-core`.
- No se reinicia ni se sobrescribe la cadena de helpers del usuario: si GCM no está, se muestra un estado accionable para reinstalar Git for Windows con GCM.
- Si otro helper anterior en la cadena pudiera responder primero, se marca la configuración como incompatible y se pide intervención explícita; la app no reordena helpers por su cuenta.
- `credential.<URL>.username` permite varias cuentas en el mismo host; el config generado fija `useHttpPath=false` para los hosts gestionados. Que un token OAuth/PAT precargado por la app se recupere usando el `login` de la cuenta es la hipótesis crítica — **confirmada** en el spike (host desconocido para GCM) y en la verificación en vivo de la Fase 2 con una cuenta real de `github.com`: `fill` con el `login` real devuelve una credencial válida.
- **Hallazgo de la Fase 2** (verificación en vivo, `docs/lessons/README.md`): para hosts que GCM reconoce nativamente (`github.com`), todo indica que GCM resuelve/valida la identidad real del token en vez de confiar ciegamente en el `username` pasado a `approve` — aprobar con `username=x-access-token` no dejó ninguna entrada recuperable bajo ese nombre literal. Por eso `core` usa siempre el `login` real como `username`, nunca `x-access-token` (resuelve la decisión abierta de `docs/product.md` §7 sobre esto).
- `git credential approve` es la forma canónica de precargar credenciales en GCM; `git credential fill` se usa para verificar. `git credential reject` hace el borrado.
- Toda llamada se ejecuta con interacción desactivada y timeout; un fallo nunca deja un prompt colgando ni bloquea el `push` de forma indefinida.
- La desinstalación solo quita la región generada en `.gitconfig`, los JSON de `~/.<dataDir>` y las credenciales creadas por la app; no modifica helpers de terceros.
- Referencia: documentación de GCM sobre [multiple users](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/multiple-users.md), [configuración](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/configuration.md) y [git credential](https://git-scm.com/docs/git-credential).

## Alternatives

Ver ADR 0003 (catálogo de librerías y soluciones existentes revisadas) — SSH y un credential helper propio se descartaron ahí, no aquí, porque son decisiones de alcance del producto completo, no solo de este mecanismo.

## Consequences

- ~~Si GitHub exige `x-access-token`...~~ — **resuelto en Fase 2**: no hace falta, se usa el `login` real en todos lados (`approve`, `includeIf`, Quick Clone).
- El Doctor (pendiente) tiene que distinguir "cuenta no vinculada" de "fallo de red al autodetectar el proveedor" — ver `docs/lessons/README.md`.

## References

- `docs/specs/changes/en-curso/00-spike-base-y-gcm/` (spike que validó esto)
- `core/features/git-credential/`, `core/features/gitconfig/`, `core/features/rules/`
- `docs/lessons/README.md` (hallazgos de GCM/`includeIf`)
- ADR 0003 (stack), ADR 0005 (marca — `dataDir`/marcadores)
