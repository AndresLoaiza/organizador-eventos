// Técnica escénica de cada obra del Festival San Ignacio 2026.
//
// Sale de la investigación del 20 oct 2026 (fichas de latiquetera, páginas de
// las compañías, prensa y programas de los festivales donde han estado), no de
// adivinar por el título. Una obra donde no se encontró nada que lo sostenga
// queda en null: "sin clasificar" es un dato; un tipo inventado no lo es.
//
// Etiquetas posibles: Clown · Teatro físico y circo · Títeres y objetos ·
// Danza-teatro · Teatro musical · Concierto · Teatro de texto · Teatro inmersivo.
export const TIPOS = {
  'Todos somos Poe': ['Clown'],
  'La Celestina, tragicomedia de Lita': ['Clown'],
  'Todavía tenemos un tiempo': ['Teatro físico y circo'],
  'Mohammed (o el coyote)': ['Títeres y objetos', 'Danza-teatro'],
  'L@s niñ@s del Winnipeg': ['Títeres y objetos'],
  'Gaspar, el señor de las nubes': ['Títeres y objetos'],
  'Caminito del mar': ['Títeres y objetos'],
  'Murmuria': ['Danza-teatro', 'Teatro musical'],
  'La casa grande': ['Teatro musical'],
  'Cariño malo': ['Teatro musical'],
  'Concierto: Nobuntu': ['Concierto'],
  '(Un) Ensayo sobre la ceguera': ['Teatro de texto', 'Teatro inmersivo'],
  'Ni flores, ni funeral, ni cenizas, ni tantán': ['Teatro de texto'],
  'Los Tumbaos': ['Teatro de texto'],
  'Ser humana': ['Teatro de texto'],
  'Continental': ['Teatro de texto'],
  'Hotel de vagabundos': ['Teatro de texto'],
  'Panza de burro': ['Teatro de texto'],
  // Sin información que sostenga un tipo:
  'El mago de Oz': null,
  'La tercera mitad': null,
  'Tom Tom. The piper´s son': null,
  'La defensa de Absalón': null,
  'El pabellón del oído': null,
  'Entre líneas': null,
  'García Multicolor': null,
  'Pato, muerte y tulipán': null,
  'Loba': null,
};
