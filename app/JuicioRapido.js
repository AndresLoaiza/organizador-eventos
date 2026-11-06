'use client';
import { useState } from 'react';
import { guardarJuicio } from '../lib/cliente.mjs';
import { cuandoFue } from '../lib/juicio.mjs';
import { nombreDia } from '../lib/panorama.mjs';
import Estrellas from './Estrellas.js';

// «Anoche viste…»: el juicio al abrir la app.
//
// Estrellas y, si quieres, el texto (dictable con el teclado del celular); un
// solo «Guardar» los lleva juntos. «No fui» también guarda: agendaste, quizá
// pagaste, y no fuiste, y eso cuenta para el cierre del festival.

export default function JuicioRapido({ funcion, hoy, alTerminar }) {
  const [estrellas, setEstrellas] = useState(0);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Un solo «Guardar»: estrellas y texto viajan juntos. Antes una estrella se
  // guardaba al tocarla y el texto pedía un segundo botón.
  async function guardar(datos) {
    setGuardando(true);
    setError(null);
    try {
      await guardarJuicio({ funcion_id: funcion.id, ...datos });
      alTerminar();
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  }

  const idTexto = `juicio-${funcion.id}`;
  return (
    <article className="juicio-rapido">
      <p className="juicio-pregunta">
        {cuandoFue(funcion.fecha, hoy, nombreDia)} viste <b>{funcion.obra}</b>. ¿Qué tal?
      </p>
      <Estrellas
        valor={estrellas} alCambiar={setEstrellas} deshabilitado={guardando}
        rotulo={`Estrellas para ${funcion.obra}`}
      />
      <div className="campo">
        <label htmlFor={idTexto}>En tus palabras, si quieres (puedes dictarlo)</label>
        <textarea
          id={idTexto} rows={3} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Qué funcionó, qué no, qué te robas para escena."
        />
      </div>
      <div className="juicio-acciones">
        <button type="button" className="boton" data-v="primario"
                disabled={guardando || (!estrellas && !texto.trim())}
                onClick={() => guardar({ estrellas, texto })}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="boton" data-tam="chico" disabled={guardando}
                onClick={() => guardar({ asistio: false })}>
          No fui
        </button>
      </div>

      {error && (
        <div className="aviso" data-sev="alto">
          <span className="marca" aria-hidden="true">!</span><span>{error}</span>
        </div>
      )}
    </article>
  );
}
