// Etapa 12 del protocolo Nexus: mapa de oportunidades por entidad.
// Se separan explícitamente las entidades accesibles hoy de las que
// exigen cerrar una brecha antes, porque esa distinción es la que
// convierte el mapa en una decisión y no en una lista de deseos.

export default function EntidadesObjetivo({ entidadesObjetivo }) {
  const entidades = entidadesObjetivo?.entidades || [];
  if (entidades.length === 0) return null;

  const accesibles = entidades.filter((e) => e.accesible_hoy);
  const conBarreras = entidades.filter((e) => !e.accesible_hoy);
  const entrada = entidadesObjetivo.entrada_recomendada;

  return (
    <div className="ip-card p-4">
      <h6 className="mb-1">Entidades objetivo</h6>
      <p className="small text-secondary">
        Quién, dentro del Estado, tiene el problema que su organización resuelve y presupuesto para resolverlo.
      </p>

      {entrada && (
        <div className="alert alert-primary py-2 small">
          <strong>Puerta de entrada recomendada:</strong> {entrada.ejemplo_territorial || entrada.nombre}.
        </div>
      )}

      {accesibles.length > 0 && (
        <>
          <div className="small text-uppercase text-secondary mb-2 mt-3" style={{ letterSpacing: '.04em' }}>
            Accesibles con la madurez actual
          </div>
          {accesibles.map((entidad) => (
            <Entidad entidad={entidad} key={entidad.id} />
          ))}
        </>
      )}

      {conBarreras.length > 0 && (
        <>
          <div className="small text-uppercase text-secondary mb-2 mt-4" style={{ letterSpacing: '.04em' }}>
            Requieren cerrar una brecha primero
          </div>
          {conBarreras.map((entidad) => (
            <Entidad entidad={entidad} key={entidad.id} />
          ))}
        </>
      )}
    </div>
  );
}

function Entidad({ entidad }) {
  return (
    <div className="py-2 border-bottom">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          <strong className="small">{entidad.ejemplo_territorial || entidad.nombre}</strong>
          <span className="badge bg-light text-dark border ms-2 text-capitalize">{entidad.ambito}</span>
        </div>
        <span className="ip-badge-nivel">{entidad.prioridad}</span>
      </div>
      <div className="small text-secondary mt-1">{entidad.por_que}</div>
      {entidad.barreras?.length > 0 && (
        <ul className="small text-warning-emphasis mb-0 mt-1 ps-3">
          {entidad.barreras.map((barrera) => (
            <li key={barrera}>{barrera}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
