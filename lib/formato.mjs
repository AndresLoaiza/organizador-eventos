import { tituloNormalizado } from './nombres.mjs';

// Formato 1: un festival tal como lo publica el organizador. Esquema y razones
// en docs/superpowers/specs/2026-11-02-reescritura-profunda-design.md.
//
// validar() devuelve la lista completa de errores, no el primero: al corregir
// un JSON de 776 funciones, arreglar de a un error por corrida es un castigo.

export const FORMATO = 1;
export const METODOS = ['markitdown', 'defuddle', 'imagen'];

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const esListaDeTexto = x => Array.isArray(x) && x.every(v => typeof v === 'string');

export const aMinutos = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
export const aHora = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Identidad de una función entre recargas: no cambia si cambia el precio o la nota. */
export function llaveFuncion(f) {
  return `${f.fecha}|${f.hora}|${f.sala}|${tituloNormalizado(f.obra)}`;
}

export function validar(j) {
  const e = [];
  if (j?.formato !== FORMATO) e.push(`formato debe ser ${FORMATO}`);

  const fe = j?.festival ?? {};
  for (const k of ['slug', 'nombre', 'ciudad', 'fecha_inicio', 'fecha_fin']) {
    if (!fe[k]) e.push(`festival.${k} falta`);
  }
  for (const k of ['fecha_inicio', 'fecha_fin']) {
    if (fe[k] && !FECHA.test(fe[k])) e.push(`festival.${k} no es AAAA-MM-DD`);
  }

  if (!Array.isArray(j?.fuentes) || !j.fuentes.length) e.push('fuentes: hace falta al menos una');
  for (const [i, f] of (j?.fuentes ?? []).entries()) {
    if (!f.key) e.push(`fuentes[${i}].key falta`);
    if (!METODOS.includes(f.metodo)) e.push(`fuentes[${i}].metodo debe ser uno de ${METODOS.join(', ')}`);
  }

  const salas = new Map();
  for (const [i, s] of (j?.salas ?? []).entries()) {
    if (!s || typeof s !== 'object') { e.push(`salas[${i}] no es un objeto`); continue; }
    if (!s.slug || !s.nombre || !s.zona) e.push(`sala ${s.slug ?? '?'}: slug, nombre y zona son obligatorios`);
    if (salas.has(s.slug)) e.push(`sala ${s.slug} repetida`);
    salas.set(s.slug, s);
  }

  const zonas = [...new Set([...salas.values()].map(s => s.zona))];
  for (const t of j?.traslados ?? []) {
    if (!Number.isInteger(t?.minutos) || t.minutos <= 0) {
      e.push(`traslado ${t?.zona_a} → ${t?.zona_b}: minutos debe ser entero positivo`);
    }
  }
  const hay = new Set((j?.traslados ?? []).map(t => `${t?.zona_a}|${t?.zona_b}`));
  for (const a of zonas) for (const b of zonas) {
    if (!hay.has(`${a}|${b}`)) e.push(`falta traslado ${a} → ${b}`);
  }

  const llaves = new Set();
  const titulos = new Map();
  for (const [i, f] of (j?.funciones ?? []).entries()) {
    if (!f || typeof f !== 'object') { e.push(`funciones[${i}] no es un objeto`); continue; }
    const donde = `funciones[${i}] «${f.obra ?? '?'}»`;
    if (!f.obra) e.push(`${donde}: obra falta`);
    if (!FECHA.test(f.fecha ?? '')) e.push(`${donde}: fecha no es AAAA-MM-DD`);
    else if (fe.fecha_inicio && (f.fecha < fe.fecha_inicio || f.fecha > fe.fecha_fin)) {
      e.push(`${donde}: ${f.fecha} queda fuera del festival`);
    }
    if (!HORA.test(f.hora ?? '')) e.push(`${donde}: hora debe ser HH:MM en 24 h`);
    if (!salas.has(f.sala)) e.push(`${donde}: sala ${f.sala} no está declarada`);
    if (!Number.isInteger(f.duracion?.min) || f.duracion.min <= 0) e.push(`${donde}: duracion.min debe ser entero positivo`);
    if (typeof f.duracion?.confirmada !== 'boolean') e.push(`${donde}: duracion.confirmada debe ser booleano`);
    if (!f.fuente_horario) e.push(`${donde}: fuente_horario falta`);

    if (!esListaDeTexto(f.franjas)) e.push(`${donde}: franjas debe ser una lista de textos`);
    if (f.tipos != null && !esListaDeTexto(f.tipos)) e.push(`${donde}: tipos debe ser null o una lista de textos`);

    const p = f.precio ?? {};
    if (!f.precio) e.push(`${donde}: precio falta`);
    for (const k of ['pleno', 'dcto']) {
      if (p[k] != null && !Number.isInteger(p[k])) e.push(`${donde}: precio.${k} debe ser entero o null`);
    }
    if (f.precio && typeof p.libre !== 'boolean') e.push(`${donde}: precio.libre debe ser booleano`);
    if (p.pleno === 0 && p.libre !== true) e.push(`${donde}: pleno 0 exige libre: true`);
    if (p.libre === true && p.pleno != null && p.pleno !== 0) e.push(`${donde}: libre con pleno ${p.pleno}`);

    const k = llaveFuncion(f);
    if (llaves.has(k)) e.push(`${donde}: llave repetida ${k}`);
    llaves.add(k);

    if (f.obra) {
      const n = tituloNormalizado(f.obra);
      if (!titulos.has(n)) titulos.set(n, new Set());
      titulos.get(n).add(f.obra);
    }
  }
  for (const formas of titulos.values()) {
    if (formas.size > 1) e.push(`mismo título escrito distinto: ${[...formas].join(' / ')}`);
  }
  return e;
}
