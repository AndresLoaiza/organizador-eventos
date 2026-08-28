# Organizador de Eventos

App para gestionar la asistencia a festivales de artes escénicas: programación, boletas y bitácora. Un solo usuario.

**En línea:** https://andresloaiza.github.io/organizador-eventos/

Diseño completo en [docs/superpowers/specs/2026-08-24-organizador-eventos-design.md](docs/superpowers/specs/2026-08-24-organizador-eventos-design.md).
Identidad visual en [PRODUCT.md](PRODUCT.md) y [DESIGN.md](DESIGN.md).

## Arranque

```bash
npm install
cp .env.example .env.local
```

`.env.local` lleva cuatro valores, todos del proyecto **nuestros-viajes**:

- `SUPABASE_PROJECT_REF` y `SUPABASE_DB_PASSWORD` (Project Settings > Database): mueven datos y DDL.
- `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API Keys > secret key): solo para Storage. Sin ella la app corre completa salvo subir y ver archivos, y lo dice.
- `ACCESO_SECRETO`: cualquier UUID.

```bash
npm run migrar   # aplica las migraciones de supabase/ en orden
npm run setup    # verifica schema y bucket
npm run seed     # carga la 22.ª Fiesta y sube los archivos de D:\Download
npm run dev
```

Entra una sola vez con `http://localhost:3000/entrar?k=TU_ACCESO_SECRETO`. Queda una cookie `httpOnly` por 120 días.

## Cómo se entra

Se escribe un código una vez por dispositivo y queda guardado ahí. No hay login ni contraseña que recordar caminando.

En hosting estático no hay servidor donde esconder una llave: el navegador habla con Supabase usando la llave publishable, que viaja en el bundle y además ya está publicada en `polla-app` y `viajes-app`. Lo que protege los datos no es la llave, es el código:

- El cliente lo manda en la cabecera `x-acceso` y **Postgres lo verifica en RLS**. Sin él las consultas devuelven cero filas, no un error.
- El hash vive en `eventos.acceso`, tabla sin grants ni políticas: solo la lee `eventos.acceso_ok()`, que corre como `security definer`. Consultarla por la API devuelve 401 incluso con el código correcto.
- El código no está en ningún archivo del repositorio ni en el bundle. Se rota con `npm run codigo`, que lo imprime una sola vez.

**Dos mundos que leen lo mismo.** La app publicada lee por PostgREST desde el navegador (`lib/cliente.mjs`); los scripts locales leen por Postgres directo (`lib/db.mjs`), porque PostgREST no ejecuta DDL. Los dos pasan por `lib/panorama.mjs`, que es donde vive el cruce: si se duplicara, los veredictos empezarían a diferir.

La conexión de los scripts va al pooler de la región del proyecto (`aws-1-us-east-1`). El host `db.<ref>.supabase.co` resuelve solo a IPv6 y no sirve desde redes sin ruta IPv6. El root CA de Supabase va versionado en `lib/supabase-ca.mjs` con verificación de huella: sin él, Node rechaza la cadena.

## Módulos

**Boletas.** Se sube la foto o el PDF, el original se guarda tal cual y no se toca nunca. Las correcciones viven en la base.

**Un archivo puede traer varias boletas.** Cuando se compran dos entradas de la misma función, el operador manda un solo PDF con las dos, una por página. Por eso hay dos tablas: `archivos` es lo que se sube y es único por hash; `boletas` es lo que sirve para entrar a una sala, una por persona. Contar archivos en vez de boletas producía la alarma falsa "necesitas 2 y solo hay 1" en funciones que estaban completas.

Convención de claves en Storage:

```
baul/{festival}/{AAAA-MM-DD}_{HHMM}_{obra}_{sala}_{hash8}.{ext}
```

Fecha primero para que el orden alfabético sea el cronológico. Hora porque hay dobles funciones. Hash del contenido para que subir dos veces la misma foto no duplique ni sobrescriba.

**Bitácora.** Texto libre primero, estrellas después. `npm run obsidian:sync` lo lleva a `vida_personal/gustos-artes-escenicas.md`.

**Programación y decisión.** La pantalla **Decidir** es el decisor: día por día, con filtro por franja y búsqueda, marcando funciones y viendo en el mismo renglón qué se cae por elegirlas. Con 776 opciones en diez días la pregunta deja de ser qué alcanza el bolsillo y pasa a ser qué se descarta, así que el filtro va primero y el veredicto después. Falta la exportación a Excel.

La transcripción del volante se hizo **leyendo las páginas como imagen**, no del texto extraído. El PDF es de tres columnas: al pasarlo a texto plano los campos se intercalan (la hora de una obra queda pegada a la boletería de otra) y el volante reimprime el nombre de la compañía en la columna de al lado como eco de diseño. Reconstruirlo con heurísticas de coordenadas dejaba una de cada cinco filas contaminada, y ese error es invisible después. `scripts/datos-22-fiesta.mjs` es el resultado verificado; `npm run programacion` lo carga.

