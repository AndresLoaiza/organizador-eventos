# Organizador de Eventos

App para gestionar la asistencia a festivales de artes escénicas: programación, boletas y bitácora. Un solo usuario.

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

## Cómo se entra desde el celular

No hay login. Se abre el enlace secreto una vez y ya. En Vercel, la misma URL con `?k=`.

Ninguna llave de Supabase llega al navegador: todo pasa por route handlers en el servidor. Por eso la URL secreta acá sí protege, y no solo esconde.

Los datos van por **Postgres directo**, no por PostgREST. Dos razones: PostgREST no ejecuta DDL, y así la app no depende de la `service_role`, que en este proyecto es compartida con `polla-app` y `viajes-app`. Una llave menos circulando. Storage sí la necesita, porque los bytes viven en S3 y no en la base.

La conexión va al pooler de la región del proyecto (`aws-1-us-east-1`, puerto 5432 en local y 6543 en Vercel). El host `db.<ref>.supabase.co` resuelve solo a IPv6 y no sirve desde redes sin ruta IPv6. El root CA de Supabase va versionado en `lib/supabase-ca.mjs` con verificación de huella: sin él, Node rechaza la cadena.

## Módulos

**Boletas.** Se sube la foto o el PDF, el original se guarda tal cual y no se toca nunca. Las correcciones viven en la base.

**Un archivo puede traer varias boletas.** Cuando se compran dos entradas de la misma función, el operador manda un solo PDF con las dos, una por página. Por eso hay dos tablas: `archivos` es lo que se sube y es único por hash; `boletas` es lo que sirve para entrar a una sala, una por persona. Contar archivos en vez de boletas producía la alarma falsa "necesitas 2 y solo hay 1" en funciones que estaban completas.

Convención de claves en Storage:

```
baul/{festival}/{AAAA-MM-DD}_{HHMM}_{obra}_{sala}_{hash8}.{ext}
```

Fecha primero para que el orden alfabético sea el cronológico. Hora porque hay dobles funciones. Hash del contenido para que subir dos veces la misma foto no duplique ni sobrescriba.

**Bitácora.** Texto libre primero, estrellas después. `npm run obsidian:sync` lo lleva a `vida_personal/gustos-artes-escenicas.md`.

**Programación y decisión.** Fase 2. El motor de choques ya está portado y probado en `lib/decisor.mjs`; falta el cargador multi-festival y la tabla exportable.

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
| `npm test` | 31 pruebas del motor de choques, las alarmas y la agenda, con datos reales de la Fiesta |
| `npm run migrar` | Aplica el schema por Postgres directo |
| `npm run setup` | Verifica el schema y crea el bucket |
| `npm run seed` | Carga festival, salas, traslados, funciones y boletas |
| `npm run boletas:pendientes` | Baja a `trabajo/` los archivos que faltan extraer |
| `npm run boletas:aplicar` | Escribe lo extraído |
| `npm run baul:backup` | Copia el bucket entero a disco |
| `npm run obsidian:sync` | Lleva la bitácora al perfil de Obsidian |

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
- **La unidad de extracción es el archivo, no la boleta.** Al leer un PDF hay que contar cuántas entradas trae antes de escribir filas. Hay test de regresión.
- **"Falta comprar" no es lo mismo que "falta el archivo".** Una función comprada cuyo PDF sigue en el correo no cuenta como pendiente de compra; para eso está el aviso de baúl.
