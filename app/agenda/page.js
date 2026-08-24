import Link from 'next/link';
import { panorama, nocheDe, alternativasDe, nombreDia, fechaLarga, fmtHora } from '../../lib/datos.mjs';
import Avisos from '../Avisos.js';
import Tipo from '../Tipo.js';

export const dynamic = 'force-dynamic';

const VEREDICTO_A_TIPO = {
  'v-lost': 'perdida', 'v-keep': 'recuperable', 'v-tight': 'justo', 'v-free': 'agendada',
  'v-pick': 'comprada',
};
function veredictoATipo(cls) { return VEREDICTO_A_TIPO[cls] ?? 'agendada'; }

export default async function Agenda() {
  let p = null;
  try { p = await panorama(); } catch { p = null; }
  if (!p) {
    return (
      <section className="seccion">
        <h1>Agenda</h1>
        <div className="vacio"><b>Sin datos</b>Corre <code>npm run seed</code> primero.</div>
      </section>
    );
  }

  const fechas = [...new Set(p.funciones.filter(f => f.agendada).map(f => f.fecha))].sort();
  // Falta COMPRAR, que no es lo mismo que faltar el archivo. Una función marcada
  // como comprada cuyo PDF sigue en el correo no va aquí: para eso está el aviso
  // de "sin archivo en el baúl". Mezclarlas infla el costo pendiente.
  const faltantes = p.funciones.filter(f =>
    f.agendada && f.fecha >= p.hoy && f.estado !== 'comprada' &&
    f.boletas.length < f.necesarias);
  const porComprar = faltantes.reduce(
    (s, f) => s + (f.necesarias - f.boletas.length) * (f.precio_dcto ?? f.precio_pleno), 0);

  return (
    <>
      <section className="seccion" style={{ marginTop: 'var(--p5)' }}>
        <h1>{p.festival.nombre}</h1>
        <p className="entradilla">
          {p.funciones.filter(f => f.agendada).length} funciones agendadas · pagado{' '}
          <b className="num">${p.total.toLocaleString('es-CO')}</b>
          {porComprar > 0 && (
            <> · falta comprar <b className="num">${porComprar.toLocaleString('es-CO')}</b></>
          )}
        </p>
      </section>

      {p.avisos.length > 0 && (
        <section className="seccion">
          <h2>Qué revisar</h2>
          <p className="entradilla">
            Cruces entre lo que compraste, lo que dice el volante y lo que falta.
          </p>
          <Avisos avisos={[...p.avisos].sort((a, b) => (a.severidad === 'alto' ? -1 : 1))} />
        </section>
      )}

      {fechas.map(fecha => {
        const noche = nocheDe(p, fecha);
        const otras = alternativasDe(p, fecha);
        const esHoy = fecha === p.hoy;
        return (
          <section className="seccion" key={fecha}>
            <h2 style={{ textTransform: 'capitalize' }}>
              {nombreDia(fecha)} {esHoy && <span style={{ color: 'var(--acento)' }}>· hoy</span>}
            </h2>
            <p className="entradilla num">{fechaLarga(fecha)}</p>
            <ul className="funciones">
              {noche.map(f => (
                <li className="funcion" key={f.id}>
                  <span className="hora num">{fmtHora(f.hora_min)}</span>
                  <span className="obra">
                    {f.obra}
                    {f.compania && <span className="cia">{f.compania}</span>}
                    <span className="cia">
                      {f.sala?.nombre ?? 'Sala por confirmar'}
                      {f.duracion_confirmada ? '' : ` · ${f.duracion_min} min estimados`}
                    </span>
                  </span>
                  <span className="estado">
                    <Tipo
                      t={f.estado}
                      sufijo={f.necesarias > 1 ? `${f.boletas.length}/${f.necesarias}` : ''}
                    />
                  </span>
                  <span className="pie">
                    {f.pagado > 0
                      ? <>Pagado <b className="num">${f.pagado.toLocaleString('es-CO')}</b></>
                      : f.precio_pleno > 0
                        ? <>Vale <span className="num">${f.precio_pleno.toLocaleString('es-CO')}</span>
                          {f.precio_dcto ? <> · con descuento <span className="num">${f.precio_dcto.toLocaleString('es-CO')}</span></> : null}</>
                        : 'Entrada libre'}
                    {f.margen && <> · {f.margen.texto}</>}
                    {' · '}
                    {f.juicio
                      ? <Link href="/bitacora">Ya la registraste</Link>
                      : f.fecha <= p.hoy
                        ? <Link href={`/bitacora?funcion=${f.id}`}>Registrar qué te pareció</Link>
                        : <Link href={`/boletas?funcion=${f.id}`}>Boletas</Link>}
                  </span>
                </li>
              ))}
            </ul>

            {otras.length > 0 && (
              <details style={{ marginTop: 'var(--p3)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--tinta-2)', fontSize: '0.9375rem', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                  Qué más había esa noche ({otras.length})
                </summary>
                <ul className="funciones" style={{ marginTop: 'var(--p2)' }}>
                  {otras.map(o => (
                    <li className="funcion" key={o.id}>
                      <span className="hora num">{fmtHora(o.hora_min)}</span>
                      <span className="obra">
                        {o.obra}
                        <span className="cia">{o.sala?.nombre ?? ''}</span>
                      </span>
                      <span className="estado">
                        <Tipo t={veredictoATipo(o.veredicto.cls)} />
                      </span>
                      <span className="pie">
                        {o.veredicto.txt}
                        {o.veredicto.estimado && ' Depende de una duración estimada.'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}

      {faltantes.length > 0 && (
        <section className="seccion">
          <h2>Pendientes de compra</h2>
          <p className="entradilla">
            En orden de urgencia real: primero lo que se agota, no lo que cuesta más.
          </p>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Función</th><th>Cuándo</th><th>Dónde</th>
                  <th className="num">Faltan</th><th className="num">Costo</th><th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {faltantes.map(f => (
                  <tr key={f.id}>
                    <td>{f.obra}</td>
                    <td className="num">{nombreDia(f.fecha)} {fmtHora(f.hora_min)}</td>
                    <td>{f.sala?.nombre ?? '—'}</td>
                    <td className="num">{f.necesarias - f.boletas.length}</td>
                    <td className="num">
                      ${(((f.precio_dcto ?? f.precio_pleno)) * (f.necesarias - f.boletas.length)).toLocaleString('es-CO')}
                    </td>
                    <td style={{ whiteSpace: 'normal', minWidth: '18ch' }}>{f.nota_boleteria ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
