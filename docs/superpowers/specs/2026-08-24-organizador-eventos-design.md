# Organizador de Eventos — diseño

Fecha: 24 de agosto de 2026
Estado: aprobado para construir la Fase 1

## El problema

Andrés va a festivales de artes escénicas en Medellín. Hoy tiene tres problemas encadenados y solo el primero está resuelto:

1. **Decidir a qué ir** cuando hay 150 funciones en 23 salas y muchas se cruzan. Resuelto a mano con la skill `festival-agenda`.
2. **Saber qué compró.** Las boletas viven repartidas entre PDFs sin nombre en `D:\Download`, correos de eTicketaBlanca, capturas de WhatsApp y papeles de taquilla. No hay forma de responder "¿tengo boleta para el sábado?" sin abrir cinco cosas.
3. **Recordar qué le pareció.** Sin bitácora, la recomendación del siguiente festival arranca tan ciega como la de este.

El caso que motivó la app, verificado el 24 de agosto de 2026 sobre datos reales: de siete funciones agendadas para la 22.ª Fiesta de las Artes Escénicas, dos no tenían boleta, dos tenían una segunda boleta que nunca se descargó a disco, una tenía dos boletas a precios muy distintos, y el horario impreso de una función estaba mal — corregido por el teatro en un correo que nadie cruzó con el volante.

Ninguno de esos cuatro hallazgos requiere inteligencia. Requiere tener los datos en el mismo lugar.

## Alcance

**Fase 1 (esta semana, durante la 22.ª Fiesta):** Módulos 2 y 3 — Boletas y Bitácora — más el Canovaccio de la noche. Sembrada con la programación y las boletas reales de la Fiesta.

**Fase 2:** Módulo 1 — cargador de programaciones multi-festival, tabla de filtro exportable y decisor interactivo.

El orden está invertido a propósito. El Módulo 1 para esta Fiesta ya se hizo a mano y no se puede volver a hacer; lo que se vence esta semana son las compras y los juicios de cada función mientras están frescos.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Stack | Next.js 15 App Router en Vercel, repo git privado | Ya usado dos veces (`app-colegio-horarios`, `web-altacomedia`). Funciona en la calle sin depender del PC |
| Datos | Supabase Postgres, proyecto `nuestros-viajes` reutilizado, schema propio `eventos`, acceso por Postgres directo al pooler | Decisión del usuario. El schema aislado evita chocar con `polla-app` y `viajes-app`. Ir por Postgres y no por PostgREST quita la dependencia de la `service_role`, compartida con las otras dos apps |
| Archivos | Supabase Storage, bucket privado `baul-eventos`, sin espejo automático | Decisión del usuario. Se agrega `npm run baul:backup` como red de seguridad manual |
| Extracción | En sesión de Claude Code, no por API | Decisión del usuario: no hay `ANTHROPIC_API_KEY` y no se quiere una |
| Acceso | Sin login. Link secreto de un uso que canjea por cookie `httpOnly` | El usuario pidió no autenticarse caminando. La variante endurecida da esa UX sin exponer la base |
| Obsidian | Agente local Node que escribe el vault | El vault no es repo git; solo un proceso con acceso a `D:\` puede escribirlo |

### Por qué la cookie y no la URL secreta a secas

Una app Next.js que habla con Supabase desde el navegador tiene que embarcar la `anon key` en el bundle de JavaScript. Cualquiera que llegue al dominio la extrae y consulta la base directamente, sin pasar por la URL secreta. La URL larga esconde la pantalla, no la API.

Como en la base hay códigos de boleta escaneables en la puerta de la sala, el esquema plano no es aceptable. La solución conserva el gesto que el usuario pidió: se abre el link secreto una vez desde el celular, el servidor lo canja por una cookie `httpOnly` de larga duración, y a partir de ahí no hay nada que recordar. Ninguna llave de Supabase llega jamás al navegador; todo pasa por route handlers que validan la cookie contra la `service_role` guardada en Vercel.

## Arquitectura

```
Next.js 15 (App Router) ─ Vercel
    │
    ├─ middleware        valida la cookie de sesión en cada request
    ├─ route handlers    únicos que tocan la base (Postgres directo, server-only)
    │      ├─ /api/boletas      alta, edición, vínculo con función
    │      ├─ /api/funciones    estados de compra
    │      ├─ /api/bitacora     juicios
    │      └─ /api/upload       original → Storage, nunca sobrescribe
    │
    └─ lib/
           ├─ decisor.js   motor de choques portado de la skill
           ├─ alarmas.js   las cinco incoherencias
           └─ nombres.js   slugs y convención de claves de Storage

