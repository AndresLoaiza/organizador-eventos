# -*- coding: utf-8 -*-
"""Baja la foto de cada obra del Festival San Ignacio.

Guia visual: en un festival de 29 espectaculos el titulo solo no dice nada, y
la foto de la obra decide mas rapido que la ficha. Se guardan en disco porque
las URL de Comfama son de un proxy de Gatsby con parametros de tamano y firma:
sirven hoy, no necesariamente en dos meses.

Se piden al original de Contentful y no al proxy de Gatsby, que va firmado. No
se gana resolucion: el activo subido a Contentful es de 381x261 y pedirle mas
ancho devuelve lo mismo. Es todo lo que Comfama publica.
"""
import io, json, os, re, subprocess, unicodedata, urllib.parse

FUENTE = 'trabajo/sanignacio/funciones.json'
DESTINO = 'trabajo/sanignacio/imagenes'


def slug(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s[:60]


def original(url):
    """URL del activo en Contentful, que el proxy lleva dentro en `u`.

    Comprobado: el activo mide 381x261 y pedirle w=1200 devuelve 381x261
    igual. No hay mas resolucion que sacar.
    """
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    fuente = q.get('u', [None])[0]
    if not fuente:
        return url
    return original


os.makedirs(DESTINO, exist_ok=True)
funciones = json.load(io.open(FUENTE, encoding='utf-8'))

# Una obra con dos funciones tiene la misma foto: se baja una sola vez.
porObra = {}
for f in funciones:
    porObra.setdefault(f['obra'], f['imagen'])

fallos = []
for obra, url in sorted(porObra.items()):
    destino = '%s/%s.webp' % (DESTINO, slug(obra))
    if os.path.exists(destino) and os.path.getsize(destino) > 2000:
        continue
    # Se baja con curl y no con urllib: en esta maquina Python rechaza la
    # cadena de certificados de Comfama y curl, que usa el almacen del sistema,
    # no. Desactivar la verificacion seria la salida facil y la equivocada.
    r = subprocess.run(['curl', '-sS', '--fail', '-A', 'Mozilla/5.0',
                        original(url), '-o', destino], capture_output=True)
    if r.returncode or not os.path.exists(destino) or os.path.getsize(destino) < 2000:
        fallos.append((obra, (r.stderr.decode('utf-8', 'replace') or 'archivo vacio')[:70]))
        if os.path.exists(destino):
            os.remove(destino)

hechas = [n for n in os.listdir(DESTINO) if n.endswith('.webp')]
print('obras:', len(porObra), ' imagenes en disco:', len(hechas))
print('peso total: %d KB' % (sum(os.path.getsize(DESTINO + '/' + n) for n in hechas) // 1024))
for o, e in fallos:
    print('  FALLO', o, '->', e)
