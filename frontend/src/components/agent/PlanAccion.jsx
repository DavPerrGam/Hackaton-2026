// Etapa 14 del protocolo Nexus: plan 30 / 60 / 90 / 180 días.
// Cada acción declara responsable, prioridad y resultado esperado.

const COLOR_PRIORIDAD = {
  'crítica': 'danger',
  alta: 'warning',
  media: 'secondary',
  baja: 'light',
};

export default function PlanAccion({ planAccion }) {
  const horizontes = planAccion?.horizontes || [];
  if (horizontes.length === 0) return null;

  return (
    <section className="mt-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 className="mb-0">Plan de acción</h5>
        {planAccion.acciones_criticas > 0 && (
          <span className="badge bg-danger">
            {planAccion.acciones_criticas} acción(es) crítica(s) en los primeros 30 días
          </span>
        )}
      </div>

      <div className="row g-3">
        {horizontes.map((horizonte) => (
          <div className="col-lg-6" key={horizonte.id}>
            <div className="ip-card p-4 h-100">
              <div className="d-flex justify-content-between align-items-baseline mb-1">
                <h6 className="mb-0">{horizonte.titulo}</h6>
                <span className="small text-secondary">{horizonte.foco}</span>
              </div>

              {horizonte.acciones.length === 0 ? (
                <p className="small text-secondary mb-0 mt-2">
                  Sin acciones pendientes en este horizonte: las capacidades de este frente ya están cubiertas.
                </p>
              ) : (
                <ul className="list-unstyled mb-0 mt-3">
                  {horizonte.acciones.map((accion) => (
                    <li className="pb-3 mb-3 border-bottom" key={accion.id}>
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                        <span className="small fw-semibold">{accion.accion}</span>
                        <span className={`badge bg-${COLOR_PRIORIDAD[accion.prioridad] || 'secondary'} text-uppercase`}>
                          {accion.prioridad}
                        </span>
                      </div>
                      <div className="small text-secondary">
                        <i className="bi bi-person me-1" />{accion.responsable}
                      </div>
                      <div className="small text-secondary">
                        <i className="bi bi-flag me-1" />{accion.resultado}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
