// Plata: qué se sabe y qué no.
//
// Tres estados, no dos. Un número es un precio; cero es entrada libre; null es
// que el organizador no lo publicó. Colapsar los dos últimos hacía que la
// agenda dijera "Entrada libre" sobre funciones de Comfama que sí se pagan, y
// que la tabla de pendientes mostrara un costo de $0 con aire de dato cierto.
//
// Nada de esto estima. Si el precio no está publicado, la respuesta es que no
// está publicado.

/** Lo que costaría una boleta: el descuento si lo hay, si no la plena. */
export function precioDe(f) {
  return f.precio_dcto ?? f.precio_pleno ?? null;
}

export function pesos(n) {
  return `$${Number(n).toLocaleString('es-CO')}`;
}

/**
 * Cuánto falta por pagar de un conjunto de funciones.
 *
 * `sinPrecio` no es un detalle: un total de $180.000 que en realidad ignora
 * ocho funciones sin tarifa publicada es peor que no dar total, porque se lee
 * como si fuera el costo del plan completo. Quien llama tiene que decirlo.
 */
export function costoPendiente(funciones) {
  let total = 0, sinPrecio = 0, conPrecio = 0;
  for (const f of funciones) {
    const faltan = (f.necesarias ?? 1) - (f.boletas?.length ?? 0);
    if (faltan <= 0) continue;
    const p = precioDe(f);
    if (p == null) { sinPrecio++; continue; }
    total += faltan * p;
    conPrecio++;
  }
  return { total, sinPrecio, conPrecio };
}

/** Cómo se dice el precio de una función en una línea. */
export function textoPrecio(f) {
  if (f.pagado > 0) return { etiqueta: 'Pagado', valor: pesos(f.pagado) };
  const p = f.precio_pleno;
  if (p == null) return { etiqueta: 'Precio sin publicar', valor: null };
  if (p === 0) return { etiqueta: 'Entrada libre', valor: null };
  return {
    etiqueta: 'Vale',
    valor: pesos(p),
    descuento: f.precio_dcto ? pesos(f.precio_dcto) : null,
  };
}
