const NOMBRES = {
  oferta: 'Oferta', experiencia: 'Experiencia', operativa: 'Operativa',
  legal: 'Legal', financiera: 'Financiera', comercial: 'Comercial',
};

export default function EncajeOportunidades({ encaje }) {
  if (!encaje || encaje.length === 0) return null;

  return (
    <div className="d-flex flex-column gap-3">
      {encaje.map((item) => (
        <div className="ip-card p-4" key={item.id}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="mb-0">
              {item.oportunidad_real?.nombre || item.tipos_oportunidad?.nombre}
              {item.oportunidad_real && <span className="badge bg-light text-dark border ms-2">{item.oportunidad_real.fuente}</span>}
            </h6>
            <span className="ip-badge-nivel">{item.porcentaje_encaje}% de encaje</span>
          </div>
          <p className="text-secondary small mb-2">
            {item.oportunidad_real?.descripcion || item.tipos_oportunidad?.descripcion}
          </p>
          {item.oportunidad_real && (
            <div className="small text-secondary mb-2">
              {item.oportunidad_real.entidad && <span className="me-3">Entidad: {item.oportunidad_real.entidad}</span>}
              {item.oportunidad_real.territorio && <span className="me-3">Territorio: {item.oportunidad_real.territorio}</span>}
              {item.oportunidad_real.fecha_cierre && <span>Cierre: {new Date(item.oportunidad_real.fecha_cierre).toLocaleDateString()}</span>}
            </div>
          )}
          {item.fortalezas?.length > 0 && (
            <div className="small mb-2">
              <strong className="text-secondary">Fortalezas: </strong>
              {item.fortalezas.map((fortaleza) => (
                <span className="badge bg-light text-dark border me-1" key={fortaleza.eje}>
                  {NOMBRES[fortaleza.eje] || fortaleza.eje} ({fortaleza.score})
                </span>
              ))}
            </div>
          )}
          {item.brechas_identificadas?.length > 0 && (
            <div className="small">
              <strong className="text-secondary">Brechas a cerrar: </strong>
              {item.brechas_identificadas.map((b) => (
                <span className="badge bg-light text-dark border me-1" key={b.eje}>
                  {NOMBRES[b.eje] || b.eje} (-{b.brecha})
                </span>
              ))}
            </div>
          )}
          {item.accion_recomendada && (
            <p className="small mb-0 mt-2"><strong>Acción recomendada:</strong> {item.accion_recomendada}</p>
          )}
        </div>
      ))}
    </div>
  );
}
