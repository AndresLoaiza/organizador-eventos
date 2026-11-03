# Organizador de Eventos — reescritura profunda

Fecha: 2 de noviembre de 2026
Estado: aprobado en brainstorming, pendiente de plan
Reemplaza a: `2026-08-24-organizador-eventos-design.md` (queda como histórico)

## Por qué

No se buscan más funciones. Se busca que lo que ya hay se pueda comprobar. Tres
hallazgos sobre los datos reales del 2 de noviembre de 2026 motivan el trabajo:

1. **El recomendador casi no supera el azar.** En la Fiesta del Libro (751 obras
   ojeadas) la base de «sí» es 25%; lo resaltado por `lib/interes.mjs` da 30%.
   La regla «oficio» queda por debajo de la base: 20% (4 de 20). Mientras tanto,
   la franja, que el código excluye a propósito, es lo que mejor predice:
   «El Quijote» 8 de 9, «Clases maestras» 6 de 7, «Charlas de la tarde» 18 de
   26, contra «Lanzamientos de libros» 43 de 347 y «Cine» 2 de 32.
2. **La bitácora no crece.** Tres juicios en tres festivales. Registrar cuesta
   demasiado.
3. **`bitacora.fecha` usa `current_date` del servidor en UTC.** Todo juicio
   guardado después de las 7 p.m. de Medellín queda con la fecha del día
   siguiente. Ya pasó con Mohammed y Winnipeg (2 nov guardados como 3 nov).

Y una deuda: el spec de agosto describe Vercel, route handlers y cookie
`httpOnly`. La app real es estática en GitHub Pages y se protege con la cabecera
`x-acceso` verificada en RLS. El README todavía menciona `/entrar?k=`.

## Lo que ya está decidido

- Un solo usuario, para siempre por ahora. El acceso por código en cabecera se
  queda. Nada de login ni multiusuario.
- La carga de festivales la hace Claude en sesión. No se generalizan los
  cargadores hacia una carga sin intervención; se unifica el formato.
- Claude puede leer Gmail por MCP, en sesión, solo lectura.
- La agenda va a Google Calendar. Sin service worker.
- No hay próximo festival elegido. Los tres festivales cargados son los datos
  de prueba fijos.

## Orden de trabajo

Cada subproyecto tiene su propio plan y su propia prueba de terminado.

| # | Subproyecto | Terminado cuando |
|---|---|---|
| 0 | Bug de `bitacora.fecha` | Test de un juicio a las 9 p.m. pasa; las 2 filas corregidas |
| 1 | Formato intermedio, validador y recarga | Los 3 festivales recargados desde JSON con cero diferencias |
| 2 | Recomendador con evidencia | La métrica reporta y las fuentes «ojeo» y «Claude» superan la base |
| 3 | Umbral de duración en el veredicto | Tests nuevos verdes, los 96 actuales sin cambios |
| 4 | Bitácora de un toque | Juicio guardable en un toque desde inicio |
| 5 | Google Calendar | Sesión deja un evento por función agendada, cero duplicados |
| 6 | Gmail | Sesión aplica las boletas seguras y pregunta el resto |

La skill `festival-agenda` se reescribe después de este spec y antes del código
del subproyecto 1, porque el paso 2 de la skill es quien produce el formato.

## 0. Bug de la fecha de la bitácora

Migración `011_bitacora_bogota.sql`:

```sql
alter table eventos.bitacora
  alter column fecha set default ((now() at time zone 'America/Bogota')::date);
update eventos.bitacora
   set fecha = (creado at time zone 'America/Bogota')::date
 where fecha <> (creado at time zone 'America/Bogota')::date;
```

Test de regresión: un juicio con `creado = 2026-11-03T02:00:00Z` (9 p.m. del 2
de noviembre en Medellín) queda con fecha `2026-11-02`. Termina con
`notify pgrst, 'reload schema'`.

## 1. Formato intermedio

### Archivo

