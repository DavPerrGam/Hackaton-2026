// Etapa 11 del protocolo Nexus: las seis familias de brecha, cada una
// con impacto, riesgo, urgencia y recomendación. Se muestran todas
// (incluidas las que no tienen brecha) porque el valor consultivo está
// tanto en lo que falta como en confirmar lo que ya está resuelto.

const COLOR_URGENCIA = {
  inmediata: 'danger',
  alta: 'warning',
  media: 'info',
  baja: 'success',
};

export default function BrechasPorFamilia({ brechas }) {
  if (!brechas?.length) return null;

  return (
    <div className="d-flex flex-column gap-3">
      {brechas.map((familia) => (
        <div className="ip-card p-4" key={familia.id}>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <h6 className="mb-0">{familia.nombre}</h6>
            <div className="d-flex gap-2">
              <span className={`badge bg-${COLOR_URGENCIA[familia.urgencia] || 'secondary'} text-uppercase`}>
                Urgencia {familia.urgencia}
              </span>
              <span className="ip-badge-nivel">{familia.score}/100</span>
            </div>
          </div>

          {familia.estado === 'sin_brecha' ? (
            <p className="small text-success mb-0">
              <i className="bi bi-check-circle me-1" />
              Sin brecha relevante en este frente.
            </p>
          ) : (
            <>
              {familia.faltantes.length > 0 && (
                <p className="small mb-2">
                  <strong>Falta:</strong> {familia.faltantes.join(', ')}.
                </p>
              )}
              <p className="small text-secondary mb-1"><strong>Impacto:</strong> {familia.impacto}</p>
              <p className="small text-secondary mb-1"><strong>Riesgo:</strong> {familia.riesgo}</p>
              <p className="small mb-0"><strong>Recomendación:</strong> {familia.recomendacion}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
