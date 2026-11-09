"""Lee las salas de Medellín que no son Cine Colombia y escribe cartelera/salas.json.

    pip install -r scripts/requirements-salas.txt && scrapling install   (una vez)
    python scripts/salas.py
    python scripts/salas.py --seco     solo imprime

Por sala, de dónde sale cada cosa:
  Procinal   API JSON pública de su web (apinew.procinal.com.co): cada película
             trae «version» (Doblada / Subtitulada), «idioma» (el original) y
             sus funciones con fecha y hora.
  Cinemark   El HTML de /cartelera/medellin trae la cartelera en __NEXT_DATA__,
             pero una sola versión por película. Las funciones por sede e
             idioma las pide la página en el navegador, así que cada película
             con versión subtitulada se abre con Scrapling y se lee la
             respuesta que su propia web recibe. Solo el día de hoy.
  Colombo    Página «programación por salas», HTML de WordPress: título, fecha
             y hora. El Colombo no publica el idioma: va marcado sin confirmar.
  MAMM       La cartelera lista fichas de WooCommerce; cada ficha trae sus
             funciones en data-product_variations. El MAMM dice en la misma
             página que proyecta en idioma original con subtítulos.

Una sala que falla no tumba a las demás: su «estado» dice qué pasó y el JSON
conserva lo demás. Nada se inventa: si no se lee, no se escribe.
"""
import json
import re
import ssl
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

