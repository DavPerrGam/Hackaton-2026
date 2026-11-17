const NOMBRES = {
  oferta: 'Oferta',
  experiencia: 'Experiencia',
  operativa: 'Operativa',
  legal: 'Legal',
  financiera: 'Financiera',
  comercial: 'Comercial',
};

// Nota: se optó por barras horizontales en vez de un radar SVG real
// para mantener el componente 100% dependency-free y accesible
// (lectores de pantalla lo leen igual que una tabla). Si más adelante
// se requiere el radar visual clásico, este componente se puede
// reemplazar por uno basado en recharts sin tocar el resto del flujo,
// ya que recibe los mismos `scores`.
export default function EjesRadar({ scores }) {
  return (
    <div>
      {Object.entries(scores).map(([eje, valor]) => (
        <div key={eje} className="mb-3">
          <div className="d-flex justify-content-between small mb-1">
            <span className="fw-semibold">{NOMBRES[eje] || eje}</span>
            <span className="ip-radar-score">{valor}/100</span>
          </div>
          <div className="ip-progress-track">
            <div className="ip-progress-fill" style={{ width: `${valor}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
