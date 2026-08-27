'use client';
import { useState } from 'react';
import { guardarCodigo, codigoSirve } from '../lib/cliente.mjs';

// El código no está en el bundle: Andrés lo escribe una vez por dispositivo y
// queda en el navegador. Va en cada consulta como cabecera y Postgres lo
// verifica con RLS, así que un código equivocado no devuelve un error de
// pantalla: devuelve cero filas.

export default function Puerta({ alEntrar }) {
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState({ fase: 'listo' });

  async function entrar(e) {
    e.preventDefault();
    setEstado({ fase: 'probando' });
    if (await codigoSirve(codigo.trim())) {
      guardarCodigo(codigo.trim());
      alEntrar?.();
    } else {
      setEstado({ fase: 'error', msg: 'Ese código no abre nada.' });
    }
  }

  return (
    <section className="seccion" style={{ maxWidth: '26rem' }}>
      <h1>Canovaccio</h1>
      <p className="entradilla">Escribe el código una vez. Queda guardado en este teléfono.</p>
      <form onSubmit={entrar}>
        <div className="campo">
          <label htmlFor="codigo">Código de acceso</label>
          <input
            id="codigo" type="password" value={codigo} autoComplete="current-password"
            onChange={e => setCodigo(e.target.value)} placeholder="••••••••"
          />
        </div>
        <button className="boton" data-v="primario" type="submit" disabled={estado.fase === 'probando'}>
          {estado.fase === 'probando' ? 'Probando…' : 'Entrar'}
        </button>
        {estado.msg && (
          <div className="aviso" data-sev="alto" style={{ marginTop: 'var(--e4)' }}>
            <span className="marca" aria-hidden="true">!</span><span>{estado.msg}</span>
          </div>
        )}
      </form>
    </section>
  );
}
