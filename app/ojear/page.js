'use client';
import Pantalla from '../Pantalla.js';
import Ojeo from './Ojeo.js';

export default function Ojear() {
  return <Pantalla>{({ p, recargar }) => <Ojeo p={p} recargar={recargar} />}</Pantalla>;
}
