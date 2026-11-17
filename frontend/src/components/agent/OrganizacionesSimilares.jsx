// Etapa 11 del protocolo: relaciones empresariales. El valor no está en
// el porcentaje sino en la lectura: una organización muy parecida con
// las mismas carencias es competencia; una parecida que acredita lo que
// a usted le falta es un aliado para una unión temporal. Por eso cada
// tarjeta muestra primero el tipo de relación y después el número.

const RELACION = {
  complementaria: { texto: 'Alianza potencial', clase: 'success', icono: 'bi-people-fill' },
  oferta_integrada: { texto: 'Oferta integrada', clase: 'info', icono: 'bi-diagram-3-fill' },
  competencia_directa: { texto: 'Competencia directa', clase: 'warning', icono: 'bi-flag-fill' },
};

export default function OrganizacionesSimilares({ relaciones }) {
  const organizaciones = relaciones?.organizaciones || [];

  return (
    <div className="ip-card p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">Organizaciones similares</h6>
        {relaciones?.evaluadas > 0 && (
          <span className="small text-secondary">{relaciones.evaluadas} organizaciones comparadas</span>
        )}
      </div>

      {organizaciones.length === 0 && (
        <p className="mb-0 text-secondary small">
          {relaciones?.nota
            || 'Todavía no hay organizaciones comparables en el ecosistema IDEAPRO.'}
        </p>
      )}

      <div className="d-flex flex-column gap-3">
        {organizaciones.map((organizacion) => {
          const lectura = RELACION[organizacion.tipo_relacion] || RELACION.oferta_integrada;
          return (
            <div className="border rounded-3 p-3" key={organizacion.empresa_id || organizacion.nombre}>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                <div>
                  <strong>{organizacion.nombre}</strong>
                  {organizacion.territorio && (
                    <div className="small text-secondary">{organizacion.territorio}</div>
                  )}
                </div>
                <div className="text-end">
                  <span className={`badge text-bg-${lectura.clase}`}>
                    <i className={`bi ${lectura.icono} me-1`} />
                    {lectura.texto}
                  </span>
                  <div className="small text-secondary mt-1">{organizacion.similitud}% de similitud</div>
                </div>
              </div>

              <div className="ip-progress-track mb-2">
                <div className="ip-progress-fill" style={{ width: `${organizacion.similitud}%` }} />
              </div>

              {organizacion.categorias_comunes?.length > 0 && (
                <div className="small text-secondary mb-2">
                  Coinciden en: {organizacion.categorias_comunes.join(', ')}.
                </div>
              )}

              <p className="small mb-1">{organizacion.posible_alianza}</p>
              <p className="small text-secondary mb-0">
                <i className="bi bi-lightbulb me-1" />
                {organizacion.oportunidad_conjunta}
              </p>
            </div>
          );
        })}
      </div>

      {organizaciones.length > 0 && (
        <p className="small text-secondary mb-0 mt-3">
          La comparación usa la clasificación, los tags, el comprador público objetivo y el problema
          declarado. Solo se muestra información de perfil: ningún dato de contacto ni financiero de
          las otras organizaciones sale del ecosistema.
        </p>
      )}
    </div>
  );
}
