'use client';
import Link from 'next/link';
import { nocheDe, alternativasDe, nombreDia, fechaLarga, fmtHora } from '../../lib/panorama.mjs';
import Avisos from '../Avisos.js';
import Tipo, { tipoDeVeredicto } from '../Tipo.js';
import Pantalla from '../Pantalla.js';
import Exportar from '../Exportar.js';
import Margen, { Cabecera, Friso } from '../Margen.js';
import { costoPendiente, textoPrecio, precioDe, pesos } from '../../lib/precios.mjs';
import { filasAgenda, COLS_AGENDA } from '../../lib/exportar.mjs';

export default function Agenda() {
  return <Pantalla>{({ p }) => <Cuerpo p={p} />}</Pantalla>;
}



function Cuerpo({ p }) {
  const fechas = [...new Set(p.funciones.filter(f => f.agendada).map(f => f.fecha))].sort();
  // Falta COMPRAR, que no es lo mismo que faltar el archivo. Una función marcada
  // como comprada cuyo PDF sigue en el correo no va aquí: para eso está el aviso
  // de "sin archivo en el baúl". Mezclarlas infla el costo pendiente.
  const faltantes = p.funciones.filter(f =>
    f.agendada && f.fecha >= p.hoy && f.estado !== 'comprada' &&
    f.boletas.length < f.necesarias);
  // El total ignora lo que no tiene tarifa publicada, y por eso hay que decir
  // cuántas quedaron fuera: un total que se lee como el costo del plan entero
  // cuando en realidad le faltan ocho funciones es peor que no dar total.
  const { total: porComprar, sinPrecio } = costoPendiente(faltantes);

  return (
    <>
      <Cabecera mascara="volto" titulo={p.festival.nombre}>
          {p.funciones.filter(f => f.agendada).length} funciones agendadas · pagado{' '}
          <b className="num">${p.total.toLocaleString('es-CO')}</b>
          {porComprar > 0 && (
            <> · falta comprar <b className="num">{pesos(porComprar)}</b></>
          )}
          {sinPrecio > 0 && (
            <> · {sinPrecio} sin tarifa publicada, fuera de esa cuenta</>
          )}
      </Cabecera>

      <Exportar cols={COLS_AGENDA} filas={filasAgenda(p.funciones)} que="la agenda" />

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
                    {f.imagen_url && (
                      <img className="miniatura" src={f.imagen_url} alt="" loading="lazy" decoding="async" />
                    )}
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
                    {(() => {
                      const t = textoPrecio(f);
                      if (!t.valor) return t.etiqueta;
                      return (
                        <>
                          {t.etiqueta} <b className="num">{t.valor}</b>
                          {t.descuento && <> · con descuento <span className="num">{t.descuento}</span></>}
                        </>
                      );
                    })()}
                    {f.margen && <> · {f.margen.texto}</>}
                    {' · '}
                    {f.juicio
                      ? <Link href="/bitacora">Ya la registraste</Link>
                      : f.fecha <= p.hoy
                        ? <Link href="/bitacora">Registrar qué te pareció</Link>
                        : <Link href="/boletas">Boletas</Link>}
                  </span>
                </li>
              ))}
            </ul>

            {otras.length > 0 && (
              <details style={{ marginTop: 'var(--e3)' }}>
                <summary>Qué más había esa noche ({otras.length})</summary>
                <ul className="funciones" style={{ marginTop: 'var(--e2)' }}>
                  {otras.map(o => (
                    <li className="funcion" key={o.id}>
                      <span className="hora num">{fmtHora(o.hora_min)}</span>
                      <span className="obra">
                        {o.obra}
                        <span className="cia">{o.sala?.nombre ?? ''}</span>
                      </span>
                      <span className="estado">
                        <Tipo t={tipoDeVeredicto(o.veredicto)} />
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
          <Friso />
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
                      {precioDe(f) == null
                        ? <span title="El organizador no la publicó">sin publicar</span>
                        : pesos(precioDe(f) * (f.necesarias - f.boletas.length))}
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