Uno por festival: `festivales/{slug}.json`, versionado en git. Contiene solo lo
que publica el organizador. Lo del usuario —interés, agendada, acompañantes,
boletas, bitácora, eventos de Calendar— vive en la base y nunca entra aquí, para
que recargar no pueda pisar una decisión.

```json
{
  "formato": 1,
  "festival": { "slug": "festival-teatro-san-ignacio-2026",
                "nombre": "Festival de Teatro Comfama San Ignacio",
                "ciudad": "Medellín",
                "fecha_inicio": "2026-10-31", "fecha_fin": "2026-11-07" },
  "fuentes": [{ "key": "fuentes/festival-teatro-san-ignacio-2026/2026-10-20_a1b2c3d4.md",
                "url": "https://www.comfama.com/festivales/festival-teatro-san-ignacio/",
                "bajada": "2026-10-20",
                "metodo": "defuddle" }],
  "salas": [{ "slug": "teatro-matacandelas", "nombre": "Teatro Matacandelas",
              "direccion": "…", "zona": "centro" }],
  "traslados": [{ "zona_a": "centro", "zona_b": "norte", "minutos": 25 }],
  "funciones": [{
    "obra": "Cariño malo",
    "compania": "Ministerio de la Belleza (Perú)",
    "descripcion": "Silvio, un hombre de 40 años…",
    "franjas": [],
    "tipos": ["Teatro de texto"],
    "publico": "+18 años",
    "nota": "Boletería por confirmar (tarifas Comfama)",
    "fuente_horario": "sitio-web",
    "fecha": "2026-11-01", "hora": "19:30", "sala": "teatro-matacandelas",
    "duracion": { "min": 75, "confirmada": true },
    "precio": { "pleno": null, "dcto": null, "libre": false },
    "url_compra": "https://latiquetera.com/…",
    "imagen": { "key": "fotos/festival-teatro-san-ignacio-2026/carino-malo.webp",
                "credito": "comfama.com" }
  }]
}
```

Reglas de los campos:

- `hora` se escribe como en el volante, `"HH:MM"` en 24 horas. `hora_min` se
  calcula al cargar.
- `precio.pleno = null` significa que el organizador no publicó tarifa.
  `precio.libre = true` significa entrada libre. Un `pleno: 0` sin `libre: true`
  es un error de validación: es exactamente la confusión que ya produjo
  «Entrada libre» sobre funciones de Comfama que se pagan.
- `duracion.confirmada = false` cuando el número es estimado (80 teatro, 90
  concierto, 180 molienda, como hasta hoy).
- `franjas` (lista: en la Fiesta del Libro un evento puede estar en dos),
  `descripcion` y `publico` son campos propios. `nota` es el resto del texto de
  boletería. La migración `012_campos_ficha.sql` agrega las columnas
  `descripcion text`, `franjas text[]`, `publico text`.
- **Columnas heredadas.** Hoy la descripción vive dentro de `compania` y la
  franja y el público dentro de `nota_boleteria`. Para no tocar la app en este
  subproyecto, el cargador sigue escribiendo esas dos columnas, recompuestas con
  una sola regla para los tres festivales (`lib/legado.mjs`):
  `compania = [compania, descripcion].join(' · ')` recortado a 900, y
  `nota_boleteria = [...franjas, publico, nota].join(' · ')`, omitiendo vacíos.
  Las pantallas pasan a leer las columnas nuevas en el subproyecto 2; ahí se
  deja de recomponer.

### Fuente cruda

Un festival puede tener varias fuentes (San Ignacio: la programación artística
y la académica son dos páginas), por eso `fuentes` es una lista; el validador
exige al menos una. Cada fuente se archiva una sola vez por bajada, en el bucket `baul-eventos`, como
markdown: `fuentes/{festival}/{AAAA-MM-DD}_{hash8}.md`. No se guardan los
originales. El encabezado del markdown dice cómo se obtuvo:

| `metodo` | Cuándo |
|---|---|
| `markitdown` | PDF de una columna, CSV, Excel |
| `defuddle` | Página web |
| `imagen` | PDF de varias columnas o volante en imagen: el markdown es la transcripción hecha leyendo las páginas como imagen |

