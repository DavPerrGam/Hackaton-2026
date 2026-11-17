// Etapa 2 del protocolo Nexus. El estado de elegibilidad es lo primero
// que la organización debe ver: define si puede competir hoy o no, y
// por eso se muestra antes que cualquier puntaje.

const ESTILO = {
  elegible: { clase: 'success', icono: 'bi-check-circle-fill', titulo: 'Elegible' },
  riesgo: { clase: 'warning', icono: 'bi-exclamation-triangle-fill', titulo: 'Riesgo de elegibilidad' },
  no_elegible: { clase: 'danger', icono: 'bi-x-circle-fill', titulo: 'No elegible' },
  en_revision: { clase: 'secondary', icono: 'bi-hourglass-split', titulo: 'En revisión' },
};

export default function EstadoElegibilidad({ elegibilidad }) {
  if (!elegibilidad?.criterios?.length) return null;

  const estilo = ESTILO[elegibilidad.estado] || ESTILO.en_revision;

  return (
    <div className={`ip-card p-4 mb-4 border-start border-4 border-${estilo.clase}`}>
      <div className="d-flex align-items-start gap-3 mb-3">
        <i className={`bi ${estilo.icono} fs-4 text-${estilo.clase}`} />
        <div className="flex-grow-1">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h5 className="mb-0">{estilo.titulo}</h5>
            <span className="ip-badge-nivel">
              {elegibilidad.cumplidos} de {elegibilidad.total} condiciones habilitantes
            </span>
          </div>
          <p className="mb-0 mt-2 text-secondary small">{elegibilidad.mensaje}</p>
        </div>
      </div>

      <div className="row g-2">
        {elegibilidad.criterios.map((criterio) => (
          <div className="col-md-6" key={criterio.id}>
            <div className="d-flex gap-2 align-items-start p-2 rounded" style={{ background: 'var(--ip-gris-100, #f6f7f9)' }}>
              <i className={`bi ${criterio.cumple ? 'bi-check-circle text-success' : 'bi-dash-circle text-warning'} mt-1`} />
              <div>
                <div className="small fw-semibold">{criterio.nombre}</div>
                <div className="small text-secondary">{criterio.razon}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
