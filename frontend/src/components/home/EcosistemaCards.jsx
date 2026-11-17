const EJES = [
  { icon: 'bi-box-seam', titulo: 'Oferta', texto: 'Qué tan clara y competitiva es tu propuesta de valor frente al Estado.' },
  { icon: 'bi-award', titulo: 'Experiencia', texto: 'Tu trayectoria, certificaciones y contratos previos con entidades públicas.' },
  { icon: 'bi-gear', titulo: 'Operativa', texto: 'La capacidad real de tu equipo y procesos para responder a un contrato.' },
  { icon: 'bi-file-earmark-check', titulo: 'Legal', texto: 'RUP, pólizas y comprensión de los pliegos de condiciones.' },
  { icon: 'bi-cash-coin', titulo: 'Financiera', texto: 'Tu respaldo financiero para asumir garantías y flujo de caja.' },
  { icon: 'bi-graph-up-arrow', titulo: 'Comercial', texto: 'Tu capacidad para identificar, perseguir y ganar oportunidades.' },
];

export default function EcosistemaCards() {
  return (
    <section id="nosotros" className="py-5 py-lg-6 bg-white">
      <div className="container py-4">
        <div className="text-center mb-5">
          <span className="ip-section-title">Cómo diagnosticamos</span>
          <h2 className="mt-2">Seis ejes, un solo índice IDEAPRO</h2>
          <p className="text-secondary mx-auto" style={{ maxWidth: 640 }}>
            El agente evalúa tu empresa en seis dimensiones de madurez frente al mercado
            público y las combina en un índice único que guía toda tu ruta de acompañamiento.
          </p>
        </div>
        <div className="row g-4">
          {EJES.map((eje) => (
            <div className="col-md-6 col-lg-4" key={eje.titulo}>
              <div className="ip-card p-4">
                <div className="ip-icon-badge mb-3">
                  <i className={`bi ${eje.icon}`} />
                </div>
                <h5>{eje.titulo}</h5>
                <p className="text-secondary small mb-0">{eje.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