La 22.ª Fiesta es `imagen`: `markitdown` intercala las tres columnas del volante
y contamina una de cada cinco filas. Su markdown de referencia es la
transcripción verificada que hoy vive en `scripts/datos-22-fiesta.mjs`.

`npm run baul:backup` ya respalda el bucket entero; no hace falta nada más.

### Validador

`lib/formato.mjs` exporta `validar(json)` y devuelve la lista de errores; vacía
significa válido. Un solo error rechaza el archivo entero. Rechaza:

- campos obligatorios ausentes o con tipo equivocado;
- fechas de función fuera de `fecha_inicio`–`fecha_fin`;
- funciones que apuntan a una sala no declarada;
- zonas sin traslado declarado contra alguna otra zona usada en el festival;
- dos títulos que solo difieren en mayúsculas o tildes (el caso «Ixaquene»);
- `pleno: 0` sin `libre: true`;
- dos funciones con la misma llave estable.

Tests en `lib/formato.test.mjs`, uno por regla.

### Carga

`npm run cargar <slug>` lee `festivales/{slug}.json`, valida, y hace upsert.

- **Llave estable** de función: `fecha + hora_min + sala + norm(obra)`, donde
  `norm` es la normalización de títulos que ya existe. Los ids no cambian al
  recargar, así que boletas, bitácora y eventos de Calendar siguen apuntando
  bien.
- Una función que desaparece de la fuente y no tiene nada del usuario se borra.
  Si tiene algo —agendada, interés, boleta o juicio— no se borra: queda un
  aviso `tipo='retirada_de_fuente'`.
- `--seco` imprime el diff (agregadas, cambiadas campo por campo, retiradas) y
  no escribe.

### Prueba de equivalencia

La referencia es la base actual: ahí están los cargadores, la siembra, la fe de
erratas, los tipos y las fotos ya aplicados.

1. `npm run exportar <slug>` escribe el JSON desde la base. Separa
   `compania` y `nota_boleteria` en los campos nuevos y **aborta si recomponer
   lo separado no devuelve exactamente lo que había**, fila por fila. Esa es la
   prueba que no es circular: demuestra que la separación no pierde nada en las
   896 filas.
2. `npm run cargar <slug> --seco` contra la base: las columnas existentes no
   cambian; solo aparecen llenas las tres columnas nuevas.
3. `npm run cargar <slug>` y de nuevo `--seco`: diff vacío.

Pasar los tres pasos en los tres festivales es la condición para borrar los
cargadores viejos.

### Qué se borra

Después de la prueba de equivalencia:

- `scripts/cargar-programacion.mjs`, `cargar-fiesta-libro.mjs`,
  `cargar-san-ignacio.mjs`, `cargar-academico-san-ignacio.mjs`,
  `datos-22-fiesta.mjs`, `datos-san-ignacio.mjs`, `tipos-san-ignacio.mjs`;
- los scripts npm `programacion`, `fiesta-libro`, `san-ignacio`.

`scripts/seed.mjs` se queda sin cambios, marcado como histórico: su parte de
boletas depende de su parte de programación, y sus datos ya están en la base.
Se quita del arranque del README.

`scripts/extraccion/` se queda como receta de cómo se sacó San Ignacio, con su
`LEEME.md` apuntando a que ahora el destino es el JSON.

## 2. Recomendador con evidencia

### Tres fuentes de razón

Cada resaltado lleva una o más razones. Cada razón tiene `fuente`, `texto` y,
si aplica, `evidencia` (`{ si, total }`).

