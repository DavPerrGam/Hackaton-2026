import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <header className="ip-hero">
      <div className="container position-relative">
        <div className="row align-items-center">
          <div className="col-lg-7">
            <span className="ip-section-title text-uppercase">Ecosistema IDEAPRO</span>
            <h1 className="text-white mt-2 mb-4" style={{ fontSize: '2.6rem' }}>
              Impulsamos a las empresas colombianas a dar su primer paso, con paso firme,
              hacia el mercado público.
            </h1>
            <p className="mb-4" style={{ color: 'var(--ip-gris-300)', maxWidth: 560 }}>
              Antes de ofrecerte una solución, queremos entenderte. Nuestro agente de
              diagnóstico conversa contigo, identifica el nivel de madurez real de tu empresa
              y te conecta con la ruta de acompañamiento IDEAPRO que de verdad necesitas.
            </p>
            <div className="d-flex flex-wrap gap-3">
              <Link to="/agente" className="btn ip-btn-primary">
                Iniciar mi diagnóstico gratuito
              </Link>
              <a href="#servicios" className="btn ip-btn-outline">
                Ver servicios IDEAPRO
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
