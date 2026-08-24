'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Captura rápida: se usa de pie, en la taquilla, con una mano. Dos campos y ya.
// La extracción completa ocurre después, en una sesión de Claude Code.

export default function Cargar({ funciones, funcionInicial, festivalId }) {
  const router = useRouter();
  const inputArchivo = useRef(null);
  const [estado, setEstado] = useState({ fase: 'listo' });
  const [funcionId, setFuncionId] = useState(funcionInicial ?? '');
  const [valor, setValor] = useState('');

  async function enviar(e) {
    e.preventDefault();
    const archivo = inputArchivo.current?.files?.[0];
    if (!archivo) {
      setEstado({ fase: 'error', msg: 'Escoge una foto o un PDF.' });
      return;
    }
    setEstado({ fase: 'subiendo' });

    const form = new FormData();
    form.append('archivo', archivo);
    if (funcionId) form.append('funcion_id', funcionId);
    if (festivalId) form.append('festival_id', festivalId);
    if (valor) form.append('valor_ticket', String(Number(valor)));

    try {
      const r = await fetch('/api/upload', { method: 'POST', body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Falló la subida.');
      setEstado({ fase: 'ok', msg: j.mensaje, repetida: j.repetida });
      if (inputArchivo.current) inputArchivo.current.value = '';
      setValor('');
      router.refresh();
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
          ref={inputArchivo}
          id="archivo"
          type="file"
          name="archivo"
          accept="image/*,application/pdf"
          capture="environment"
          style={{ padding: 'var(--p2)' }}
        />
        <p className="nota">El original se guarda tal cual y no se modifica nunca.</p>
      </div>

      <div className="campo">
        <label htmlFor="funcion">¿De cuál función?</label>
        <select id="funcion" value={funcionId} onChange={e => setFuncionId(e.target.value)}>
          <option value="">Todavía no sé</option>
          {funciones.map(f => (
            <option key={f.id} value={f.id}>
              {f.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="valor">Cuánto pagaste</label>
        <input
          id="valor" type="number" inputMode="numeric" min="0" step="100"
          value={valor} onChange={e => setValor(e.target.value)}
          placeholder="10900"
        />
        <p className="nota">Aproximado sirve. Se corrige al extraer.</p>
      </div>

      <button className="boton" data-v="primario" type="submit" disabled={estado.fase === 'subiendo'}>
        {estado.fase === 'subiendo' ? 'Guardando…' : 'Guardar en el baúl'}
      </button>

      {estado.msg && (
        <div className="aviso" data-sev={estado.fase === 'error' ? 'alto' : 'aviso'} style={{ marginTop: 'var(--p4)' }}>
          <span className="marca" aria-hidden="true">{estado.fase === 'error' ? '!' : estado.repetida ? '=' : '✓'}</span>
          <span>{estado.msg}</span>
        </div>
      )}
    </form>
  );
}