scripts/     seed, boletas:pendientes, boletas:aplicar, baul:backup
agente/      obsidian-sync.mjs — Supabase → gustos-artes-escenicas.md
```

### El motor de choques se porta, no se reescribe

`lib/decisor.js` recibe las funciones puras de `assets/decisor.html` sin cambios de lógica: `travel`, `rel`, `statusOf`, `rescueDays`, `wouldKill`, `verdictFor`. Son unas 150 líneas con casos borde ya resueltos — traslado entre salas, márgenes justos, rescate en otra fecha, obra bloqueada por una elección previa. Lo único que cambia es de dónde vienen los datos.

Se acompañan de tests que congelan los cuatro veredictos y, sobre todo, los casos borde. Si alguien "mejora" el motor y rompe la distinción entre perdida y recuperable, los tests lo dicen.

## Modelo de datos

Schema `eventos` dentro del proyecto `nuestros-viajes`. RLS activo en todas las tablas aunque el único acceso sea por servidor: defensa en profundidad, no confianza en que el service_role nunca se filtre.

| Tabla | Campos que importan |
|---|---|
| `festivales` | slug, nombre, ciudad, fecha_inicio, fecha_fin |
| `salas` | slug, nombre, direccion, telefono, zona |
| `traslados` | ciudad, zona_a, zona_b, minutos |
| `funciones` | festival, dia, hora_min, duracion_min, `duracion_confirmada`, obra, compania, sala, precio_pleno, precio_dcto, nota_boleteria, `acompanantes` |
| `archivos` | festival, storage_key, `hash_contenido`, mime, origen, `extraccion_estado`, extraccion_json |
| `boletas` | funcion, `archivo_id`, `pagina`, titular, categoria, valor_ticket, valor_servicio, localidad, codigo, pulep, operador |
| `estados_compra` | funcion, estado, fecha_limite |
| `bitacora` | funcion, texto, estrellas, fecha |
| `avisos` | funcion, tipo, severidad, mensaje, resuelto |

Tres campos merecen explicación:

**`duracion_confirmada`** — Los volantes nunca dicen cuánto dura una obra, así que el motor trabaja con estimaciones (80 min teatro, 90 concierto, 180 molienda). Cuando dos funciones quedan a menos de 20 minutos de margen, el veredicto depende enteramente de ese número inventado. La app marca visualmente todo veredicto que dependa de una duración estimada, en vez de presentarlo como hecho. Confirmar una duración llamando a la sala cambia el campo y el aviso desaparece.

**`archivo_id` y `pagina`** — Un archivo puede traer varias boletas: cuando se compran dos entradas de la misma función, el operador manda un solo PDF con las dos, una por página. El modelo original ataba una boleta a un archivo y producía la alarma falsa "necesitas 2 boletas y solo hay 1" en funciones que estaban completas desde el principio. Una alarma falsa es peor que no tener alarma, porque enseña a ignorarlas.

**`hash_contenido`** — SHA-256 del archivo original. Si se sube dos veces la misma foto, la app lo detecta y no crea duplicado ni sobrescribe. El original queda intacto por construcción, no por disciplina.

**`acompanantes`** — Andrés va casi siempre solo, pero no siempre. Sin este campo, "una boleta para esta función" parece completo cuando en realidad falta la del acompañante. Es el error que la app encontró en su primer día.

### Convención de nombres en Storage

```
baul/{festival-slug}/{AAAA-MM-DD}_{HHMM}_{obra-slug}_{sala-slug}_{hash8}.{ext}
```

- **Fecha primero**: el orden alfabético es el cronológico, sin índice ni consulta.
- **Hora incluida**: hay dobles funciones el mismo día; sin la hora, dos boletas legítimas colisionan en la misma clave.
- **Obra y sala en el nombre**: el baúl se puede leer desde el explorador de archivos sin la app. Si un día la app no existe, la carpeta sigue siendo útil.
- **Hash del contenido al final**: hace la clave única por archivo, no por función. Subir la misma foto dos veces no genera un duplicado; subir dos boletas distintas de la misma función genera dos entradas, que es lo correcto cuando va acompañado.

El original entra en modo solo lectura. Toda corrección vive en la base; el archivo no se toca nunca.

## Módulo 2 — Boletas

### Flujo de carga

Desde el celular en la taquilla: foto → sube a Storage → queda `pendiente de extracción` → dos campos rápidos (obra, valor) para que el estado nunca esté desactualizado en la calle. Diez segundos, de pie.

La extracción completa ocurre después, en una sesión de Claude Code:

```
npm run boletas:pendientes   # baja los originales pendientes a un directorio de trabajo
                             # (aquí Claude los lee y produce un JSON por boleta)
