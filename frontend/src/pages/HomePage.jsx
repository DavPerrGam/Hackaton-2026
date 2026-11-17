import { Navigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.jsx';
import Navbar from '../components/layout/Navbar.jsx';
import Footer from '../components/layout/Footer.jsx';
import Hero from '../components/home/Hero.jsx';
import EcosistemaCards from '../components/home/EcosistemaCards.jsx';
import ServiciosGrid from '../components/home/ServiciosGrid.jsx';
import CTAAgente from '../components/home/CTAAgente.jsx';

export default function HomePage() {
  if (!localStorage.getItem('ideapro_public_token')) return <Navigate to="/registro" replace />;

  return (
    <>
      <TopBar />
      <Navbar />
      <main>
        <Hero />
        <EcosistemaCards />
        <ServiciosGrid />
        <CTAAgente />
      </main>
      <Footer />
    </>
  );
}