## Extracción de boletas

La app no llama a ningún modelo. La extracción ocurre en una sesión de Claude Code:

```bash
npm run boletas:pendientes   # baja a trabajo/ los archivos sin extraer
# Claude lee cada archivo, CUENTA cuántas boletas trae,
# y escribe trabajo/extraido.json
npm run boletas:aplicar      # reemplaza las filas de ese archivo por las reales
```

Mientras tanto, la captura rápida de la app (obra y valor, diez segundos de pie) mantiene el estado de compra al día.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm test` | 57 pruebas del motor de choques, las alarmas y la agenda, con datos reales de la Fiesta |
| `npm run migrar` | Aplica el schema por Postgres directo |
| `npm run setup` | Verifica el schema y crea el bucket |
| `npm run seed` | Carga festival, salas, traslados, agenda y boletas |
| `npm run programacion` | Carga la programación de la Fiesta de las Artes Escénicas |
| `npm run fiesta-libro` | Carga la Fiesta del Libro desde el CSV del sitio |
| `npm run imagenes` | Sube las fotos recortadas del volante |
| `npm run boletas:pendientes` | Baja a `trabajo/` los archivos que faltan extraer |
| `npm run boletas:aplicar` | Escribe lo extraído |
| `npm run baul:backup` | Copia el bucket entero a disco |
| `npm run obsidian:sync` | Lleva la bitácora al perfil de Obsidian |
| `npm run codigo` | Rota el código de acceso y lo imprime una vez |

## Estructura

```
app/          Next.js 15 App Router. Los route handlers son lo único que toca Supabase
lib/          decisor (motor portado), alarmas, nombres, datos, db, sesion
scripts/      setup, seed, extracción, backup
agente/       puente al vault de Obsidian, corre en el PC
supabase/     migraciones SQL, las aplica npm run migrar en orden
```

## Decisiones que conviene no deshacer sin leer primero

- **El motor de choques se portó, no se reescribió.** `lib/decisor.mjs` viene de `assets/decisor.html` de la skill `festival-agenda`, con casos borde ya resueltos. Los tests congelan los cuatro veredictos.
- **`agendada` distingue el volante de la agenda.** Sin esa columna, cualquier función de la programación aparece como decidida.
- **`duracion_confirmada` marca lo que es estimación.** Las duraciones no salen del volante. Cuando un margen depende de un número inventado, la interfaz lo dice.
- **El schema es `eventos`, no `public`.** El proyecto de Supabase es compartido con `polla-app` y `viajes-app`.
- **Las alternativas de una noche se evalúan contra TODAS las agendadas del festival**, no contra las de esa fecha. Filtrar por fecha hace que el motor crea que las otras noches están libres y prometa rescates que no existen. Hay test de regresión.
- **Cada festival trae sus propias zonas de traslado.** Las de la Fiesta del Libro llevan prefijo `flc-` porque comparten ciudad con las de artes escénicas, que usan `centro` y `norte` con otro significado. Dentro del recinto el traslado son 8 minutos, no cero: son salas separadas por senderos y filas.
- **Sin elección explícita manda el festival que está corriendo hoy**, después el próximo que empieza, y solo al final el más reciente. Abrir la app en mitad de un festival y ver otro sería absurdo. Hay test.
- **Los títulos se normalizan antes de insertar.** El motor agrupa repeticiones comparando el título exacto: "Ixaquene" y "IXAQUENE" quedaban como dos obras y la app decía que se perdía algo que sí se podía ver otro día. El cargador busca un título que solo difiera en mayúsculas o tildes y reutiliza el que ya está.
- **El chip de veredicto se deriva de la marca, no de la clase.** La clase `v-lost` cubre dos casos distintos: la obra está perdida (✕) o elegirla te haría perder otra (⚠). Mapear por clase etiquetaba como "Perdida" obras que se podían ver perfectamente.
- **"No se repite" y "se repite pero ese día está ocupado" se dicen distinto.** El segundo caso tiene salida y el usuario necesita saberlo.
- **La unidad de extracción es el archivo, no la boleta.** Al leer un PDF hay que contar cuántas entradas trae antes de escribir filas. Hay test de regresión.
- **Solo se juzga lo que ya terminó, con hora.** Filtrar la bitácora por `fecha <= hoy` daba por vista la función de esa misma noche: quedaba primera por ser la más reciente y por tanto de opción por defecto en el selector. Así una impresión se guardó contra la obra equivocada. `yaTermino()` exige que haya pasado la hora de inicio más la duración, y la pantalla dice en grande qué obra se está juzgando en vez de esconderlo en un desplegable.
- **"Falta comprar" no es lo mismo que "falta el archivo".** Una función comprada cuyo PDF sigue en el correo no cuenta como pendiente de compra; para eso está el aviso de baúl.
