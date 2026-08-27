'use client';
import { useState, useRef } from 'react';
import { subirBoleta } from '../../lib/cliente.mjs';
import { claveBoleta, claveHuerfana } from '../../lib/nombres.mjs';
import { hoyMedellin } from '../../lib/panorama.mjs';

// Captura rápida: se usa de pie, en la taquilla, con una mano. Dos campos y ya.
// La extracción completa ocurre después, en una sesión de Claude Code.

export default function Cargar({ funciones, panorama, alGuardar }) {
  const inputArchivo = useRef(null);
  const [estado, setEstado] = useState({ fase: 'listo' });
  const [funcionId, setFuncionId] = useState('');
  const [valor, setValor] = useState('');

  async function enviar(e) {
    e.preventDefault();
    const archivo = inputArchivo.current?.files?.[0];
    if (!archivo) {
      setEstado({ fase: 'error', msg: 'Escoge una foto o un PDF.' });
      return;
    }
    setEstado({ fase: 'subiendo' });

    try {
      const buffer = await archivo.arrayBuffer();
      const resumen = await crypto.subtle.digest('SHA-256', buffer);
      const hash = [...new Uint8Array(resumen)]
        .map(b => b.toString(16).padStart(2, '0')).join('');

      const f = panorama.funciones.find(x => x.id === funcionId);
      const clave = f
        ? claveBoleta(
            panorama.festival.slug,
            { fecha: f.fecha, hora_min: f.hora_min, obra: f.obra, salaSlug: f.sala_slug },
            hash, archivo.type, archivo.name)
        : claveHuerfana(hash, archivo.type, archivo.name, hoyMedellin());

      const r = await subirBoleta({
        archivo,
        funcionId: funcionId || null,
        festivalId: panorama.festival.id,
        valor: valor ? Number(valor) : null,
        clave,
      });

      setEstado({ fase: 'ok', msg: r.mensaje, repetida: r.repetida });
      if (inputArchivo.current) inputArchivo.current.value = '';
      setValor('');
      alGuardar?.();
    } catch (err) {
      // Perder una boleta por estar sin señal en el lobby es el peor fallo posible.
      setEstado({
        fase: 'error',
        msg: `${err.message} El archivo sigue en tu teléfono: vuelve a intentar cuando haya señal.`,
      });
    }
  }

  return (
    <form onSubmit={enviar} style={{ maxWidth: '34rem' }}>
      <div className="campo">
        <label htmlFor="archivo">Foto de la boleta o PDF</label>
        <input
          ref={inputArchivo} id="archivo" type="file" name="archivo"
          accept="image/*,application/pdf" capture="environment"
          style={{ padding: 'var(--e2)' }}
        />
        <p className="nota">El original se guarda tal cual y no se modifica nunca.</p>
      </div>

      <div className="campo">
        <label htmlFor="funcion">¿De cuál función?</label>
        <select id="funcion" value={funcionId} onChange={e => setFuncionId(e.target.value)}>
          <option value="">Todavía no sé</option>
          {funciones.map(f => <option key={f.id} value={f.id}>{f.etiqueta}</option>)}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="valor">Cuánto pagaste</label>
        <input
          id="valor" type="number" inputMode="numeric" min="0" step="100"
          value={valor} onChange={e => setValor(e.target.value)} placeholder="10900"
        />
        <p className="nota">Aproximado sirve. Se corrige al extraer.</p>
      </div>

      <button className="boton" data-v="primario" type="submit" disabled={estado.fase === 'subiendo'}>
        {estado.fase === 'subiendo' ? 'Guardando…' : 'Guardar en el baúl'}
      </button>

      {estado.msg && (
        <div
          className="aviso"
          data-sev={estado.fase === 'error' ? 'alto' : 'aviso'}
          style={{ marginTop: 'var(--e4)' }}
        >
          <span className="marca" aria-hidden="true">
            {estado.fase === 'error' ? '!' : estado.repetida ? '=' : '✓'}
          </span>
          <span>{estado.msg}</span>
        </div>
      )}
    </form>
  );
}
