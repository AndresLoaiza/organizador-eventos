# DESIGN

## Estrategia de color: Restrained

Neutros templados hacia el papel, un acento que no decora nada. El acento aparece solo en acción primaria, selección actual e indicador de estado. La semántica de veredicto es un vocabulario aparte y no comparte color con el acento.

### Por qué no es rojo vino ni dorado

El reflejo de primer orden para una app de teatro es terciopelo y oro. El de segundo orden, una vez descartado ese, es cuero envejecido con rombos. Los dos siguen siendo decorado.

La fuente real es una hoja de trabajo de bastidores: papel tibio, tinta, y un sello. Por eso el acento es tinta de pluma, un azul violáceo desaturado que en ningún momento se lee como marca corporativa ni como cartel de temporada. El único gesto saturado del producto es el sello del Canovaccio, y un sello real se estampa con tinta, no con color de acento.

### Tokens

```
--papel        oklch(0.972 0.008 78)    fondo
--papel-2      oklch(0.945 0.010 76)    paneles, barras
--tarjeta      oklch(0.995 0.004 80)
--tinta        oklch(0.235 0.014 68)    texto principal
--tinta-2      oklch(0.470 0.014 68)    texto secundario
--tinta-3      oklch(0.620 0.012 68)    texto terciario
--regla        oklch(0.885 0.010 74)    bordes, renglones

--acento       oklch(0.415 0.075 285)   tinta de pluma
--acento-suave oklch(0.945 0.020 285)

--perdida      oklch(0.505 0.145 32)
--recuperable  oklch(0.480 0.085 158)
--justo        oklch(0.560 0.100 76)
--perdida-suave / --recuperable-suave / --justo-suave: mismos matices, L≈0.955, C≈0.03
```

Oscuro: `--papel` baja a `oklch(0.185 0.010 68)`, los textos suben, y el croma del acento sube a 0.095 con L 0.72 para no apagarse. Nunca `#000` ni `#fff`.

## Tema

No hay tema por defecto: sigue al sistema, con interruptor manual que gana en ambas direcciones.

La escena que lo decide: a las 7:15 de la noche, en la calle, bajo luz de poste, mirando el teléfono a un brazo de distancia. Ahí el oscuro es más cómodo y menos encandilante. Pero el mismo usuario carga boletas a la una de la tarde frente a un monitor. Las dos escenas son reales, así que las dos se soportan de verdad y ninguna es la versión de segunda.

## Tipografía

Una familia para todo el producto: pila del sistema. Escala fija en rem, razón 1.2. Cifras tabulares en horas, precios y contadores, siempre.

**Una sola excepción**, y es el riesgo declarado: los numerales de escena y las horas del Canovaccio usan pila serif (`Iowan Old Style, Palatino Linotype, Georgia, serif`). Sin webfont: cero carga, sin salto de layout. El serif no aparece en ninguna etiqueta, botón ni dato de formulario.

## Los tipos fijos

Cinco estados con marca invariable. Se reconocen por la marca, no por el color, porque a las siete de la noche en la calle el color es lo primero que se pierde.

| Estado | Marca | Uso |
|---|---|---|
| Comprada | `✓` en sello | boleta suficiente para todos los asistentes |
| Agendada | `○` | decidida, sin boleta todavía |
| Perdida | `✕` | choca y no se repite en ninguna otra fecha |
| Recuperable | `↻` | choca, pero vuelve otro día |
| Justo | `!` | alcanza con poco margen |

La marca va adelante, dentro de un contenedor con borde completo y fondo tintado.

**Prohibido el `border-left` de color.** Es el reflejo obvio para esto y está vetado: raya lateral de acento en tarjetas, listas y avisos. La plantilla original de la skill lo usaba; aquí se reemplaza por marca más borde completo, que además es más fiel a la idea de tipo fijo, porque un tipo fijo se reconoce por la máscara, no por un adorno en el margen.

## Composición

Sin contenedor universal. Las listas de funciones respiran contra el fondo. Ritmo de espaciado variado: la lista de una noche está apretada, la separación entre noches es amplia.

Tabla ancha: scroll dentro de su propio contenedor, nunca arrastra el cuerpo de la página.

Objetivo táctil mínimo 44 px en todo lo que se toque de pie.

## Movimiento

150 a 200 ms, `cubic-bezier(0.22, 1, 0.36, 1)`. Solo cambio de estado y confirmación de acción. Nada de secuencias de entrada.

Una excepción con propósito: el sello de "comprada" cae con una sola animación de 220 ms la primera vez que se marca. Es confirmación, no adorno, y respeta `prefers-reduced-motion`.

## El riesgo, delimitado

La pantalla Canovaccio de esta noche es una hoja de bastidores: renglones reales, numerales de escena grandes en serif, estado estampado o tachado. Es la única superficie con textura y peso tipográfico.

El resto de la app no se entera. Agenda, boletas, formularios y bitácora usan el sistema quieto sin una gota de esa textura.
