'use client';
import { useState } from 'react';
import { guardarJuicio } from '../lib/cliente.mjs';
import { cuandoFue } from '../lib/juicio.mjs';
import { nombreDia } from '../lib/panorama.mjs';
import Estrellas from './Estrellas.js';

// «Anoche viste…»: el juicio en un toque, al abrir la app.
//
// Un toque en una estrella ya guarda. Después aparece el texto, opcional, para
// dictarlo con el teclado del celular. «No fui» también guarda: agendaste, quizá
// pagaste, y no fuiste, y eso cuenta para el cierre del festival. La tarjeta no
// se va sola tras el primer toque, porque el texto viene después; se va al
// guardar el texto o al decir que así está bien.

export default function JuicioRapido({ funcion, hoy, alTerminar }) {
  const [estrellas, setEstrellas] = useState(0);
  const [texto, setTexto] = useState('');
  const [fase, setFase] = useState('pregunta'); // pregunta | texto
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar(datos) {
    setGuardando(true);
    setError(null);
    try {
      await guardarJuicio({ funcion_id: funcion.id, ...datos });
      return true;
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function tocarEstrella(v) {
    setEstrellas(v);
    // Volver a tocar la misma estrella la quita. Eso no se guarda: un juicio
    // sin estrellas ni texto haría desaparecer la tarjeta sin decir nada.
    if (!v) return;
    if (await guardar({ estrellas: v, texto })) setFase('texto');
  }

  async function noFui() {
    if (await guardar({ asistio: false })) alTerminar();
  }

  async function guardarTexto() {
    if (await guardar({ estrellas, texto })) alTerminar();
  }

  const idTexto = `juicio-${funcion.id}`;
  return (
    <article className="juicio-rapido">
      <p className="juicio-pregunta">
        {cuandoFue(funcion.fecha, hoy, nombreDia)} viste <b>{funcion.obra}</b>. ¿Qué tal?
      </p>
      <Estrellas
        valor={estrellas} alCambiar={tocarEstrella} deshabilitado={guardando}
        rotulo={`Estrellas para ${funcion.obra}`}
      />

      {fase === 'pregunta' && (
        <button type="button" className="boton" data-tam="chico" disabled={guardando} onClick={noFui}>
          No fui
        </button>
      )}

      {fase === 'texto' && (
        <div className="campo">
          <label htmlFor={idTexto}>Guardado. Si quieres, en tus palabras (puedes dictarlo)</label>
          <textarea
            id={idTexto} rows={3} value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Qué funcionó, qué no, qué te robas para escena."
          />
          <div className="juicio-acciones">
            <button type="button" className="boton" data-v="primario" disabled={guardando || !texto.trim()} onClick={guardarTexto}>
              {guardando ? 'Guardando…' : 'Guardar el texto'}
            </button>
            <button type="button" className="boton" data-tam="chico" disabled={guardando} onClick={alTerminar}>
              Así está bien
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="aviso" data-sev="alto">
          <span className="marca" aria-hidden="true">!</span><span>{error}</span>
        </div>
      )}
    </article>
  );
}