| Fuente | Ejemplo | Regla |
|---|---|---|
| `dicho` | «Lo pediste (28 ago): Saramago» | Las `REGLAS` actuales. Nunca se quitan por evidencia, porque las dijo Andrés; muestran su historial («oficio: 4 de 20 en la Fiesta del Libro, 3 de 3 en San Ignacio») |
| `ojeo` | «Matacandelas: marcaste sí 5 de 5» | Aprendido del ojeo anterior por `tipos`, `compania`, sala y `franja`. Mínimo 5 casos. La franja solo aplica dentro del mismo festival recurrente |
| `claude` | «Quijote con percusión: teatro físico con hilo narrativo» | Escrita en sesión al cargar, por ficha, solo donde ninguna regla alcanza. Tabla nueva `eventos.razones (funcion_id, texto, creado)` |

Señales negativas (`ojeo` con tasa claramente bajo la base, como
«Lanzamientos de libros: 12%») ordenan al final del ojeo. No esconden nada.

`razonesDe(f, evidencia)` recibe la evidencia ya calculada; no lee la base. El
cálculo de evidencia vive aparte (`lib/evidencia.mjs`) y es puro.

### Métrica

- Fixture `lib/fixtures/ojeo.json`: obra, compañía, franja, tipos, sala,
  festival e interés de cada obra ojeada. Está en `.gitignore`: el repo
  probablemente es público y el fixture publicaría el gusto de Andrés.
  `npm run fixture` lo genera desde la base.
- `lib/recomendador.test.mjs` calcula por fuente: precisión (de lo resaltado,
  cuánto marcó sí), recall (de lo que marcó sí, cuánto se resaltó) y base. Lo
  imprime como tabla.
- Lo aprendido se evalúa en 5 particiones por obra dentro de cada festival:
  nunca se mide sobre lo mismo que se usó para aprender.
- Falla si la fuente `ojeo` no supera la base. La fuente `claude` se mide solo
  contra ojeos posteriores a la razón; mientras no haya, el reporte dice
  «sin datos» y no falla. `dicho` solo se reporta.
- Sin fixture, el test se salta con un mensaje. CI (`pages.yml` corre
  `npm test`) no tiene fixture y no debe fallar por eso.
- Sesgo conocido y no corregido: el ojeo actual mostraba primero lo resaltado,
  lo que infla algo la precisión de `dicho`. El reporte lo dice.

## 3. Umbral de duración

El motor de choques no cambia. Función pura nueva `umbral(r)` en
`lib/decisor.mjs`: para un par `r` devuelto por `rel()`, la duración máxima de
`r.first` con la que todavía se alcanza `r.second`:

```
umbral = r.second.t - r.first.t - r.need
```

Solo se reporta cuando la duración de `r.first` no está confirmada y
`umbral > 0`. Los renglones de `choques` y `justos` que devuelve `verdictFor`
llevan el umbral, y la interfaz lo dice:

- par justo o que cabe: «cabe si *KRAPP* dura ≤ 72 min (estimado: 80)»;
- par que choca por la estimación: «cabría si dura ≤ 65 min; nadie lo ha
  confirmado».

Con duración confirmada o `umbral ≤ 0` no se dice nada. Tests nuevos para los
tres casos; los 96 actuales no se tocan.

## 4. Bitácora de un toque

En inicio (`app/page.js`), arriba, aparece una tarjeta por cada función
agendada que cumpla las tres condiciones: `yaTermino()`, de los últimos 3 días y
sin juicio. Dice «Anoche viste *Mohammed*».

- Cinco estrellas de 64 px. Mitad izquierda = media estrella, mitad derecha =
  entera. Cada mitad con `aria-label` («2,5 estrellas»); el número se ve al
  lado.
- Un toque guarda. Después aparece el campo de texto, grande y opcional, para
  dictar con el teclado del celular.
- «No fui» guarda un juicio con `asistio = false`.

Migración `013_bitacora_toque.sql`:

- `texto` deja de ser `not null`. Esto deshace la decisión de agosto («el texto
  pesa más que la estrella»). Lo que queda de ella: el texto se pide de
  inmediato, y la nota de Obsidian marca los juicios sin texto como
  «solo estrellas».
- `estrellas` pasa a `numeric(2,1)` con
  `check (estrellas between 0.5 and 5 and estrellas * 2 = floor(estrellas * 2))`.
