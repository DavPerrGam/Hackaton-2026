// Etapa 3 del protocolo Nexus: clasificación con porcentaje de
// afinidad. Se muestra la evidencia que disparó cada categoría porque
// el valor consultivo está en poder decirle a la organización POR QUÉ
// el sistema la ubicó ahí, no solo dónde la ubicó.

export default function ClasificacionSectorial({ clasificacion }) {
  const categorias = clasificacion?.categorias || [];
  if (categorias.length === 0) return null;

  return (
    <div className="ip-card p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Clasificación sectorial</h6>
        {clasificacion.principal && (
          <span className="ip-badge-nivel">
            {clasificacion.principal.nombre}
            {clasificacion.subcategoria ? ` · ${clasificacion.subcategoria.nombre}` : ''}
          </span>
        )}
      </div>

      <div className="d-flex flex-column gap-3">
        {categorias.map((categoria) => (
          <div key={categoria.id}>
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="fw-semibold small">{categoria.nombre}</span>
              <span className="small text-secondary">{categoria.afinidad}% de afinidad</span>
            </div>
            <div className="ip-progress-track">
              <div className="ip-progress-fill" style={{ width: `${categoria.afinidad}%` }} />
            </div>
            {(categoria.evidencia?.length > 0 || categoria.senales?.length > 0) && (
              <div className="small text-secondary mt-1">
                {categoria.evidencia?.length > 0 && <>Detectado por: {categoria.evidencia.join(', ')}. </>}
                {categoria.senales?.length > 0 && <>Reforzado por {categoria.senales.join(' y ')}.</>}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="small text-secondary mb-0 mt-3">
        Una organización puede pertenecer a varias categorías: el porcentaje indica la afinidad
        detectada a partir de toda la conversación, no una clasificación excluyente.
      </p>
    </div>
  );
}
