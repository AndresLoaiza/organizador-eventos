const MARCA = {
  hora_discordante: '≠',
  cruce_franja: '✕',
  boletas_insuficientes: '½',
  agendada_vencida: '!',
  boleta_huerfana: '?',
  duracion_estimada: '~',
};

export default function Avisos({ avisos, titulo }) {
  if (!avisos?.length) return null;
  return (
    <>
      {titulo && <h2>{titulo}</h2>}
      <div>
        {avisos.map((a, i) => (
          <div className="aviso" data-sev={a.severidad} key={a.id ?? i}>
            <span className="marca" aria-hidden="true">{MARCA[a.tipo] ?? '·'}</span>
            <span>{a.mensaje}</span>
          </div>
        ))}
      </div>
    </>
  );
}
