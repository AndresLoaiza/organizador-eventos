# DESIGN

## Qué falló en la primera versión

Se leía sin terminar, no sobria. Tres causas concretas, todas de jerarquía y ninguna de decoración:

- **Una sola familia del sistema en todos los pesos medios.** Sin webfont y sin contraste de peso, la pantalla parece HTML sin estilar.
- **Escala 1.2.** El título era apenas más grande que el cuerpo. Nada mandaba.
- **Todo dentro de cajas con borde y radio.** Funciones, avisos y tablas eran el mismo rectángulo repetido: la rejilla de tarjetas idénticas.
- **Acento por debajo del 10%.** El resultado era gris sobre hueso.

La corrección no fue adornar. Fue subir el contraste de peso, abrir la escala, sacar las cajas y dejar que un color mande.

## Escena que decide el tema

Las 7:15 de la noche, Calle 47, luz de poste, el teléfono a un brazo, decidiendo si hay que apurar el paso.

Esa frase obliga a **oscuro por defecto**: menos deslumbre y la hora legible de reojo. La versión clara existe de verdad, no como versión de segunda, porque la otra escena real es cargar boletas a la una de la tarde frente a un monitor.

## Color: Committed en un solo gesto

Bermellón. Es la tinta del sello, no el terciopelo del telón; el rojo vino y el dorado eran el primer reflejo de "app de teatro" y están descartados.

```
--fondo    oklch(0.155 0.012 40)     tierra tibia, nunca negro puro
--tinta    oklch(0.955 0.008 82)
--tinta-2  oklch(0.735 0.014 72)
--tinta-3  oklch(0.615 0.014 66)
--acento   oklch(0.680 0.190 32)     bermellón
--gana     oklch(0.800 0.130 168)
--justo    oklch(0.840 0.135 82)
```

**La pérdida no lleva color.** Se tacha y se apaga. Un rojo de alarma competiría con el acento y volvería la pantalla un semáforo, y además es más fiel a lo que significa: una función perdida es ausencia, no peligro.

Contraste verificado con el cálculo, no a ojo. Los ocho pares críticos pasan 4.5:1 en los dos temas; la primera pasada del tema claro fallaba cuatro.

## Tipografía: una familia, rango completo

**Archivo**, autoalojada por `next/font` (tres woff2 en el bundle, sin petición a Google y sin salto de layout).

Una sola familia porque en producto dos son ruido. La jerarquía sale del **contraste de peso 800 contra 400** y de una escala de cuarta justa, 1.333, donde los saltos se notan:

```
0.75 · 0.875 · 1 · 1.333 · 1.777 · 2.369 · 3.157 rem
```

La hora de la noche escapa de la escala: `clamp(3rem, 15vw, 3.157rem)`, peso 800, tracking −0.055em. Es el único elemento con tratamiento de héroe.

## Composición: renglones, no tarjetas

Las funciones son filas con filete, sin borde ni radio ni fondo. Un horario es una lista, y una lista de rectángulos idénticos no es más clara: es más ruidosa.

Los avisos también perdieron la caja. Una alerta que parece tarjeta se confunde con el contenido.

Ritmo variable: 3.5rem entre secciones, 0.75rem dentro de una fila.

## El único momento con drama

La pantalla **Esta noche**. Hora enorme en bermellón, obra grande, numeral de escena al margen en color de regla, y el estado como sello girado 2.5 grados. Es el único elemento rotado de toda la app.

Todo lo demás se queda quieto. Agenda, baúl, formularios y bitácora son herramienta y desaparecen en la tarea.

## Prohibiciones que se respetan

- Sin `border-left` de color como acento. El tipo se reconoce por la marca, no por un adorno al margen.
- Sin desenfoque de fondo. La barra fija es opaca: el vidrio decorativo es reflejo, no decisión.
- Sin degradado en texto, sin rejilla de tarjetas iguales, sin plantilla de métrica gigante.
- Emoji nunca como icono. Las marcas de los tipos fijos son glifos tipográficos dentro de un círculo, y van acompañadas siempre de su rótulo.

## Movimiento

150 a 240 ms, `cubic-bezier(0.16, 1, 0.3, 1)`. Solo cambio de estado. La única excepción con propósito es el sello, que cae una vez al marcarse comprada. Respeta `prefers-reduced-motion`.
