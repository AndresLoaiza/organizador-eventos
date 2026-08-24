# Organizador de Eventos

App para gestionar la asistencia a festivales de artes escénicas: programación, boletas y bitácora. Un solo usuario.

Diseño completo en [docs/superpowers/specs/2026-08-24-organizador-eventos-design.md](docs/superpowers/specs/2026-08-24-organizador-eventos-design.md).
Identidad visual en [PRODUCT.md](PRODUCT.md) y [DESIGN.md](DESIGN.md).

## Arranque

```bash
npm install
cp .env.example .env.local
```

Llena `.env.local` con tres valores:

- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del proyecto **nuestros-viajes**. Están en `D:\ANDRES\Claude_Projects\Consulta_Viajes\viajes-app\.env`.
- `ACCESO_SECRETO`: genéralo con `node -e "console.log(crypto.randomUUID())"`.

Después:

```bash
# 1. Pega supabase/001_schema_eventos.sql en el editor SQL del proyecto y córrelo
npm run setup    # verifica el schema y crea el bucket privado baul-eventos
npm run seed     # carga la 22.ª Fiesta y sube las boletas que están en D:\Download
npm run dev
```

Entra una sola vez con `http://localhost:3000/entrar?k=TU_ACCESO_SECRETO`. Queda una cookie `httpOnly` por 120 días.

## Cómo se entra desde el celular

No hay login. Se abre el enlace secreto una vez y ya. En Vercel, la misma URL con `?k=`.

Ninguna llave de Supabase llega al navegador: todo pasa por route handlers que usan la `service_role` guardada en el servidor. Por eso la URL secreta acá sí protege, y no solo esconde.

## Módulos

**Boletas.** Se sube la foto o el PDF, el original se guarda tal cual y no se toca nunca. Las correcciones viven en la base.

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
npm run boletas:pendientes   # baja los originales sin extraer a trabajo/
# Claude lee cada archivo y escribe trabajo/extraido.json
npm run boletas:aplicar      # guarda los campos en la base
```

Mientras tanto, la captura rápida de la app (obra y valor, diez segundos de pie) mantiene el estado de compra al día.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm test` | 28 pruebas del motor de choques y las alarmas, con datos reales de la Fiesta |
| `npm run setup` | Verifica el schema y crea el bucket |
| `npm run seed` | Carga festival, salas, traslados, funciones y boletas |
| `npm run boletas:pendientes` | Baja a `trabajo/` lo que falta extraer |
| `npm run boletas:aplicar` | Escribe lo extraído |
| `npm run baul:backup` | Copia el bucket entero a disco |
| `npm run obsidian:sync` | Lleva la bitácora al perfil de Obsidian |

## Estructura

```
app/          Next.js 15 App Router. Los route handlers son lo único que toca Supabase
lib/          decisor (motor portado), alarmas, nombres, datos, db, sesion
scripts/      setup, seed, extracción, backup
agente/       puente al vault de Obsidian, corre en el PC
supabase/     schema SQL, se pega una vez en el editor del proyecto
```

## Decisiones que conviene no deshacer sin leer primero

- **El motor de choques se portó, no se reescribió.** `lib/decisor.mjs` viene de `assets/decisor.html` de la skill `festival-agenda`, con casos borde ya resueltos. Los tests congelan los cuatro veredictos.
- **`agendada` distingue el volante de la agenda.** Sin esa columna, cualquier función de la programación aparece como decidida.
- **`duracion_confirmada` marca lo que es estimación.** Las duraciones no salen del volante. Cuando un margen depende de un número inventado, la interfaz lo dice.
- **El schema es `eventos`, no `public`.** El proyecto de Supabase es compartido con `polla-app` y `viajes-app`.
