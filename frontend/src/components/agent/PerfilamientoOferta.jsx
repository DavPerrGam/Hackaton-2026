// Etapa 6 del protocolo: la cadena
// SERVICIO -> CAPACIDAD -> PROBLEMA -> NECESIDAD PÚBLICA -> IMPACTO
// -> COMPRADOR PÚBLICO.
// Es la pieza más consultiva del reporte: le muestra a la organización
// cómo se traduce lo que vende a algo que el Estado puede comprar.

const ETIQUETAS_COMPRADOR = {
  alcaldias: 'Alcaldías',
  gobernaciones: 'Gobernaciones',
  ministerios: 'Ministerios',
  agencias_nacionales: 'Agencias nacionales',
  institutos_descentralizados: 'Institutos descentralizados',
  ese_hospitales: 'ESE y hospitales públicos',
  secretarias_educacion: 'Secretarías de Educación',
  secretarias_salud: 'Secretarías de Salud',
  instituciones_educativas: 'Instituciones educativas',
  universidades_publicas: 'Universidades públicas',
  empresas_servicios_publicos: 'Empresas de servicios públicos',
  corporaciones_autonomas: 'Corporaciones autónomas (CAR)',
  camaras_comercio: 'Cámaras de Comercio',
  cooperacion_internacional: 'Cooperación internacional',
};

const ESLABONES = [
  { campo: 'servicio', titulo: 'Servicio' },
  { campo: 'capacidad', titulo: 'Capacidad' },
  { campo: 'problema', titulo: 'Problema que resuelve' },
  { campo: 'necesidad_publica', titulo: 'Necesidad pública' },
  { campo: 'impacto_esperado', titulo: 'Impacto esperado' },
];

export default function PerfilamientoOferta({ perfilamiento, profundizacion = [] }) {
  const cadenas = perfilamiento?.cadenas || [];
  if (cadenas.length === 0) return null;

  return (
    <div className="ip-card p-4">
      <h6 className="mb-1">Perfilamiento de servicios</h6>
      <p className="small text-secondary">{perfilamiento.resumen}</p>

      {/* Etapa 5: lo que el agente preguntó específicamente por el
          enfoque de esta organización. Es la evidencia cualitativa que
          sostiene la cadena de valor que viene abajo. */}
      {profundizacion.length > 0 && (
        <div className="border rounded-3 p-3 mb-3 bg-light">
          <div className="small text-secondary mb-2">Profundización según su enfoque</div>
          {profundizacion.map((item) => (
            <div className="small mb-1" key={item.id}>
              <strong>{item.etiqueta}:</strong> {item.valor}
            </div>
          ))}
        </div>
      )}

      {perfilamiento.alerta && (
        <div className="alert alert-warning py-2 small">{perfilamiento.alerta}</div>
      )}

      {cadenas.map((cadena, indice) => (
        <div key={`${cadena.categoria}-${indice}`} className={indice > 0 ? 'mt-4 pt-4 border-top' : 'mt-3'}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="fw-semibold small">Vía {cadena.categoria}</span>
            {cadena.afinidad > 0 && <span className="ip-badge-nivel">{cadena.afinidad}% de afinidad</span>}
          </div>

          <ol className="list-unstyled mb-0">
            {ESLABONES.map((eslabon, posicion) => (
              <li className="d-flex gap-3 pb-3" key={eslabon.campo}>
                <div className="d-flex flex-column align-items-center">
                  <span
                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: 24, height: 24, fontSize: 12, fontWeight: 700,
                      background: 'var(--ip-naranja-500)', color: 'var(--ip-azul-950)',
                    }}
                  >
                    {posicion + 1}
                  </span>
                  {posicion < ESLABONES.length - 1 && (
                    <span className="flex-grow-1" style={{ width: 2, background: 'var(--ip-gris-300, #dcdfe4)' }} />
                  )}
                </div>
                <div>
                  <div className="small text-uppercase text-secondary" style={{ letterSpacing: '.04em' }}>
                    {eslabon.titulo}
                  </div>
                  <div>{cadena[eslabon.campo]}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-1">
            <div className="small text-uppercase text-secondary mb-1" style={{ letterSpacing: '.04em' }}>
              Posibles compradores públicos
            </div>
            {cadena.compradores_publicos.map((comprador) => (
              <span className="badge bg-light text-dark border me-1 mb-1" key={comprador}>
                {ETIQUETAS_COMPRADOR[comprador] || comprador}
              </span>
            ))}
          </div>

          {cadena.politica_asociada && (
            <p className="small text-secondary mb-0 mt-2">
              <strong>Marco de política:</strong> {cadena.politica_asociada}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
