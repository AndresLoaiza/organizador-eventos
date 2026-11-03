# Extracción del Festival San Ignacio

De dónde salió la programación de San Ignacio (hoy en
`festivales/festival-teatro-san-ignacio-2026.json`). Se guarda porque la
programación vino de una página web: si el sitio cambia, hay que poder rehacer
la extracción y ver en qué difiere, no volver a empezar de memoria.

```bash
defuddle parse https://www.comfama.com/festivales/festival-teatro-san-ignacio/   --md -o trabajo/sanignacio/pagina.md
python scripts/extraccion/parsear.py          # -> trabajo/sanignacio/funciones.json
python scripts/extraccion/bajar-imagenes.py   # -> trabajo/sanignacio/imagenes/
# funciones.json se pasa a festivales/festival-teatro-san-ignacio-2026.json (formato 1)
npm run fuente -- festival-teatro-san-ignacio-2026 trabajo/sanignacio/pagina.md defuddle <url> <fecha>
npm run cargar -- festival-teatro-san-ignacio-2026 --seco
```

`generar-datos.py` escribía `scripts/datos-san-ignacio.mjs`, que ya no existe:
la salida ahora es el JSON del formato 1.

## Lo que costó descubrir

- **El título va pegado al día sin separador**: `La tercera mitadSáb. / 31 oct.`
  El corte va por el patrón del día, no por espacios.
- **La página escribe el miércoles como `Mier.`** y el resto de días con tilde.
  Un patrón con `Mié` perdía los cinco eventos del 4 de noviembre en silencio,
  que es la peor manera de perderlos.
- **`3:00 p. m. y 5:00 p. m.` es doble función** y entra como dos filas.
  Colapsarla borra la posibilidad de encadenar dos cosas esa tarde.
- **Una obra escribe su sala de dos maneras**: «Patio Teatro Claustro Comfama»
  y «Patio Teatro **del** Claustro Comfama». Sin unificar, el motor calcula un
  traslado entre una sala y ella misma.
- **`Todavía tenemos un tiempo` no trae descripción ni enlace.** Exigir la
  barra separadora hacía que el buscador siguiera bajando y se trajera la línea
  de la sala como si fuera el público.
- **Las fotos no dan más de 381×261.** El proxy de Gatsby va firmado y pedirle
  otro ancho no sirve; se piden al original de Contentful, que mide eso mismo.
  Es todo lo que Comfama publica.
- **Python rechaza el certificado de Comfama en esta máquina y curl no.** Se
  bajan con curl en vez de desactivar la verificación.