- `asistio boolean not null default true`.

`lib/obsidian.mjs` escribe `★★½` y no escribe estrellas cuando `asistio` es
falso. Con test.

## 5. Google Calendar

### En la app

Botón «A Calendar» en cada función agendada. Abre el enlace de plantilla
`https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&location=…&details=…`
con título, inicio, fin según la duración, la dirección de la sala como lugar, y
en la descripción: sala, estado de boleta, «duración estimada» si aplica, y la
marca `[oe:<funcion_id>]`. Cae en el calendario principal con los recordatorios
por defecto; el usuario toca «Guardar».

`lib/calendario.mjs` arma la URL y es pura; con test.

### En sesión

Lo guía la skill, con el MCP de Google Calendar:

1. Si no existe el calendario «Festivales», se le pide a Andrés crearlo: el MCP
   no crea calendarios.
2. Se listan «Festivales» y el principal desde un día antes del festival hasta
   un día después, y se filtran los eventos con `[oe:…]`.
3. Por cada función agendada: si `funciones.calendar_event_id` existe en
   «Festivales», se actualiza (hora, sala, boleta, recordatorio emergente de 45
   min); si no, se crea y se guarda el id. Cualquier otro evento con la misma
   marca, en cualquiera de los dos calendarios, se borra.
4. Evento con marca cuya función ya no está agendada: se borra.
5. Resumen: creados, actualizados, borrados.

**Regla dura:** un evento sin `[oe:…]` no se lee, no se mueve y no se borra.

Migración `014_calendar.sql`: `funciones.calendar_event_id text`.

## 6. Gmail

Solo en sesión, solo lectura: no se marca, archiva, borra ni responde nada.

1. **Boletas.** Remitentes `info@eticketablanca.com` e `info@latiquetera.com`,
   desde 14 días antes del festival.
   - Se aplica sola la boleta cuyo título normalizado y cuya fecha coinciden con
     exactamente una función. El adjunto va al baúl con la convención de
     siempre; el hash evita duplicados. Luego corre la extracción de siempre,
     contando boletas por archivo.
   - Se pregunta lo dudoso: título parecido, varias funciones posibles, fecha
     distinta.
   - Se ignora lo que no corresponde a ningún festival cargado.
2. **Pagos.** `no-reply@placetopay.com` y `notificacion@tucompra.co` solo
   cruzan el valor pagado. No crean filas.
3. **Cambios de horario.** Correos y boletines de salas con algo agendado.
   Siempre se pregunta. Si se aprueba, la función cambia con
   `fuente_horario = 'correo:<id del mensaje>'` y Calendar se corrige en la
   misma pasada.

## Spec, README y skill

- El spec de agosto queda con una nota arriba: histórico, reemplazado por este.
- README: quitar `/entrar?k=`, describir el acceso por cabecera tal como es, y
  actualizar la tabla de scripts.
- Skill `festival-agenda` (vive en `~/.claude/skills/`, fuera de git): copia a
  `~/.claude/skills/festival-agenda.bak-2026-11-02/` antes de tocarla. Cambios:
  el paso 2 produce el JSON en formato 1 y corre el validador; el paso 5 aplica
  las tres fuentes con evidencia; pasos nuevos de sesión para Calendar y Gmail.

## Fuera de alcance

- Service worker y modo sin señal.
- Login, multiusuario, compartir.
- Un cargador que funcione sin Claude.
- Modelo estadístico sobre palabras.
- Guardar los originales de las fuentes.

## Cómo se sabe que está bien

- La métrica del recomendador contra el ojeo de Andrés, con la fuente `ojeo`
  por encima de la base.
- Los 96 tests actuales del motor en verde, sin cambios.
- Los tres festivales recargados desde el formato nuevo con diff vacío contra la
  base.
- En el próximo festival, como prueba que nadie controla: la hora real de
  llegada contra el umbral reportado, y lo que Andrés marque en el ojeo contra
  las razones escritas al cargar.