npm run boletas:aplicar      # escribe los campos extraídos a Supabase
```

Es un flujo partido y hay que decirlo sin adornos: la app no lee la boleta sola. A cambio, no hay llaves de modelo que administrar y la extracción la hace algo que entiende que "COMFAMA TARIFA A" es una categoría y no el nombre de la obra.

### Las cinco alarmas

Se evalúan en cada carga y en cada apertura de la agenda:

1. **Hora discordante** — la boleta dice una hora y la programación otra. Muestra ambas y pregunta cuál manda. Caso real: Teatro y Cocina, 9:30 p.m. en el volante contra 10:00 p.m. en la fe de erratas del teatro.
2. **Cruce de franja** — dos boletas de funciones que chocan según el motor. Distinto de tener dos boletas de la *misma* función, que es lo normal cuando va acompañado.
3. **Boletas insuficientes** — la función tiene acompañante y solo hay una boleta. Caso real: Habitar tenía dos compradas pero solo una descargada; Teatro y Cocina necesita dos y no tiene ninguna.
4. **Agendada y vencida** — pasó la fecha y nunca hubo boleta.
5. **Boleta huérfana** — la boleta no corresponde a ninguna función cargada. La app pregunta a qué festival pertenece y ofrece crear la función.

## Módulo 3 — Bitácora

Después de cada función: texto libre primero, estrellas después. El texto pesa más, y el orden de la interfaz lo dice.

La razón está en el método de la skill: *"me aburrió la primera media hora pero el final valió"* informa la próxima recomendación mucho mejor que un 3 sobre 5. Las estrellas sirven para ordenar y filtrar; el texto sirve para decidir.

El agente local escribe ambos a `vida_personal/gustos-artes-escenicas.md`, en la tabla de bitácora del festival correspondiente, respetando la regla anti-fabricación del vault: solo las palabras de Andrés, nada inferido, nada completado con un valor plausible.

## Identidad visual

La fuente es la guía de Comedia del Arte del propio usuario, no el imaginario genérico de arlequín.

**Cuatro ideas tomadas de la guía:**

- **El canovaccio.** Estructura fija, diálogo improvisado. Es literalmente la app: la programación es el esqueleto, la noche se improvisa.
- **"Cuando el rostro se oculta, el cuerpo habla."** La máscara le quita al actor la expresión facial y lo obliga a amplificar el cuerpo. En la interfaz: menos decoración, más estructura tipográfica.
- **Tipi fissi.** El público reconoce el rol al instante. Los cuatro veredictos son cuatro tipos fijos con marca invariable, legibles de un vistazo caminando a las siete de la noche.
- **El baúl del cómico ambulante.** El archivo de boletas. No se bota nada.

**Sistema quieto:** papel cálido, tinta oscura, serif con peso para horas y títulos, semántica de color separada del acento — rojo pérdida, verde recuperable, ámbar margen justo. Claro y oscuro. Objetivos táctiles grandes.

**El riesgo estético, en un solo lugar: la pantalla "Canovaccio de esta noche".** El canovaccio se clavaba entre bastidores para mirarlo de reojo antes de entrar. Esa pantalla es una hoja física: numerales de escena grandes, divisiones regladas, y el estado de cada función como sello estampado o tachado, no como badge. Es la única pantalla con textura y peso. El resto de la app no se entera.

## Manejo de errores

- **Storage caído en la taquilla:** la foto se guarda en IndexedDB y se sube sola cuando vuelve la red. Perder una boleta por estar sin señal en el lobby es el peor fallo posible.
- **Extracción dudosa:** todo campo con baja confianza se guarda marcado, nunca se presenta como confirmado. Un valor pagado equivocado contamina el total del festival en silencio.
- **Función sin duración confirmada:** el veredicto sale marcado como dependiente de estimación, con el número usado a la vista.
- **Conflicto de datos volante contra boleta:** no se resuelve solo. Se muestran los dos y decide el usuario.

## Pruebas

- `lib/decisor.js` — los cuatro veredictos y los casos borde: mismo lugar, zonas opuestas, doble función, rescate en otra fecha, obra bloqueada por elección previa.
- `lib/alarmas.js` — las cinco alarmas, cada una con su caso real de la 22.ª Fiesta como fixture.
- `lib/nombres.js` — la convención de claves: tildes, dobles funciones el mismo día, mismo archivo subido dos veces.

Los fixtures son datos reales de la Fiesta, no inventados. Un test que usa "Obra 1" y "Sala A" no detecta que "KRAPP" y "KRAAP" son la misma obra mal escrita.

## Riesgos conocidos

- **Proyecto Supabase compartido.** `nuestros-viajes` ya sirve a `polla-app` y `viajes-app`. El schema y el bucket propios aíslan los datos, pero la `service_role` es la misma para los tres. Si se filtra en cualquiera, se filtra en todos.
- **Sin espejo local del baúl.** Decisión explícita del usuario. `npm run baul:backup` existe pero hay que acordarse de correrlo.
- **Extracción manual.** Depende de que haya una sesión de Claude Code disponible. La captura rápida evita que eso bloquee saber el estado de compra.
