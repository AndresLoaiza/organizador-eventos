'use client';
import Pantalla from '../Pantalla.js';
import Decisor from './Decisor.js';

export default function Decidir() {
  return <Pantalla>{({ p, recargar }) => <Decisor p={p} recargar={recargar} />}</Pantalla>;
}
