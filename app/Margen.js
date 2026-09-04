// Ornamento de manuscrito: personajes y máscaras.
//
// Los personajes son los tipi fissi de verdad, con su media máscara de cuero
// puesta. La versión anterior los dibujaba como híbridos con cabeza de animal,
// y eso era pasarse: la guía de Andrés dice que la máscara *evoca* un animal
// —recurso para el trabajo corporal del actor, "¿cómo caminaría Pantaleón?"—
// no que el personaje sea una bestia.
//
// Las máscaras van aparte y solas porque hacen otro trabajo. Un personaje
// entero necesita sitio y solo cabe al pie o en un vacío; una máscara de frente
// funciona pequeña y repetida, y por eso puede abrir cada pantalla. Sin eso el
// adorno vivía únicamente al final de la página, donde casi nunca se llega.

const PERSONAJES = {
  arlecchino: 'Arlequín saltando, con su traje de rombos',
  pantalone: 'Pantalón encorvado, agarrado a su bolsa',
  dottore: 'Il Dottore con la toga y el libro abierto',
  capitano: 'Il Capitano con penacho y espada sin desenvainar',
  colombina: 'Colombina con delantal y pandereta',
  pulcinella: 'Pulcinella con su gorro cónico',
};

const MASCARAS = {
  cuoio: 'máscara de cuero de la comedia del arte',
  antifaz: 'antifaz veneciano de media cara',
  bauta: 'bauta veneciana',
  volto: 'volto veneciano',
  moretta: 'moretta veneciana',
  peste: 'máscara del médico de la peste',
};

/**
 * Adorno puro, así que se esconde de los lectores de pantalla. Anunciar
 * "Pantalón agarrado a su bolsa" en mitad de una lista de funciones no
 * describe nada útil: interrumpe.
 *
 * Se pinta con `mask-image` y no como `<img>` para que una sola imagen sirva
 * en los dos temas: el PNG aporta la silueta y el color lo pone el CSS.
 */
export default function Margen({ tipo, tam = 'medio', className = '' }) {
  const esMascara = tipo in MASCARAS;
  if (!esMascara && !(tipo in PERSONAJES)) return null;
  return (
    <span
      aria-hidden="true"
      className={`drolerie ${className}`.trim()}
      data-fig={esMascara ? `mask-${tipo}` : tipo}
      data-tam={tam}
    />
  );
}

/**
 * Apertura de capítulo. En el códice cada sección abre con una inicial
 * historiada que rompe la caja de texto; aquí abre con la máscara de la
 * pantalla, arriba del todo, para que el ornamento se vea sin bajar.
 *
 * La máscara no es decoración intercambiable: cada pantalla lleva la suya y
 * significa algo. El antifaz de media cara para Ojear, donde solo te estás
 * asomando. La bauta para Decidir, que era la que se ponía el veneciano para
 * moverse sin dar la cara. El volto entero para la Agenda, donde ya no hay
 * ambigüedad. La moretta muda para el Baúl, que no habla, guarda.
 */
export function Cabecera({ mascara, titulo, children, nivel = 'h1' }) {
  const H = nivel;
  return (
    <header className="capitular">
      <Margen tipo={mascara} tam="capitular" />
      <div>
        <H>{titulo}</H>
        {children && <p className="entradilla">{children}</p>}
      </div>
    </header>
  );
}

/**
 * Friso: hilera de máscaras como separador. El equivalente del remate que
 * cerraba una sección en el manuscrito, y la razón de que haya adorno también
 * a media página y no solo en los extremos.
 */
const FRISO = ['cuoio', 'antifaz', 'bauta', 'peste', 'volto', 'moretta'];

export function Friso({ desde = 0 }) {
  return (
    <div className="friso" aria-hidden="true">
      {FRISO.map((m, i) => (
        <Margen key={m} tipo={FRISO[(i + desde) % FRISO.length]} tam="friso" />
      ))}
    </div>
  );
}

export { PERSONAJES, MASCARAS };
