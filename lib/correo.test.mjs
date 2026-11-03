import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerCorreo, planBoletas } from './correo.mjs';

// Textos con la estructura real de cada operador, pero inventados: el correo de
// verdad trae el número de documento de Andrés y enlaces personales a cada
// entrada, y el repositorio es público.

const TIQUETERA = {
  id: 'm1', remitente: 'info@latiquetera.com', fecha: '2026-10-29T14:23:46Z',
  asunto: 'Compra en La Tiquetera, referencia 999001',
  texto: `Hola, tu compra fue procesada
   Entradas digitales
 - Pato, Muerte y Tulipán - Nov 7 - GENERAL - Acceder a la
entrada
<https://latiquetera.com/site/x/event_date_seats/print_digital_ticket/AAA/1/aaa>
  - Pato, Muerte y Tulipán - Nov 7 - GENERAL - Acceder a la
entrada
<https://latiquetera.com/site/x/event_date_seats/print_digital_ticket/BBB/1/bbb>
Gracias por tu compra para Pato, Muerte y Tulipán

 Entrada digital
 - (Un) Ensayo sobre la Ceguera - Nov 6 - GENERAL - Acceder a la entrada
<https://latiquetera.com/site/x/event_date_seats/print_digital_ticket/CCC/2/ccc>
Gracias por tu compra`,
};

const ETICKETA = {
  id: 'm2', remitente: 'info@eticketablanca.com', fecha: '2026-08-20T04:54:26Z',
  asunto: 'Tus tickets para KRAPP, LA ÚLTIMA CINTA',
  texto: `| ## Tus tickets |
| GENERAL |
| Ver tickets [](https://vivenu.com/ticket/aaa/111) |

| COMFAMA TARIFA A |
| Ver tickets [](https://vivenu.com/ticket/bbb/222) |

| ## Evento |
| | KRAPP, LA ÚLTIMA CINTA 24/08/2026 20:00 -05 TEATRO OFICINA CENTRAL DE LOS SUEÑOS CRA 43 # 52-50 Medellín |`,
};

test('La Tiquetera: una entrada por línea, con obra, fecha y categoría; el año sale del correo', () => {
  const e = leerCorreo(TIQUETERA);
  assert.equal(e.length, 3);
  assert.deepEqual(e[0], {
    correo: 'm1', operador: 'La Tiquetera · ref 999001', obra: 'Pato, Muerte y Tulipán',
    fecha: '2026-11-07', hora_min: null, categoria: 'GENERAL',
    url: 'https://latiquetera.com/site/x/event_date_seats/print_digital_ticket/AAA/1/aaa',
  });
  assert.equal(e[2].obra, '(Un) Ensayo sobre la Ceguera');
  assert.equal(e[2].fecha, '2026-11-06');
});

test('eTicketaBlanca: la obra sale del asunto, fecha y hora del bloque del evento', () => {
  const e = leerCorreo(ETICKETA);
  assert.equal(e.length, 2);
  assert.equal(e[0].obra, 'KRAPP, LA ÚLTIMA CINTA');
  assert.equal(e[0].fecha, '2026-08-24');
  assert.equal(e[0].hora_min, 1200);
  assert.deepEqual(e.map(x => x.categoria), ['GENERAL', 'COMFAMA TARIFA A']);
  assert.equal(e[1].url, 'https://vivenu.com/ticket/bbb/222');
  assert.equal(e[0].operador, 'eTicketaBlanca');
});

test('un remitente que no es de boletas no produce nada', () => {
  assert.deepEqual(leerCorreo({ ...TIQUETERA, remitente: 'noticias@otro.com' }), []);
});

test('una compra en diciembre para enero cae en el año siguiente', () => {
  const e = leerCorreo({ ...TIQUETERA, fecha: '2026-12-20T10:00:00Z',
    texto: ' - Obra - Jan 9 - GENERAL - Acceder a la entrada\n<https://latiquetera.com/t/1>' });
  assert.equal(e[0].fecha, '2027-01-09');
});

// --- Plan --------------------------------------------------------------------
const F = (id, obra, fecha, hora_min = 1200) => ({ id, obra, fecha, hora_min, festival_id: 'fest' });
const funciones = [
  F('pato', 'Pato, muerte y tulipán', '2026-11-07', 1050),
  F('ceguera', '(Un) Ensayo sobre la ceguera', '2026-11-06', 1200),
  F('doble1', 'Doble', '2026-11-05', 900), F('doble2', 'Doble', '2026-11-05', 1200),
];

test('se aplica sola la entrada cuya obra y fecha casan con una sola función', () => {
  const p = planBoletas(leerCorreo(TIQUETERA), funciones, []);
  assert.deepEqual(p.nuevas.map(n => n.funcion_id), ['pato', 'pato', 'ceguera']);
  assert.equal(p.ya.length, 0);
  assert.equal(p.dudosas.length, 0);
});

test('una entrada ya cargada (mismo enlace) no se duplica', () => {
  const ya = [{ url_entrada: 'https://latiquetera.com/site/x/event_date_seats/print_digital_ticket/AAA/1/aaa' }];
  const p = planBoletas(leerCorreo(TIQUETERA), funciones, ya);
  assert.equal(p.ya.length, 1);
  assert.equal(p.nuevas.length, 2);
});

test('dos funciones de la misma obra el mismo día sin hora en el correo: se pregunta', () => {
  const e = [{ correo: 'm', operador: 'X', obra: 'Doble', fecha: '2026-11-05', hora_min: null, categoria: 'G', url: 'u1' }];
  const p = planBoletas(e, funciones, []);
  assert.equal(p.dudosas.length, 1);
  assert.deepEqual(p.dudosas[0].candidatas.sort(), ['doble1', 'doble2']);
});

test('con hora en el correo, la doble función se resuelve', () => {
  const e = [{ correo: 'm', operador: 'X', obra: 'Doble', fecha: '2026-11-05', hora_min: 1200, categoria: 'G', url: 'u1' }];
  assert.deepEqual(planBoletas(e, funciones, []).nuevas.map(n => n.funcion_id), ['doble2']);
});

test('una obra que no está en el festival se ignora, no se pregunta', () => {
  const e = [{ correo: 'm', operador: 'X', obra: 'EL CLOWNJURO', fecha: '2026-10-31', hora_min: 1380, categoria: 'G', url: 'u9' }];
  const p = planBoletas(e, funciones, []);
  assert.equal(p.ignoradas.length, 1);
  assert.equal(p.dudosas.length, 0);
});

test('doble función sin hora: si solo una de las dos está agendada, es esa', () => {
  // La Tiquetera no dice la hora. Uno compra la función que agendó: si de las
  // candidatas exactamente una está en la agenda, se resuelve por ahí y se dice.
  const fs = [{ ...funciones[2], agendada: false }, { ...funciones[3], agendada: true }];
  const e = [{ correo: 'm', operador: 'X', obra: 'Doble', fecha: '2026-11-05', hora_min: null, categoria: 'G', url: 'u1' }];
  const p = planBoletas(e, fs, []);
  assert.deepEqual(p.nuevas.map(n => [n.funcion_id, n.por]), [['doble2', 'agenda']]);
});

test('si las dos están agendadas (o ninguna), se sigue preguntando', () => {
  const e = [{ correo: 'm', operador: 'X', obra: 'Doble', fecha: '2026-11-05', hora_min: null, categoria: 'G', url: 'u1' }];
  const ambas = [{ ...funciones[2], agendada: true }, { ...funciones[3], agendada: true }];
  assert.equal(planBoletas(e, ambas, []).dudosas.length, 1);
});
