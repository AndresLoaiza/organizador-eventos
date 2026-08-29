'use client';
import Tipo, { tipoDeVeredicto } from './Tipo.js';

// El veredicto, en piezas.
//
// El motor ya devolvía una frase correcta, pero en la Fiesta del Libro hay
// noches con ocho funciones a la misma hora y esa frase salía con ocho títulos
// encadenados por comas. Nadie lee eso caminando hacia una sala. Aquí la misma
// información va en lista, y cada renglón dice por qué esa función se cae:
// porque se cruza, o porque no alcanza el traslado.

function Lista({ titulo, cosas, marca }) {
  if (!cosas?.length) return null;
  return (
    <div className="cae">
      <p className="cae-titulo">{titulo}</p>
      <ul>
        {cosas.map((c, i) => (
          <li key={`${c.titulo}-${i}`}>
            <span className="cae-marca" aria-hidden="true">{marca}</span>
            <span>
              <b>{c.titulo}</b>
              <span className="cae-donde">
                {' '}· {c.hora}{c.sala ? ` · ${c.sala}` : ''}
              </span>
              <span className="cae-motivo">{c.motivo}</span>
              {c.vuelve?.length > 0 && (
                <span className="cae-rescate">Vuelve el {c.vuelve.join(' o el ')}.</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Veredicto({ v, agendada }) {
  // La frase del motor se queda: dice el veredicto en una línea. Lo que se
  // reparte en lista es el detalle, que es lo que se volvía ilegible.
  return (
    <>
      <span className="pie">
        <Tipo t={agendada ? 'comprada' : tipoDeVeredicto(v)} />{' '}
        {v.txt}
        {v.estimado && ' Depende de una duración estimada.'}
      </span>
      <Lista titulo="Choca con" cosas={v.choques} marca="✕" />
      <Lista titulo="Pierdes definitivamente" cosas={v.pierde} marca="✕" />
      <Lista titulo="Se mueven a otra fecha" cosas={v.desplaza} marca="↔" />
      <Lista titulo="Encadenas justo con" cosas={v.justos} marca="!" />
    </>
  );
}
