// Programación verificada de la 22.ª Fiesta de las Artes Escénicas.
//
// Transcrita leyendo las páginas del volante como imagen, no del texto extraído.
// El PDF es de tres columnas y al pasarlo a texto plano los campos se intercalan:
// la hora de una obra queda pegada a la boletería de otra, y el volante además
// reimprime el nombre de la compañía en la columna de al lado como eco de
// diseño. Reconstruir eso con heurísticas de coordenadas dejaba una de cada
// cinco filas contaminada, y ese tipo de error es invisible después.
//
// Cubre del martes 25 al sábado 29. Los días 21 al 23 ya pasaron: cargarlos no
// cambia ninguna decisión y solo mete ruido en la detección de repeticiones.
//
// Duraciones estimadas según la tabla de la skill festival-agenda: teatro,
// danza y títeres 80 min; concierto 90; clown e infantil 70; molienda y cabaret
// 180; cena espectáculo 120. Ninguna está confirmada con la sala.

export const PROGRAMACION = [
  // ---- Martes 25 ----
  { fecha: '2026-08-25', hora: 1200, dur: 80, obra: 'Petra, versión libre para gesto y danza', cia: 'AmbidiestroLab (Bogotá)', sala: 'mata', pleno: 35000, dcto: 10900, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-25', hora: 1200, dur: 80, obra: 'Antígona la necia', cia: 'Teatro del Bardo (Argentina)', sala: 'ocs', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-25', hora: 1170, dur: 80, obra: 'La Séptima Trompeta', cia: 'Teatro El Nombre (Medellín)', sala: 'esc3', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },

  // ---- Miércoles 26 ----
  { fecha: '2026-08-26', hora: 1200, dur: 180, obra: 'Molienda de Danza', cia: 'Evento especial · INCOLBALLET (Cali) y Era Parca (Medellín)', sala: 'ptu', pleno: 0, dcto: null, nota: 'Entrada libre con Eticketa Blanca. Se agota antes que las pagas.' },
  { fecha: '2026-08-26', hora: 1200, dur: 80, obra: 'Kaká y Wesika: Colcha Onírica de la desmemoria', cia: 'Fantoches y Monalisas (Villa de Leyva / Sutamarchán)', sala: 'agite', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-26', hora: 1140, dur: 70, obra: 'Eco-Clown', cia: 'Jader Clown', sala: 'caran', pleno: 0, dcto: null, nota: 'Entrada libre (Salas Abiertas)' },
  { fecha: '2026-08-26', hora: 1170, dur: 90, obra: 'Cuando las emociones hablan', cia: 'Conversatorio · Carolina Restrepo', sala: 'sucur', pleno: 0, dcto: null, nota: 'Encuentro entre la psicología y el arte de la voz' },
  { fecha: '2026-08-26', hora: 1200, dur: 90, obra: 'Os Chorizos (Homenaje a Cartola)', cia: null, sala: 'pasca', pleno: 36000, dcto: null, nota: null },
  { fecha: '2026-08-26', hora: 1200, dur: 80, obra: 'Petra, versión libre para gesto y danza', cia: 'AmbidiestroLab (Bogotá)', sala: 'mata', pleno: 35000, dcto: 10900, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-26', hora: 1140, dur: 80, obra: 'La Bruja sin nombre', cia: 'Teatro del Bardo (Argentina)', sala: 'gente', pleno: 0, dcto: null, nota: 'Entrada con trueque' },
  { fecha: '2026-08-26', hora: 1200, dur: 80, obra: 'Fe de Ratas', cia: 'Corporación Teatro Estudio (El Carmen de Viboral)', sala: 'ziru', pleno: 20000, dcto: 10000, nota: 'Aporte cultural o trueque equivalente' },

  // ---- Jueves 27 ----
  { fecha: '2026-08-27', hora: 1320, dur: 120, obra: 'Teatro y Cocina', cia: 'Jorge Blandón · Teatro Comunitario y Sancocho', sala: 'mata', pleno: 40000, dcto: null, nota: 'Precio único, incluye cena. Fe de erratas del 20 de agosto: la hora es 10:00 p.m., el volante impreso dice 9:30.', fuente: 'fe-de-erratas' },
  { fecha: '2026-08-27', hora: 1200, dur: 80, obra: 'Kaká y Wesika: Colcha Onírica de la desmemoria', cia: 'Fantoches y Monalisas (Villa de Leyva / Sutamarchán)', sala: 'agite', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-27', hora: 1140, dur: 80, obra: 'La Casa... El lugar donde todo comienza', cia: 'Cazamáscaras (Cali)', sala: 'canchi', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-27', hora: 630, dur: 70, obra: 'Diente de leche', cia: 'Fundación Títerefué (Ecuador)', sala: 'sucur', pleno: 35000, dcto: null, nota: 'Función de mañana, 10:30 a.m.' },
  { fecha: '2026-08-27', hora: 1260, dur: 90, obra: 'Macha y El Bloque Depresivo', cia: null, sala: 'pasca', pleno: 65000, dcto: null, nota: null },
  { fecha: '2026-08-27', hora: 1170, dur: 80, obra: 'Aqua', cia: 'Kósmosis (Envigado)', sala: 'poli', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-27', hora: 1200, dur: 80, obra: 'Primer Amor', cia: 'Colectivo Teatral Matacandelas · de Samuel Beckett', sala: 'mata', pleno: 45000, dcto: 13700, nota: 'General $45.000 · estudiantes, tercera edad y discapacidad $25.000 · en bicicleta $20.000 · asociados CONFIAR $20.000 · Comfama TA $13.700' },
  { fecha: '2026-08-27', hora: 1140, dur: 80, obra: 'Doña Felipa o El Motín de las Chicheras', cia: 'Nómade Teatro (Pasto)', sala: 'gente', pleno: 0, dcto: null, nota: 'Entrada con trueque' },
  { fecha: '2026-08-27', hora: 1020, dur: 80, obra: 'La vida es un cilindro', cia: 'Los Chicos del Jardín (Manizales)', sala: 'ocs', pleno: 35000, dcto: null, nota: 'Doble función: 5:00 y 8:00 p.m.' },
  { fecha: '2026-08-27', hora: 1200, dur: 80, obra: 'La vida es un cilindro', cia: 'Los Chicos del Jardín (Manizales)', sala: 'ocs', pleno: 35000, dcto: null, nota: 'Doble función: 5:00 y 8:00 p.m.' },
  { fecha: '2026-08-27', hora: 1170, dur: 80, obra: 'Obstinados', cia: 'INCOLBALLET (Cali)', sala: 'popu', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-27', hora: 1170, dur: 80, obra: 'Perversa', cia: 'Teatro Escena 3', sala: 'esc3', pleno: 30000, dcto: null, nota: 'Compra por WhatsApp 321 7035575, no en taquilla' },
  { fecha: '2026-08-27', hora: 1170, dur: 80, obra: 'Instrucciones para Imaginar', cia: 'Yovanny Torres', sala: 'viva', pleno: 20000, dcto: null, nota: null },
  { fecha: '2026-08-27', hora: 1200, dur: 80, obra: 'La Soledad en Tiempos de Pandemia', cia: 'Semillero Ziruma', sala: 'ziru', pleno: 20000, dcto: 10000, nota: 'Trueque equivalente' },

  // ---- Viernes 28 ----
  { fecha: '2026-08-28', hora: 1170, dur: 180, obra: 'Molienda de la Palabra', cia: 'Evento especial · narración oral y cuentería', sala: 'viva', pleno: 35000, dcto: null, nota: 'Maratón de más de tres horas' },
  { fecha: '2026-08-28', hora: 1200, dur: 70, obra: 'El Klownmasutra', cia: 'Agité Teatro (Estreno)', sala: 'agite', pleno: 30000, dcto: 20000, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 960, dur: 80, obra: 'A la diestra de Dios padre', cia: 'Jorge Wolf', sala: 'arle', pleno: 0, dcto: null, nota: 'Entrada libre' },
  { fecha: '2026-08-28', hora: 1170, dur: 70, obra: 'Diente de leche', cia: 'Fundación Títerefué (Ecuador)', sala: 'barra', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 1170, dur: 80, obra: 'La Casa... El lugar donde todo comienza', cia: 'Teatro Cazamáscaras (Cali)', sala: 'casat', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 1200, dur: 80, obra: 'Habitar', cia: 'Móvil Teatro Laboratorio (Bogotá)', sala: 'pobla', pleno: 35000, dcto: 10900, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 1200, dur: 80, obra: 'Edipo Rey', cia: 'Ecos Teatro (Medellín)', sala: 'clown', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 1170, dur: 80, obra: 'La montaña que arde', cia: 'Lacerarte', sala: 'canchi', pleno: 30000, dcto: null, nota: null },
  { fecha: '2026-08-28', hora: 1170, dur: 70, obra: 'Los cuentos de Papita Manuel', cia: 'Liliana Zapata', sala: 'caretas', pleno: 10000, dcto: null, nota: 'Donación o trueque' },
  { fecha: '2026-08-28', hora: 1140, dur: 80, obra: 'Antígona la necia', cia: 'Teatro del Bardo (Argentina)', sala: 'elemen', pleno: 35000, dcto: null, nota: 'En Santa Elena: bloquea la noche entera' },
  { fecha: '2026-08-28', hora: 900, dur: 70, obra: 'El Rey Midas', cia: null, sala: 'fanfa', pleno: 42000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 600, dur: 70, obra: 'La Maleta Mágica', cia: 'Vive La Voz', sala: 'sucur', pleno: 0, dcto: null, nota: 'Función de mañana, 10:00 a.m.' },
  { fecha: '2026-08-28', hora: 1260, dur: 90, obra: 'Orquesta La Pascasia', cia: null, sala: 'pasca', pleno: 50000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 1200, dur: 80, obra: 'Ixaquene', cia: 'Laquebaila (Bogotá)', sala: 'mata', pleno: 35000, dcto: 10900, nota: 'Acrobacia aérea en tela y video mapping. Descuentos afiliados a Comfama.' },
  { fecha: '2026-08-28', hora: 1140, dur: 80, obra: 'Doña Felipa o El Motín de las Chicheras', cia: 'Nómade Teatro (Pasto)', sala: 'gente', pleno: 0, dcto: null, nota: 'Entrada con trueque' },
  { fecha: '2026-08-28', hora: 1200, dur: 80, obra: 'PESSOAS', cia: 'Teatro Oficina Central de los Sueños (Estreno)', sala: 'ocs', pleno: 35000, dcto: 25000, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 1170, dur: 80, obra: 'Mestiza', cia: 'CasaTaller Teatro (Medellín)', sala: 'popu', pleno: 35000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-28', hora: 1170, dur: 80, obra: 'Perversa', cia: 'Teatro Escena 3', sala: 'esc3', pleno: 30000, dcto: null, nota: 'Compra por WhatsApp 321 7035575, no en taquilla' },
  { fecha: '2026-08-28', hora: 1200, dur: 80, obra: 'La Soledad en Tiempos de Pandemia', cia: 'Semillero Ziruma', sala: 'ziru', pleno: 20000, dcto: 10000, nota: 'Trueque equivalente' },

  // ---- Sábado 29 ----
  { fecha: '2026-08-29', hora: 1200, dur: 70, obra: 'Fiesta Clown', cia: 'Colectivo Teatral Infusión', sala: 'clown', pleno: 30000, dcto: 10700, nota: 'Comfama TA $10.700 · TB $15.500 · TC $26.300' },
  { fecha: '2026-08-29', hora: 900, dur: 70, obra: 'El Rey Midas', cia: 'Piñata de la Fiesta', sala: 'fanfa', pleno: 42000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-29', hora: 960, dur: 70, obra: 'Pachito el silleterito', cia: 'Teatro Barra del Silencio (Piñata de la Fiesta)', sala: 'barra', pleno: 25000, dcto: 20000, nota: null },
  { fecha: '2026-08-29', hora: 960, dur: 70, obra: 'Una Aventura de Circo', cia: 'Ácrora Circo (Piñata de la Fiesta)', sala: 'caran', pleno: 20000, dcto: null, nota: null },
  { fecha: '2026-08-29', hora: 960, dur: 70, obra: 'El duende del circo', cia: 'Teatro Oficina Central de los Sueños (Piñata de la Fiesta)', sala: 'ocs', pleno: 35000, dcto: 25000, nota: 'Niños y niñas $15.000' },
  { fecha: '2026-08-29', hora: 960, dur: 70, obra: 'Cuando los cuentos se pusieron la nariz roja', cia: 'Clau Torres, Jacobo Villa, Luz Restrepo, Vicky Valencia, Lorena Montes (Piñata de la Fiesta)', sala: 'viva', pleno: 10000, dcto: null, nota: 'Los niños pagan con sonrisas' },
  { fecha: '2026-08-29', hora: 990, dur: 70, obra: 'GalactiGatos', cia: 'Marary Teatro (Piñata de la Fiesta)', sala: 'mata', pleno: 30000, dcto: 25000, nota: null },
  { fecha: '2026-08-29', hora: 1020, dur: 70, obra: 'Diente de leche', cia: 'Fundación Títerefué (Piñata de la Fiesta)', sala: 'caretas', pleno: 10000, dcto: null, nota: 'Donación o trueque' },
  { fecha: '2026-08-29', hora: 1020, dur: 70, obra: 'La Maleta Mágica', cia: 'Vive La Voz (Piñata de la Fiesta)', sala: 'sucur', pleno: 35000, dcto: 25000, nota: null },
  { fecha: '2026-08-29', hora: 1020, dur: 70, obra: 'Sastrecillo Valiente', cia: 'Teatro Popular de Medellín (Piñata de la Fiesta)', sala: 'popu', pleno: 30000, dcto: null, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-29', hora: 1170, dur: 80, obra: 'Danza que honra la vida', cia: 'Celajes (Piñata de la Fiesta)', sala: 'arle', pleno: 0, dcto: null, nota: 'Entrada libre con aporte voluntario' },
  { fecha: '2026-08-29', hora: 1140, dur: 80, obra: '¡Acción! Una Aventura Gestual', cia: null, sala: 'elemen', pleno: 20000, dcto: 10000, nota: 'En Santa Elena: bloquea la noche entera' },
  { fecha: '2026-08-29', hora: 1170, dur: 80, obra: 'El sendero del brujo', cia: 'Camilo Cano', sala: 'viva', pleno: 20000, dcto: null, nota: null },
  { fecha: '2026-08-29', hora: 1170, dur: 80, obra: 'La montaña que arde', cia: 'Lacerarte', sala: 'canchi', pleno: 30000, dcto: null, nota: null },
  { fecha: '2026-08-29', hora: 1170, dur: 80, obra: 'Perversa', cia: 'Teatro Escena 3', sala: 'esc3', pleno: 30000, dcto: null, nota: 'Compra por WhatsApp 321 7035575, no en taquilla' },
  { fecha: '2026-08-29', hora: 1200, dur: 80, obra: 'Habitar', cia: 'Móvil Teatro Laboratorio (Bogotá)', sala: 'pobla', pleno: 35000, dcto: 10900, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-29', hora: 1200, dur: 80, obra: 'Ixaquene', cia: 'Laquebaila (Bogotá)', sala: 'mata', pleno: 35000, dcto: 10900, nota: 'Acrobacia aérea en tela y video mapping. Descuentos afiliados a Comfama.' },
  { fecha: '2026-08-29', hora: 1200, dur: 80, obra: 'PESSOAS', cia: 'Teatro Oficina Central de los Sueños (Estreno)', sala: 'ocs', pleno: 35000, dcto: 25000, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-29', hora: 1200, dur: 70, obra: 'El Klownmasutra', cia: 'Agité Teatro (Estreno)', sala: 'agite', pleno: 30000, dcto: 20000, nota: 'Descuentos afiliados a Comfama' },
  { fecha: '2026-08-29', hora: 1200, dur: 80, obra: 'La Soledad en Tiempos de Pandemia', cia: 'Semillero Ziruma', sala: 'ziru', pleno: 20000, dcto: 10000, nota: 'Trueque equivalente' },
  { fecha: '2026-08-29', hora: 1320, dur: 90, obra: 'El Son de Pablo', cia: null, sala: 'pasca', pleno: 50000, dcto: null, nota: null },
];
