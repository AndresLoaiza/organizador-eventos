'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// El texto primero y las estrellas después, en ese orden, porque en ese orden
// pesan. Un párrafo en sus palabras dice qué recomendarle el año que viene;
// un 3 sobre 5 no dice nada.

export default function Registrar({ funciones, funcionInicial }) {
  const router = useRouter();
  const [funcionId, setFuncionId] = useState(funcionInicial ?? funciones[0]?.id ?? '');
  const actual = funciones.find(f => f.id === funcionId);
  const [texto, setTexto] = useState(actual?.juicio?.texto ?? '');
  const [estrellas, setEstrellas] = useState(actual?.juicio?.estrellas ?? 0);
  const [estado, setEstado] = useState({ fase: 'listo' });

  function cambiarFuncion(id) {
    setFuncionId(id);
    const f = funciones.find(x => x.id === id);
    setTexto(f?.juicio?.texto ?? '');
    setEstrellas(f?.juicio?.estrellas ?? 0);
    setEstado({ fase: 'listo' });
  }

  async function enviar(e) {
    e.preventDefault();
    setEstado({ fase: 'guardando' });
    try {
      const r = await fetch('/api/bitacora', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ funcion_id: funcionId, texto, estrellas: estrellas || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar.');
      setEstado({
        fase: 'ok',
        msg: `${j.actualizada ? 'Actualizado' : 'Guardado'}. Corre npm run obsidian:sync para llevarlo al perfil.`,
      });
      router.refresh();
    } catch (err) {
      setEstado({ fase: 'error', msg: err.message });
    }
  }

  if (!funciones.length) {
    return (
      <div className="vacio">
        <b>Todavía no hay nada que juzgar</b>
        Cuando pase la primera función, aparece aquí para que la registres el mismo día,
        mientras está fresca.
      </div>
    );
  }

  return (
    <form onSubmit={enviar} style={{ maxWidth: '38rem' }}>
      <div className="campo">
        <label htmlFor="funcion">Función</label>
        <select id="funcion" value={funcionId} onChange={e => cambiarFuncion(e.target.value)}>
          {funciones.map(f => (
            <option key={f.id} value={f.id}>
              {f.etiqueta}{f.juicio ? ' · ya registrada' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label htmlFor="texto">Qué te pareció</label>
        <textarea
          id="texto" value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="En tus palabras. Qué funcionó, qué no, qué te robas para escena."
          required
        />
        <p className="nota">Esto es lo que hace mejor la recomendación del próximo festival.</p>
      </div>

      <div className="campo">
        <label id="rot-estrellas">Estrellas</label>
        <div className="estrellas" role="group" aria-labelledby="rot-estrellas">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n} type="button"
              aria-pressed={estrellas >= n}
              aria-label={`${n} de 5`}
              className={estrellas >= n ? 'activa' : ''}
              onClick={() => setEstrellas(estrellas === n ? 0 : n)}
            >
              {estrellas >= n ? '★' : '☆'}
            </button>
          ))}
        </div>
        <p className="nota">Opcional. Sirve para ordenar, no para explicar.</p>
      </div>

      <button className="boton" data-v="primario" type="submit" disabled={estado.fase === 'guardando'}>
        {estado.fase === 'guardando' ? 'Guardando…' : 'Guardar en la bitácora'}
      </button>

      {estado.msg && (
        <div className="aviso" data-sev={estado.fase === 'error' ? 'alto' : 'aviso'} style={{ marginTop: 'var(--p4)' }}>
          <span className="marca" aria-hidden="true">{estado.fase === 'error' ? '!' : '✓'}</span>
          <span>{estado.msg}</span>
        </div>
      )}
    </form>
  );
}
