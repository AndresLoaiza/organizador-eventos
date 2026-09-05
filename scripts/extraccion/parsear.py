# -*- coding: utf-8 -*-
"""Extrae la programacion del Festival de Teatro Comfama San Ignacio.

El markdown de defuddle repite un bloque de cuatro partes por funcion:

    ![](imagen) TituloDia. / D mes. (duracion)
    **Compania (Pais)** Publico | Descripcion
    **Sala** | hora
    [Ver mas](enlace)

La trampa esta en la primera linea: el titulo y el dia van pegados sin
separador ("La tercera mitadSab. / 31 oct."), asi que el corte tiene que
hacerse por el patron del dia y no por espacios.
"""
import io, re, json, unicodedata

RUTA = 'trabajo/sanignacio/pagina.md'
MES = {'oct': 10, 'nov': 11, 'sep': 9, 'dic': 12}

texto = io.open(RUTA, encoding='utf-8').read()

# Un bloque va de una imagen a la siguiente, o al final.
bloques = re.split(r'\n(?=!\[\]\(https)', texto)

DIA = re.compile(
    r'^!\[\]\((?P<img>[^)]+)\)\s*(?P<resto>.+?)$', re.M)
CABECERA = re.compile(
    r'(?P<titulo>.+?)'
    r'(?P<dia>Sáb|Dom|Lun|Mar|Mi[eé]r?|Jue|Vie)\.\s*/\s*(?P<d>\d{1,2})\s*(?P<mes>\w{3})\.?'
    r'\s*(?:\((?P<dur>[^)]*)\))?\s*$')
FICHA = re.compile(
    r'^\*\*(?P<cia>[^*]+)\*\*[ \t]*(?P<publico>[^|\n]*?)[ \t]*(?:\|[ \t]*(?P<desc>.+))?$', re.M)
# La hora puede traer dos: "3:00 p. m. y 5:00 p. m." es doble funcion.
SALA = re.compile(r'^\*\*(?P<sala>[^*]+)\*\*\s*\|\s*(?P<hora>\d{1,2}:\d{2}[^|\n]*)$', re.M)
UNA_HORA = re.compile(r'\d{1,2}:\d{2}\s*[ap]\.?\s*m\.?', re.I)
ENLACE = re.compile(r'\[Ver más\]\((?P<url>[^)]+)\)')


def minutos(h):
    m = re.match(r'(\d{1,2}):(\d{2})\s*([ap])', h.strip().lower().replace('\xa0', ' '))
    if not m:
        return None
    hh, mm, ap = int(m.group(1)), int(m.group(2)), m.group(3)
    if ap == 'p' and hh != 12:
        hh += 12
    if ap == 'a' and hh == 12:
        hh = 0
    return hh * 60 + mm


def duracion(s):
    """'60 minutos' / '1h y 15 min' / '1 hora' -> minutos. None si no dice."""
    if not s:
        return None
    s = s.lower()
    h = re.search(r'(\d+)\s*h', s)
    mi = re.search(r'(?:y\s*)?(\d+)\s*min', s)
    if h:
        return int(h.group(1)) * 60 + (int(mi.group(1)) if mi else 0)
    if mi:
        return int(mi.group(1))
    return None


funciones, sueltos = [], []
for b in bloques:
    mi = DIA.search(b)
    if not mi:
        continue
    cab = CABECERA.search(mi.group('resto').strip())
    if not cab:
        sueltos.append(mi.group('resto')[:80])
        continue
    ficha = FICHA.search(b)
    sala = SALA.search(b)
    enlace = ENLACE.search(b)
    mes = MES.get(cab.group('mes').lower()[:3])
    # Una obra con funcion a las 3:00 y a las 5:00 son DOS entradas, no una.
    # Colapsarlas borra del analisis la posibilidad de encadenar dos cosas esa
    # tarde, que es justo lo que la herramienta deberia descubrir.
    horas = UNA_HORA.findall(sala.group('hora')) if sala else []
    for h in (horas or [None]):
        funciones.append({
            'obra': cab.group('titulo').strip(),
            'fecha': '2026-%02d-%02d' % (mes, int(cab.group('d'))),
            'hora_min': minutos(h) if h else None,
            'duracion_min': duracion(cab.group('dur')),
            'sala': sala.group('sala').strip() if sala else None,
            'compania': (ficha.group('cia') or '').strip() or None if ficha else None,
            'publico': (ficha.group('publico') or '').strip() or None if ficha else None,
            'descripcion': (ficha.group('desc') or '').strip() or None if ficha else None,
            'imagen': mi.group('img'),
            'enlace': enlace.group('url') if enlace else None,
        })

io.open('trabajo/sanignacio/funciones.json', 'w', encoding='utf-8').write(
    json.dumps(funciones, ensure_ascii=False, indent=1))

print('funciones:', len(funciones), ' bloques sin cabecera:', len(sueltos))
for s in sueltos[:6]:
    print('   ?', s)
print()
dias = {}
for f in funciones:
    dias[f['fecha']] = dias.get(f['fecha'], 0) + 1
for d in sorted(dias):
    print(' ', d, dias[d])
faltan = [f['obra'] for f in funciones if not f['hora_min'] or not f['sala']]
print('\nsin hora o sin sala:', len(faltan), faltan[:5])
print('sin duracion:', sum(1 for f in funciones if not f['duracion_min']))
print('titulos distintos:', len({f['obra'] for f in funciones}))
