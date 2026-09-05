# -*- coding: utf-8 -*-
"""Convierte lo extraido de la pagina en un modulo versionado.

La programacion sale de una pagina web que puede cambiar o caerse. Igual que
`datos-22-fiesta.mjs` congelo la transcripcion del volante, esto congela lo
extraido del sitio: el cargador consume el modulo, no la red.
"""
import io, json, re, unicodedata

fs = json.load(io.open('trabajo/sanignacio/funciones.json', encoding='utf-8'))

# El sitio escribe la misma sala de dos maneras. Sin unificar, el motor las
# trata como salas distintas y calcula un traslado entre una sala y ella misma.
SALA_CANONICA = {
    'Patio Teatro del Claustro Comfama': 'Patio Teatro Claustro Comfama',
}

# El sitio no publica duracion para tres funciones. Se estima con la tabla de
# la skill y queda marcada como estimada: cuando un margen dependa de este
# numero, la interfaz tiene que decirlo.
ESTIMADAS = {
    'García Multicolor': 70,          # familiar, en el andén de una estación
    'Todavía tenemos un tiempo': 80,  # teatro, al aire libre en la plazuela
}


def slug(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()[:60]


filas, sinDur = [], []
for f in fs:
    obra = f['obra']
    dur = f['duracion_min']
    confirmada = dur is not None
    if not confirmada:
        dur = ESTIMADAS.get(obra, 80)
        sinDur.append(obra)
    filas.append({
        'obra': obra,
        'fecha': f['fecha'],
        'hora_min': f['hora_min'],
        'duracion_min': dur,
        'duracion_confirmada': confirmada,
        'sala': SALA_CANONICA.get(f['sala'], f['sala']),
        'compania': f['compania'],
        'publico': f['publico'],
        'descripcion': f['descripcion'],
        'imagen': slug(obra) + '.webp',
        'enlace': f['enlace'],
    })

filas.sort(key=lambda x: (x['fecha'], x['hora_min'], x['obra']))

cuerpo = ',\n'.join(
    '  ' + json.dumps(x, ensure_ascii=False, sort_keys=True) for x in filas)

io.open('scripts/datos-san-ignacio.mjs', 'w', encoding='utf-8').write(
    '''// Programacion del Festival de Teatro Comfama San Ignacio 2026.
//
// Extraida de comfama.com/festivales/festival-teatro-san-ignacio con defuddle
// y congelada aqui: el sitio puede cambiar o caerse, y el cargador tiene que
// poder correr igual. Mismo criterio que datos-22-fiesta.mjs con el volante.
//
// Tres cosas que el extractor tuvo que resolver y conviene no deshacer:
//
//   - La cabecera pega el titulo al dia sin separador ("La tercera mitadSab. /
//     31 oct."), asi que el corte va por el patron del dia, no por espacios.
//   - "3:00 p. m. y 5:00 p. m." es DOBLE FUNCION y entra como dos filas. En
//     una sola se pierde la posibilidad de encadenar dos cosas esa tarde.
//   - El sitio escribe "Patio Teatro Claustro Comfama" y "Patio Teatro DEL
//     Claustro Comfama" para la misma sala. Ya vienen unificadas.
//
// El sitio no publica precios: Comfama cobra por tarifas TA/TB/TC/TD segun
// afiliacion, y la TA puede ser menos de la cuarta parte de la TD. No se
// inventa ninguno.

export const FESTIVAL = {
  slug: 'festival-teatro-san-ignacio-2026',
  nombre: 'Festival de Teatro Comfama San Ignacio',
  ciudad: 'Medellín',
  fecha_inicio: '2026-10-31',
  fecha_fin: '2026-11-07',
};

export const FUNCIONES = [
''' + cuerpo + '\n];\n')

print('filas:', len(filas))
print('estimadas:', len(sinDur), sorted(set(sinDur)))
print('salas:', len({x['sala'] for x in filas}))
for s in sorted({x['sala'] for x in filas}):
    print('   ', s)
