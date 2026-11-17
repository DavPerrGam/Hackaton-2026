export default function Footer() {
  return (
    <footer className="ip-footer">
      <div className="container">
        <div className="row gy-4">
          <div className="col-md-4">
            <h5 className="text-white">IDEAPRO</h5>
            <p className="small mb-0">
              Consultoría especializada para fortalecer empresas y profesionales frente al
              ecosistema del mercado público colombiano.
            </p>
          </div>
          <div className="col-md-4">
            <h6 className="text-white">Navegación</h6>
            <ul className="list-unstyled small">
              <li><a href="#nosotros">Conócenos</a></li>
              <li><a href="#servicios">Servicios</a></li>
              <li><a href="#novedades">Novedades</a></li>
              <li><a href="/agente">Agente de diagnóstico</a></li>
            </ul>
          </div>
          <div className="col-md-4">
            <h6 className="text-white">Síguenos</h6>
            <div className="d-flex gap-3 fs-5">
              <a href="https://wa.link/eooqv5" target="_blank" rel="noreferrer" aria-label="WhatsApp"><i className="bi bi-whatsapp" /></a>
              <a href="https://www.facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"><i className="bi bi-facebook" /></a>
              <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><i className="bi bi-linkedin" /></a>
              <a href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><i className="bi bi-instagram" /></a>
            </div>
          </div>
        </div>
        <hr className="border-secondary my-4" />
        <div className="d-flex flex-column flex-md-row justify-content-between small">
          <span>&copy; {new Date().getFullYear()} IDEAPRO. Todos los derechos reservados.</span>
          <span>Prototipo del Agente Inteligente · Reto IDEAPRO</span>
        </div>
      </div>
    </footer>
  );
}
