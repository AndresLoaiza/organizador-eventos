"""python -m unittest scripts/test_salas.py  (no necesita scrapling)"""
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from salas import fecha_es, hora_24, en_ventana, plano_py, recortar  # noqa: E402


class Salas(unittest.TestCase):
    def test_fecha_es(self):
        hoy = date(2026, 11, 9)
        self.assertEqual(fecha_es('noviembre 10', hoy), date(2026, 11, 10))
        self.assertEqual(fecha_es('2 noviembre, lunes - 1:20 p.m.', hoy), date(2026, 11, 2))
        # Enero visto desde diciembre es el año siguiente.
        self.assertEqual(fecha_es('enero 3', date(2026, 12, 28)), date(2027, 1, 3))
        self.assertIsNone(fecha_es('sin fecha', hoy))

    def test_hora_24(self):
        self.assertEqual(hora_24(' 7:15 pm'), '19:15')
        self.assertEqual(hora_24('1:20 p.m.'), '13:20')
        self.assertEqual(hora_24('12:30 am'), '00:30')
        self.assertEqual(hora_24('21:20:00'), '21:20')

    def test_ventana_y_plano(self):
        hoy = date(2026, 11, 9)
        self.assertTrue(en_ventana(date(2026, 11, 16), hoy))
        self.assertFalse(en_ventana(date(2026, 11, 17), hoy))
        self.assertFalse(en_ventana(date(2026, 11, 8), hoy))
        self.assertEqual(plano_py('Resurrección: Bi Gan'), 'resurreccion bi gan')

    def test_recortar_preventa(self):
        hoy = date(2026, 11, 10)
        # Con función esta semana, la preventa lejana no cuenta.
        self.assertEqual(recortar(['2026-11-12 18:00', '2026-12-17 19:00'], hoy), ['2026-11-12 18:00'])
        # Sin función esta semana es preventa: sus días a la venta, hasta 60.
        self.assertEqual(recortar(['2026-12-17 19:00', '2027-02-01 19:00'], hoy), ['2026-12-17 19:00'])
        self.assertEqual(recortar(['2026-11-01 19:00'], hoy), [])


if __name__ == '__main__':
    unittest.main()
