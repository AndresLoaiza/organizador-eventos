import { recomponer } from './legado.mjs';
import { aMinutos, aHora, llaveFuncion } from './formato.mjs';
import { tituloNormalizado } from './nombres.mjs';

// Del formato 1 a filas de eventos.funciones, y qué cambiaría al cargar.
// Puro: cargar.mjs pone la base, aquí solo se compara.

/** Columnas de catálogo: lo que publica el organizador. Lo del usuario no está. */
export const COLUMNAS = [
  'sala_id', 'fecha', 'hora_min', 'duracion_min', 'duracion_confirmada', 'obra',
  'compania', 'descripcion', 'franjas', 'publico', 'precio_pleno', 'precio_dcto',
  'nota_boleteria', 'fuente_horario', 'imagen_key', 'imagen_credito', 'tipos', 'url_compra',
];

export function aFila(f, salaId) {
  // Sin esto una sala que falta en salaId se graba como función sin sala, sin
  // error: sala_id admite null.
  if (!salaId[f.sala]) throw new Error(`la sala ${f.sala} no tiene id en la base`);
  const legado = recomponer(f);
  return {
    sala_id: salaId[f.sala],
    fecha: f.fecha,
    hora_min: aMinutos(f.hora),
    duracion_min: f.duracion.min,
    duracion_confirmada: f.duracion.confirmada,
    obra: f.obra,
    compania: legado.compania,
    descripcion: f.descripcion ?? null,
    franjas: f.franjas?.length ? f.franjas : null,
    publico: f.publico ?? null,
    precio_pleno: f.precio.libre ? 0 : f.precio.pleno,
    precio_dcto: f.precio.dcto ?? null,
    nota_boleteria: legado.nota_boleteria,
    fuente_horario: f.fuente_horario,
    imagen_key: f.imagen?.key ?? null,
    imagen_credito: f.imagen?.credito ?? null,
    tipos: f.tipos?.length ? f.tipos : null,
    url_compra: f.url_compra ?? null,
  };
}

// "" y null son el mismo "sin dato": 15 funciones de la Fiesta del Libro traen
// compania "" y no deben aparecer como cambio.
const sinDato = x => (x === '' || x === undefined ? null : x);
const igual = (a, b) => JSON.stringify(sinDato(a)) === JSON.stringify(sinDato(b));

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function llaveDeFila(r) {
  // Una fecha que llega como Date (consulta sin to_char) cambia todas las
  // llaves: nada casaría y el plan borraría y reinsertaría el festival entero.
  if (typeof r.fecha !== 'string' || !FECHA.test(r.fecha)) {
    throw new Error(`fila ${r.id}: fecha debe venir como texto AAAA-MM-DD, llegó ${JSON.stringify(r.fecha)}`);
  }
  if (!Number.isInteger(r.hora_min)) throw new Error(`fila ${r.id}: hora_min debe ser entero`);
  return llaveFuncion({ fecha: r.fecha, hora: aHora(r.hora_min), sala: r.sala_slug, obra: r.obra });
}

/** Borrar más de esta fracción de las funciones existentes (y más de MINIMO_BORRADO) exige permiso. */
const TOPE_BORRADO = 0.1;
const MINIMO_BORRADO = 5;

/**
 * @param json        festival en formato 1, ya validado
 * @param actuales    filas de la base: columnas de COLUMNAS más id y sala_slug, fecha como texto
 * @param salaId      { slug: uuid }
 * @param conUsuario  ids con algo del usuario (agenda, interés, boleta, juicio, estado de compra)
 * @param opciones    { permitirBorrado }: sin él, un borrado masivo es error
 *
 * dudosas: función nueva cuya obra coincide con una retirada que tiene datos
 * tuyos. Casi siempre es la misma función con otra hora, sala o fecha; insertarla
 * duplicaría la obra y dejaría tu agenda en la copia vieja. Se decide a mano.
 */
export function planificar(json, actuales, salaId, conUsuario = new Set(), opciones = {}) {
  const porLlave = new Map();
  for (const a of actuales) {
    const k = llaveDeFila(a);
    if (porLlave.has(k)) throw new Error(`dos funciones de la base con la misma llave: ${k}`);
    porLlave.set(k, a);
  }

  const nuevas = [], actualizar = [], retirar = [], avisar = [];
  const vistas = new Set();
  for (const f of json.funciones) {
    const k = llaveFuncion(f);
    vistas.add(k);
    const nueva = aFila(f, salaId);
    const previa = porLlave.get(k);
    if (!previa) { nuevas.push(nueva); continue; }
    const cambios = {};
    for (const c of COLUMNAS) {
      if (!igual(previa[c], nueva[c])) cambios[c] = { antes: sinDato(previa[c]), despues: nueva[c] };
    }
    if (Object.keys(cambios).length) actualizar.push({ id: previa.id, llave: k, cambios });
  }
  for (const [k, a] of porLlave) {
    if (!vistas.has(k)) (conUsuario.has(a.id) ? avisar : retirar).push({ id: a.id, llave: k, fila: a });
  }

  // Emparejar cada retirada con datos tuyos con a lo sumo una nueva de la misma
  // obra, prefiriendo la de la misma fecha.
  const dudosas = [];
  const libres = new Set(nuevas);
  for (const r of [...avisar]) {
    const obra = tituloNormalizado(r.fila.obra);
    const candidatas = [...libres].filter(n => tituloNormalizado(n.obra) === obra);
    const par = candidatas.find(n => n.fecha === r.fila.fecha) ?? candidatas[0];
    if (!par) continue;
    libres.delete(par);
    avisar.splice(avisar.indexOf(r), 1);
    dudosas.push({ previa: r, nueva: par });
  }
  const insertar = nuevas.filter(n => libres.has(n));

  const masivo = retirar.length > MINIMO_BORRADO && retirar.length > actuales.length * TOPE_BORRADO;
  if (!opciones.permitirBorrado && masivo) {
    throw new Error(`el plan borraría ${retirar.length} de ${actuales.length} funciones; ` +
      'si es intencional, pasa permitirBorrado');
  }
  const sinFila = ({ fila, ...resto }) => resto;
  return {
    insertar, actualizar,
    retirar: retirar.map(sinFila), avisar: avisar.map(sinFila),
    dudosas: dudosas.map(d => ({ previa: sinFila(d.previa), nueva: d.nueva })),
  };
}

/** Diferencias de salas y traslados, como frases. Vacío = nada cambia. */
export function cambiosCatalogo(json, salasActuales, trasladosActuales) {
  const out = [];
  const salas = new Map(salasActuales.map(s => [s.slug, s]));
  for (const s of json.salas) {
    const a = salas.get(s.slug);
    if (!a) { out.push(`sala ${s.slug}: nueva`); continue; }
    for (const c of ['nombre', 'direccion', 'telefono', 'zona']) {
      if (!igual(a[c], s[c])) out.push(`sala ${s.slug}: ${c} ${JSON.stringify(a[c] ?? null)} → ${JSON.stringify(s[c] ?? null)}`);
    }
  }
  const tras = new Map(trasladosActuales.map(t => [`${t.zona_a}|${t.zona_b}`, t.minutos]));
  for (const t of json.traslados) {
    const a = tras.get(`${t.zona_a}|${t.zona_b}`);
    if (a == null) out.push(`traslado ${t.zona_a} → ${t.zona_b}: nuevo`);
    else if (a !== t.minutos) out.push(`traslado ${t.zona_a} → ${t.zona_b}: ${a} → ${t.minutos}`);
  }
  return out;
}
