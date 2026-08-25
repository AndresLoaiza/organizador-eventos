const MARCA = {
  comprada: '✓', agendada: '○', vencida: '!', no_alcanzada: '✕',
  perdida: '✕', recuperable: '↻', justo: '!', cuesta: '⚠',
  compatible: '+', desplaza: '↔', libre: '·',
};
const ROTULO = {
  comprada: 'Comprada', agendada: 'Agendada', vencida: 'Vencida',
  no_alcanzada: 'No alcanzada', perdida: 'Perdida', recuperable: 'Recuperable',
  justo: 'Justo', cuesta: 'Cuesta', compatible: 'Compatible',
  desplaza: 'Desplaza', libre: 'Libre',
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

// El veredicto del motor trae clase Y marca, y no significan lo mismo. Para una
// función NO elegida, la clase v-lost aparece en dos casos distintos: la obra
// está perdida (marca ✕), o elegirla te haría perder otra (marca ⚠). Mapear por
// clase decía "Perdida" sobre obras que se podían ver perfectamente.
const POR_MARCA = {
  '✕': 'perdida', '⚠': 'cuesta', '↻': 'recuperable', '!': 'justo',
  '+': 'compatible', '↔': 'desplaza', '·': 'libre', '✓': 'comprada',
};

export function tipoDeVeredicto(v) {
  return POR_MARCA[v?.ic] ?? 'libre';
}
