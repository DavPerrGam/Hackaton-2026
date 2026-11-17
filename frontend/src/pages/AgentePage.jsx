import { Link, Navigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.jsx';
import Navbar from '../components/layout/Navbar.jsx';
import Footer from '../components/layout/Footer.jsx';
import ChatAgent from '../components/agent/ChatAgent.jsx';
import Agent3DBackground from '../components/agent/Agent3DBackground.jsx';

export default function AgentePage() {
  const publicToken = localStorage.getItem('ideapro_public_token');
  if (!publicToken) return <Navigate to="/registro" replace />;

  return (
    <>
      <TopBar />
      <Navbar />
      <main className="ip-agent-main py-5" style={{ background: 'var(--ip-gris-100)', minHeight: '70vh' }}>
        <Agent3DBackground />
        <div className="container">
          <div className="text-center mb-4">
            <Link to="/" className="text-decoration-none small text-secondary">
              <i className="bi bi-arrow-left me-1" /> Volver al inicio
            </Link>
            <h2 className="mt-2">Cuéntanos sobre tu empresa</h2>
            <p className="text-secondary">Toma menos de 5 minutos y recibirás tu ruta personalizada al instante.</p>
          </div>
          <ChatAgent />
        </div>
      </main>
      <Footer />
    </>
  );
}
