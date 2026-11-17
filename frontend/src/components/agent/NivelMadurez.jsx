// Etapa 10 del protocolo Nexus. La pieza clave es la explicación de
// las PENALIZACIONES: si el índice sugería un nivel superior pero una
// brecha habilitante actuó como techo, la organización tiene derecho a
// saber exactamente cuál fue y por qué.

const NIVELES = [1, 2, 3, 4, 5];

export default function NivelMadurez({ nivel, riesgoFinanciero }) {
  if (!nivel?.nivel) return null;

  return (
    <div className="ip-card p-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h6 className="mb-0">Nivel de madurez</h6>
        {riesgoFinanciero?.nivel && (
          <span className={`badge bg-${riesgoFinanciero.nivel === 'alto' ? 'danger' : riesgoFinanciero.nivel === 'medio' ? 'warning' : 'success'}`}>
            Riesgo financiero {riesgoFinanciero.nivel}
          </span>
        )}
      </div>

      <div className="d-flex gap-2 mb-3">
        {NIVELES.map((n) => (
          <div className="flex-fill text-center" key={n}>
            <div
              className="rounded py-2 small fw-semibold"
              style={{
                background: n <= nivel.nivel ? 'var(--ip-azul-900)' : 'var(--ip-gris-200, #e9ecef)',
                color: n <= nivel.nivel ? '#fff' : 'var(--ip-gris-600, #6c757d)',
              }}
            >
              {n}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-2">
        <strong>Nivel {nivel.nivel} · {nivel.nombre}</strong>
      </div>
      <p className="small text-secondary">{nivel.descripcion}</p>

      {nivel.penalizaciones?.length > 0 && (
        <div className="alert alert-warning py-2 small mb-0">
          <strong>Por qué no es un nivel superior.</strong> El índice ubicaba a la organización en
          nivel {nivel.nivelBase}, pero:
          <ul className="mb-0 mt-1 ps-3">
            {nivel.penalizaciones.map((penalizacion) => (
              <li key={penalizacion.motivo}>{penalizacion.motivo}</li>
            ))}
          </ul>
        </div>
      )}

      {riesgoFinanciero?.interpretacion && (
        <p className="small text-secondary mb-0 mt-3">{riesgoFinanciero.interpretacion}</p>
      )}
    </div>
  );
}
