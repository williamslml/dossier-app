# Design — Sincronizar cuentas previas a Dossier (parte a: credencial ya guardada en GCM)

## Por qué `CredEnumerate` nativo y no `cmdkey`/`git credential-manager list`

GCM no tiene un comando de "listar credenciales de un host" genérico (a diferencia de `credential-manager github list`, específico de GitHub). `cmdkey /list` sí expone host+username de solo lectura, pero su texto sale localizado según el idioma de Windows — probado a mano contra esta máquina en español antes de descartarlo. La API nativa de Windows (`CredEnumerate`, `advapi32.dll`) da la misma información, estructurada, sin texto localizado de por medio: se invoca desde un script de PowerShell (vía `Add-Type`/P/Invoke), filtrando ya en el propio `CredEnumerate` por `"git:*"` para no traer credenciales de otras apps del mismo Credential Manager (se vio en vivo: cuentas de Microsoft, Docker, etc., todas en el mismo almacén).

## Por qué `ConvertTo-Json -InputObject`, no `-AsArray` ni el pipe

`spawn('powershell.exe', ...)` desde Node resuelve el Windows PowerShell 5.1 del sistema (confirmado spawneándolo de verdad, no solo probando en una terminal pwsh 7+). `-AsArray` (que resolvería de raíz el colapso de un array de un elemento) no existe ahí. Pasar el resultado por el pipe a `ConvertTo-Json` sin eso colapsa un array de un solo elemento a un objeto suelto — justo el caso real de "un único candidato" que el código que llama necesita distinguir de "varios" o "ninguno". `ConvertTo-Json -InputObject $resultado -Compress` (parámetro, no pipe) evita el colapso sin depender de `-AsArray`, confirmado con 0, 1 y 3 resultados contra el binario real.

## Por qué el host puede tener un username embebido en el target

Hallazgo real: con más de una credencial para el mismo host, GCM distingue la segunda (y siguientes) con el target `git:https://<username>@<host>`, no solo `git:https://<host>`. `parseGcmGitCredentialsOutput` separa un username opcional antes del host (`/^git:https:\/\/(?:[^@\/]+@)?(.+)$/`) — el username real sigue viniendo siempre del campo `UserName` propio de PowerShell, nunca de esta parte del target.

## Por qué puede haber varios candidatos, a diferencia de `glab` CLI (b)

`glab` solo tiene una sesión activa (o ninguna) por host — un único candidato posible. GCM puede tener guardadas credenciales de varias cuentas distintas para el mismo host (justo el caso que esta app maneja), así que `findImportableGcmAccountsForHost` devuelve una lista, no un candidato único — y la UI ofrece un cartel por cada uno, nunca elige por su cuenta.

## Por qué la identidad real es la que confirma la API, nunca la etiqueta de GCM

El username que GCM tenía guardado es solo una pista para saber a quién pedirle el token (`fill`) — no es necesariamente la cuenta real a la que pertenece ese token (podría estar desactualizado, o el token podría haber cambiado de dueño). Igual que con `gh`/`glab` CLI, la cuenta que se ofrece es siempre la que resuelve `linkGitlab` contra la API real, nunca la etiqueta guardada.

## Qué pasa si un candidato falla

Un candidato puede fallar en dos puntos: `fill` (ya no hay token real para ese username, por ejemplo si se borró a mano) o `linkGitlab` (el token ya no es válido). En los dos casos se descarta ese candidato en silencio (`continue`) — a diferencia de `findImportableGitlabCliAccount` (b), que al tener un solo candidato posible, propaga el error de `linkGitlab` tal cual. Acá, con varios candidatos posibles, un candidato roto no debe impedir que aparezcan los demás que sí funcionan.

## IPC y UI

`checkGcmCachedAccounts(host)` corre del lado de `main`, nunca devuelve tokens. `importGcmCachedAccount(label, host, username)` vuelve a correr la detección completa (no se guarda nada entre el chequeo y la importación) y busca el candidato por `username`, porque puede haber más de uno. `GitlabLinkDialog.tsx` reutiliza el guard de "último dominio gana" ya existente (de la revisión de `17-sincronizar-glab-cli`) para este chequeo también, llamando a los dos chequeos (CLI y GCM) desde la misma función `checkForImportableAccounts`.
