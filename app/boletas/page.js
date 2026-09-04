'use client';
import { nombreDia, fmtHora } from '../../lib/panorama.mjs';
import Avisos from '../Avisos.js';
import Cargar from './Cargar.js';
import Pantalla from '../Pantalla.js';
import Margen, { Cabecera, Friso } from '../Margen.js';
import BotonBoleta from '../BotonBoleta.js';

export default function Baul() {
  return <Pantalla>{({ p, recargar }) => <Cuerpo p={p} recargar={recargar} />}</Pantalla>;
}

const INSTRUCCIONES = [
  'npm run boletas:pendientes   # baja los archivos sin extraer a trabajo/',
  '# Claude los lee, cuenta cuántas boletas trae cada uno,',
  '# y escribe trabajo/extraido.json',
  'npm run boletas:aplicar      # guarda las boletas en la base',
].join('\n');

function Cuerpo({ p, recargar }) {
  const funciones = p.funciones.filter(f => f.agendada).map(f => ({
    id: f.id,
    etiqueta: `${nombreDia(f.fecha)} ${fmtHora(f.hora_min)} · ${f.obra} (${f.boletas.length}/${f.necesarias})`,
  }));

  // Lo pendiente se cuenta por archivo, no por boleta: un PDF con dos entradas
  // es una sola extracción.
  const pendientes = [...new Set(
    p.boletas.filter(b => b.extraccion_estado === 'pendiente').map(b => b.archivo_id))];
  const archivos = new Set(p.boletas.map(b => b.archivo_id).filter(Boolean));
  const huerfanas = p.boletas.filter(b => !b.funcion_id);
  const porFuncion = new Map(p.funciones.map(f => [f.id, f]));

  return (
    <>
      <Cabecera mascara="moretta" titulo="Baúl">
        {p.boletas.length} boletas en {archivos.size} archivos · {pendientes.length} sin extraer
        {huerfanas.length > 0 && <> · {huerfanas.length} sin vincular</>}
      </Cabecera>

      <section className="seccion">
        <h2>Guardar una boleta</h2>
        <p className="entradilla">
          Sirve para la foto del papel de taquilla, la captura del correo o el PDF de la boletería.
        </p>
        <Cargar funciones={funciones} panorama={p} alGuardar={recargar} />
      </section>

      {huerfanas.length > 0 && (
        <section className="seccion">
          <Avisos titulo="Sin vincular" avisos={p.avisos.filter(a => a.tipo === 'boleta_huerfana')} />
        </section>
      )}

      <Friso />

      <section className="seccion">
        <h2>Lo que hay dentro</h2>
        {p.boletas.length === 0 ? (
          <div className="vacio">
            <b>El baúl está vacío</b>
            Sube la primera boleta arriba. Si ya compraste por internet, el PDF está en tu correo.
            <Margen tipo="pantalone" tam="medio" />
          </div>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Función</th><th>Cuándo</th><th>Categoría</th>
                  <th className="num">Ticket</th><th className="num">Servicio</th>
                  <th>Titular</th><th>Código</th><th className="num">Pág.</th><th>Extracción</th><th>Archivo</th>
                </tr>
              </thead>
              <tbody>
                {p.boletas.map(b => {
                  const f = porFuncion.get(b.funcion_id);
                  return (
                    <tr key={b.id}>
                      <td>{f?.obra ?? <em>sin vincular</em>}</td>
                      <td className="num">{f ? `${nombreDia(f.fecha)} ${fmtHora(f.hora_min)}` : '—'}</td>
                      <td>{b.categoria ?? '—'}</td>
                      <td className="num">
                        {b.valor_ticket == null ? '—' : `$${b.valor_ticket.toLocaleString('es-CO')}`}
                      </td>
                      <td className="num">
                        {b.valor_servicio ? `$${b.valor_servicio.toLocaleString('es-CO')}` : '—'}
                      </td>
                      <td>{b.titular ?? '—'}</td>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem' }}>
                        {b.codigo ?? '—'}
                      </td>
                      <td className="num">{b.pagina ?? '—'}</td>
                      <td>{b.extraccion_estado ?? '—'}</td>
                      <td><BotonBoleta boleta={b} etiqueta="Abrir" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pendientes.length > 0 && (
        <section className="seccion">
          <h2>Cómo se completan las pendientes</h2>
          <p className="entradilla">
            Quedan {pendientes.length} archivos sin extraer. En una sesión de Claude Code,
            sobre este proyecto:
          </p>
          <pre>{INSTRUCCIONES}</pre>
        </section>
      )}
    </>
  );
}
