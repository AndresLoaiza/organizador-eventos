const MARCA = {
  comprada: '✓', agendada: '○', vencida: '!', no_alcanzada: '✕',
  perdida: '✕', recuperable: '↻', justo: '!',
};
const ROTULO = {
  comprada: 'Comprada', agendada: 'Agendada', vencida: 'Vencida',
  no_alcanzada: 'No alcanzada', perdida: 'Perdida',
  recuperable: 'Recuperable', justo: 'Justo',
};

// Tipo fijo: la marca manda, el color acompaña. A las siete de la noche en la
// calle el color es lo primero que se pierde.
export default function Tipo({ t, sufijo }) {
  return (
    <span className="tipo" data-t={t}>
      <span className="marca" aria-hidden="true">{MARCA[t] ?? '·'}</span>
      {ROTULO[t] ?? t}{sufijo ? ` ${sufijo}` : ''}
    </span>
  );
}
