import { Link } from 'react-router-dom';

export default function CTAAgente() {
  return (
    <section id="novedades" className="py-5 py-lg-6 bg-white">
      <div className="container py-4">
        <div className="ip-card p-5 text-center" style={{ background: 'linear-gradient(135deg, var(--ip-azul-950), var(--ip-azul-800))' }}>
          <h2 className="text-white">¿Aún no sabes por dónde empezar?</h2>
          <p className="mb-4" style={{ color: 'var(--ip-gris-300)' }}>
            En menos de 5 minutos, nuestro agente conversacional identifica tu nivel de
            madurez y te entrega una ruta de servicios hecha a tu medida.
          </p>
          <Link to="/agente" className="btn ip-btn-primary btn-lg">
            Hablar con el agente IDEAPRO
          </Link>
        </div>
      </div>
    </section>
  );
}
