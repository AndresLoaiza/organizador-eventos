// Drôleries: los tipi fissi dibujados en el margen.
//
// El puente entre la comedia del arte y el manuscrito gótico no es decorativo,
// es literal. Las drôleries del margen bajomedieval son híbridos hombre-animal:
// un hombre con cabeza de pájaro tocando una flauta al pie de la página. Y las
// máscaras de la comedia son máscaras de animal — la guía de Andrés lo dice sin
// ambigüedad: Pantalón es un águila, Il Dottore un toro, Arlequín un zorro, Il
// Capitano un gallo. Es la misma gramática visual llegando por dos caminos.
//
// Sin pan de oro. El oro y el vino eran el primer reflejo de "app de teatro" y
// están descartados desde la primera versión; son también el primer reflejo de
// "manuscrito medieval". Lo que queda es lo que de verdad tenía un documento de
// trabajo: tinta y rúbrica. La rúbrica es tinta roja, y el acento de la app ya
// era bermellón, así que no hubo que inventar un color.
//
// Van en el margen y no en el contenido. Eso no es un detalle de maquetación:
// es el principio del producto — un riesgo estético en un solo lugar, el resto
// quieto — hecho estructura. El adorno vive donde no estorba la tarea.

const FIGURAS = {
  // Arlequín, el zorro acróbata con el batocchio: la noche que se improvisa
  // sobre el canovaccio.
  arlecchino: 'Arlequín, zorro acróbata con su batocchio',
  // Pantalón, el águila avara abrazada a su bolsa: el baúl de las boletas.
  pantalone: 'Pantalón, viejo avaro abrazado a su bolsa',
  // Il Capitano, el gallo que fanfarronea y nunca desenvaina: decidir.
  capitano: 'Il Capitano, gallo fanfarrón que no desenvaina',
  // Il Dottore, el toro con el libro pegado a la cara: quien escribe el juicio.
  dottore: 'Il Dottore, toro erudito leyendo demasiado cerca',
};

/**
 * La figura es puro adorno, así que se esconde de los lectores de pantalla: un
 * lector que anuncie "zorro acróbata" en mitad de una lista de funciones no
 * está describiendo nada útil, está interrumpiendo.
 *
 * Se pinta con `mask-image` y no como `<img>` para que una sola imagen sirva en
 * los dos temas: el PNG solo aporta la silueta y el color lo pone el CSS.
 */
export default function Margen({ tipo = 'arlecchino', tam = 'medio', className = '' }) {
  if (!FIGURAS[tipo]) return null;
  return (
    <span
      aria-hidden="true"
      className={`drolerie ${className}`.trim()}
      data-fig={tipo}
      data-tam={tam}
    />
  );
}

export { FIGURAS };