RUTA = Path(__file__).resolve().parent.parent / 'cartelera' / 'salas.json'
UA = {'User-Agent': 'Mozilla/5.0 (organizador-eventos; uso personal)'}
VENTANA = 8  # días: hoy y la semana que sigue
MESES = {m: i + 1 for i, m in enumerate(
    'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split())}


def plano_py(t):
    import unicodedata
    t = unicodedata.normalize('NFD', (t or '').lower())
    return re.sub(r'[^a-z0-9]+', ' ', ''.join(c for c in t if unicodedata.category(c) != 'Mn')).strip()


def hoy_medellin():
    # Colombia es UTC-5 todo el año (sin horario de verano); zoneinfo en Windows pide tzdata.
    return datetime.now(timezone(timedelta(hours=-5))).date()


def en_ventana(d, hoy):
    return hoy <= d < hoy + timedelta(days=VENTANA)


def get_json(url):
    # urllib usa el almacén de certificados del sistema; curl_cffi no.
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60, context=ssl.create_default_context()) as r:
        return json.loads(r.read().decode('utf-8'))


def get_html(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60, context=ssl.create_default_context()) as r:
        return r.read().decode('utf-8')


def fecha_es(texto, hoy):
    """'noviembre 10' o '10 noviembre' → date. Sin año: el más cercano a hoy."""
    m = re.search(r'(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)|([a-záéíóú]+)\s+(\d{1,2})', texto.lower())
    if not m:
        return None
    dia, mes = (m.group(1), m.group(2)) if m.group(1) else (m.group(4), m.group(3))
    if mes not in MESES:
        return None
    candidatos = [date(hoy.year + k, MESES[mes], int(dia)) for k in (-1, 0, 1)]
    return min(candidatos, key=lambda d: abs((d - hoy).days))


def hora_24(texto):
    """'7:15 pm', '1:20 p.m.' o '21:20:00' → '19:15'."""
    m = re.search(r'(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?\s*m?', texto.lower())
    if not m:
        return None
    h, mi, ap = int(m.group(1)), m.group(2), m.group(3)
    if ap == 'p' and h < 12:
        h += 12
    if ap == 'a' and h == 12:
        h = 0
    return f'{h:02d}:{mi}'


def pelicula(titulo, sede, idioma, url, funciones, original=None, confirmado=True, anio=None, poster=None):
    return {
        'titulo': titulo.strip(), 'original': (original or titulo).strip(), 'sede': sede, 'anio': anio,
        'idioma': idioma, 'idioma_confirmado': confirmado, 'url': url, 'poster': poster,
        'funciones': sorted(funciones),
    }


def og_image(pagina):
    m = pagina.css('meta[property="og:image"]')
    u = m[0].attrib.get('content') if m else None
    return u if u and u.startswith('https://') else None


# --- Procinal ---------------------------------------------------------------

def leer_procinal(hoy):
    datos = get_json('https://apinew.procinal.com.co/api/movies?city=5')
    sedes = {c['id']: c['nombre_completo'] for c in get_json('https://apinew.procinal.com.co/api/cinemas?city=5')['data']}
    out = []
    for m in datos['movies']:
        version = (m.get('version') or '').lower()
        if version.startswith('subtitul'):
            idioma = 'Subtitulada'
        elif version != 'doblada' and (m.get('idioma') or '').lower().startswith('espa'):
            idioma = 'Español (original)'
        else:
            continue
        funciones = [f"{s['fecha_funcion']} {s['hora_funcion'][:5]}" for s in m.get('showtimes', [])
                     if en_ventana(date.fromisoformat(s['fecha_funcion']), hoy)]
        if not funciones:
            continue
        sede = 'Procinal ' + next(iter(sedes.values()), 'Terminal del Sur')
        out.append(pelicula(m['titulo'].title(), sede, idioma,
                            f"https://www.procinal.com.co/ciudad/medellin/pelicula/{m['slug']}",
                            funciones, m.get('titulo_original', '').title(), poster=m.get('imagen')))
    return out, f'{len(datos["movies"])} entradas leídas; {len(out)} en idioma original'


# --- Cinemark ---------------------------------------------------------------

# «Clayface(DOB PRE 2D)» → «Clayface»; «Akira RE» (reestreno) → «Akira».
LIMPIA_CM = re.compile(r'\s*\([^)]*\)\s*$|\s+RE$')


def titulo_de(f):
    t = LIMPIA_CM.sub('', f.get('TitleAlt') or f['Title'])
    return t.title() if t.isupper() else t


def recorrer_dias(page):
    """Clic en cada día de la tira (div.week__day): cada clic pide las funciones
    de ese día y el page_setup las guarda. Su web publica de lunes a miércoles
    hasta que el jueves abre la semana nueva."""
    page.wait_for_timeout(2500)
    dias = page.locator('.week__day')
    for i in range(dias.count()):
        try:
            dias.nth(i).click(timeout=5000)
            page.wait_for_timeout(1800)
        except Exception:
            pass
    return page


def leer_cinemark(hoy, sesion):
    html = get_html('https://www.cinemark.com.co/cartelera/medellin')
    datos = json.loads(re.search(r'__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S).group(1))
    pp = datos['props']['pageProps']
    pelis = pp.get('PremieresBillboard', []) + pp.get('Presales', [])
    out, sin_leer = [], []
    for f in pelis:
        tipos = set(f.get('LangTypes') or [])
        if not tipos & {'SUB', 'ORI', 'ESP'}:
            continue
        slug = f.get('slugName') or f.get('SlugName')
        url = f'https://www.cinemark.com.co/cartelera/medellin/{slug}'
        recibidas = []

        def setup(page, recibidas=recibidas, cid=f['CorporateFilmId']):
            def guardar(r):
                if f'/city/medellin/movie/{cid}?' in r.url:
                    dia = re.search(r'[?&]date=(\d{4}-\d{2}-\d{2})', r.url)
                    try:
                        recibidas.append((date.fromisoformat(dia.group(1)) if dia else None, r.json()))
                    except Exception:
                        pass
            page.on('response', guardar)

        # Su web a veces pide /city/undefined/ (carrera al cargar la ciudad);
        # esa respuesta no sirve, así que se reintenta.
        for _ in range(3):
            sesion.fetch(url, page_setup=setup, page_action=recorrer_dias, network_idle=True, wait=1500, timeout=120000)
            if recibidas:
                break
        else:
            sin_leer.append(titulo_de(f))
        por_sede = {}
        # La página pide el primer día con funciones, que en preventa puede
        # caer semanas adelante: cuenta solo lo que esté en la ventana.
        for dia, r in recibidas:
            if not dia or not en_ventana(dia, hoy):
                continue
            for t in r.get('Theater', []):
                for fmt in t.get('Format', []):
                    lang = set(fmt.get('LangTypes') or [])
                    if not lang & {'SUB', 'ORI', 'ESP'}:
                        continue
                    idioma = 'Subtitulada' if 'SUB' in lang else 'Original' if 'ORI' in lang else 'Español (original)'
                    s = por_sede.setdefault(t['Name'], {'idioma': idioma, 'funciones': set()})
                    for ses in fmt.get('Sessions', []):
                        s['funciones'].add(f"{dia.isoformat()} {ses['Showtime'][:5]}")
        titulo = titulo_de(f)
        for sede, s in por_sede.items():
            out.append(pelicula(titulo, f'Cinemark {sede}', s['idioma'], url, s['funciones'],
                                poster=f.get('GraphicUrl') or f.get('CoverImageUrl') or None))
    falta = f'; sin leer: {", ".join(sin_leer)}' if sin_leer else ''
    return out, (f'{len(pelis)} películas en cartelera; {len(out)} sedes con función en idioma original '
                 f'(todos los días que publica su web){falta}')


# --- Colombo Americano ------------------------------------------------------

def leer_colombo(hoy, sesion):
    url = 'https://www.colombomedellin.edu.co/programacion-por-salas/'
    p = sesion.fetch(url, network_idle=True, wait=1500, timeout=90000)
    texto = p.get_all_text(ignore_tags=('script', 'style'))
    out = {}
    for n_sala in ('1', '2'):
        i = texto.find(f'Programación en la Sala {n_sala}')
        j = texto.find('La programación está sujeta', i)
        if i < 0 or j < 0:
            continue
        lineas = [l.strip() for l in texto[i:j].splitlines() if l.strip()]
        for k in range(1, len(lineas) - 1):
            d = fecha_es(lineas[k], hoy) if re.fullmatch(r'[a-záéíóú]+ \d{1,2}', lineas[k].lower()) else None
            h = hora_24(lineas[k + 1])
            if not d or not h or not en_ventana(d, hoy):
                continue
            titulo = lineas[k - 1]
            f = out.setdefault(titulo, pelicula(titulo, f'Colombo Americano, sala {n_sala}',
                                                'el Colombo no lo publica', url, [], confirmado=False))
            f['funciones'] = sorted(set(f['funciones']) | {f'{d.isoformat()} {h}'})
    if not out and 'Programación en la Sala 1' not in texto:
        raise RuntimeError('la página no trae «Programación en la Sala 1»: cambió el formato')
    # El año está en la ficha de cada película; sirve para no confundirla en IMDb.
    cine = sesion.fetch('https://www.colombomedellin.edu.co/cine/', network_idle=True, wait=1000, timeout=90000)
    fichas = sorted({a.attrib['href'] for a in cine.css('a[href*="/peliculas/"]')})
    planos = {plano_py(t): t for t in out}
    for u in fichas:
        fp = sesion.fetch(u, network_idle=True, wait=300, timeout=90000)
        tx = fp.get_all_text(ignore_tags=('script', 'style'))
        anio = re.search(r'Año:\s*(\d{4})', tx)
        h = next((e.text.strip() for e in fp.css('h1, h2') if plano_py(e.text) in planos), None)
        if h:
            p_ = out[planos[plano_py(h)]]
            p_['anio'] = int(anio.group(1)) if anio else None
            p_['poster'] = og_image(fp)
    return list(out.values()), f'{len(out)} películas con función en los próximos {VENTANA} días'


# --- MAMM -------------------------------------------------------------------

def leer_mamm(hoy, sesion):
    p = sesion.fetch('https://www.elmamm.org/cine/', network_idle=True, wait=1500, timeout=90000)
    texto = p.get_all_text(ignore_tags=('script', 'style'))
    original = bool(re.search(r'idioma original subtitulad', texto, re.I))
    fichas = sorted({a.attrib['href'] for a in p.css('a[href*="/producto/"]')
                     if 'entradas-al-museo' not in a.attrib['href']})
    out = []
    for url in fichas:
        f = sesion.fetch(url, network_idle=True, wait=500, timeout=90000)
        form = f.css('form.variations_form')
        if not form:
            continue
        titulo = (f.css('h1')[0].text if f.css('h1') else url.rstrip('/').split('/')[-1]).strip()
        funciones = []
        for v in json.loads(form[0].attrib.get('data-product_variations') or '[]'):
            dh = next(iter(v.get('attributes', {}).values()), '')
            d, h = fecha_es(dh, hoy), hora_24(dh.split('-')[-1])
            if d and h and en_ventana(d, hoy) and v.get('is_in_stock', True):
                funciones.append(f'{d.isoformat()} {h}')
        if funciones:
            # «2026 | Estados Unidos» en la ficha
            anio = re.search(r'\b(19\d\d|20\d\d)\s*\|', f.get_all_text(ignore_tags=('script', 'style')))
            out.append(pelicula(titulo, 'MAMM', 'Subtitulada' if original else 'el MAMM no lo publica',
                                url, funciones, confirmado=original, anio=int(anio.group(1)) if anio else None,
                                poster=og_image(f)))
    return out, f'{len(fichas)} fichas leídas; {len(out)} con función en los próximos {VENTANA} días'


# --- Todo junto -------------------------------------------------------------

CADENAS = [
    ('Procinal (Terminal del Sur)', 'https://www.procinal.com.co/ciudad/medellin', leer_procinal, False),
    ('Cinemark', 'https://www.cinemark.com.co/cartelera/medellin', leer_cinemark, True),
    ('Colombo Americano', 'https://www.colombomedellin.edu.co/programacion-por-salas/', leer_colombo, True),
    ('MAMM (cine)', 'https://www.elmamm.org/cine/', leer_mamm, True),
]


def main():
    seco = '--seco' in sys.argv
    hoy = hoy_medellin()
    previo = json.loads(RUTA.read_text(encoding='utf-8')) if RUTA.exists() else {'cadenas': []}
    previas = {c['nombre']: c for c in previo.get('cadenas', [])}
    cadenas = []

    from scrapling.fetchers import StealthySession
    with StealthySession(headless=True, disable_resources=True) as sesion:
        for nombre, url, leer, navegador in CADENAS:
            try:
                pelis, resumen = leer(hoy, sesion) if navegador else leer(hoy)
                cadenas.append({'nombre': nombre, 'url': url, 'leida': hoy.isoformat(),
                                'estado': f'Leída el {hoy.isoformat()}: {resumen}.', 'peliculas': pelis})
            except Exception as e:  # una sala caída no tumba las demás
                viejo = previas.get(nombre, {})
                cadenas.append({**viejo, 'nombre': nombre, 'url': url, 'peliculas': [],
                                'estado': f'No se pudo leer el {hoy.isoformat()} ({type(e).__name__}: {str(e)[:120]}).'})
            print(f"{nombre}: {cadenas[-1]['estado']}")
            for p in cadenas[-1]['peliculas']:
                print(f"   {p['titulo']} [{p['idioma']}] {p['sede']} · {len(p['funciones'])} funciones")

    if not seco:
        RUTA.write_text(json.dumps({'leido': hoy.isoformat(), 'ventana_dias': VENTANA, 'cadenas': cadenas},
                                   ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Escrito {RUTA}')


if __name__ == '__main__':
    main()
