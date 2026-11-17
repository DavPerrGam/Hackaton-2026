const CURRENCY = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const TIPO_LABEL = {
  critico: { label: 'Prioridad #1', color: 'var(--ip-naranja-600)' },
  prerequisito: { label: 'Prerrequisito', color: 'var(--ip-gris-600)' },
  cross_sell: { label: 'Complementario', color: 'var(--ip-verde-600)' },
};

export default function RutaRecomendada({ ruta }) {
  if (!ruta || ruta.length === 0) {
    return <p className="text-secondary">Tu empresa ya está en un nivel avanzado: un consultor IDEAPRO te contactará para una asesoría a la medida.</p>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {ruta.map((item) => {
        const servicio = item.catalogo_servicios;
        const meta = TIPO_LABEL[item.tipo] || TIPO_LABEL.cross_sell;
        return (
          <div className="ip-card p-4" key={item.id || item.servicio_id}>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div>
                <span className="badge mb-2" style={{ background: meta.color, color: 'var(--ip-azul-950)' }}>
                  {meta.label} · Paso {item.orden_prioridad}
                </span>
                <h5 className="mb-1">{servicio?.nombre_servicio}</h5>
              </div>
              {servicio?.precio_referencia_cop && (
                <span className="fw-semibold">{CURRENCY.format(servicio.precio_referencia_cop)}</span>
              )}
            </div>
            <p className="text-secondary small mb-2">{item.justificacion_ia}</p>
            <div className="d-flex gap-3 small text-secondary">
              <span><i className="bi bi-tag me-1" />{servicio?.tipo_servicio}</span>
              <span><i className="bi bi-clock me-1" />{servicio?.duracion_semanas} semanas</span>
              <span><i className="bi bi-laptop me-1" />{servicio?.modalidad}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
