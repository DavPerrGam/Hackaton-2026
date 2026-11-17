import { Link } from 'react-router-dom';
import { useState } from 'react';

const NAV_ITEMS = [
  { label: 'Formación', href: '#formacion' },
  { label: 'Servicios', href: '#servicios' },
  { label: 'Nosotros', href: '#nosotros' },
  { label: 'Novedades', href: '#novedades' },
];

export default function Navbar() {
  const [publicUser, setPublicUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ideapro_public_user') || 'null');
    } catch {
      return null;
    }
  });

  const cerrarSesionPublica = () => {
    localStorage.removeItem('ideapro_public_user');
    localStorage.removeItem('ideapro_public_token');
    setPublicUser(null);
  };

  return (
    <nav className="ip-navbar navbar navbar-expand-lg py-3 sticky-top">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
          <span
            className="d-inline-flex align-items-center justify-content-center rounded-circle"
            style={{ width: 40, height: 40, background: 'var(--ip-azul-950)', color: 'var(--ip-naranja-500)', fontWeight: 800 }}
          >
            IP
          </span>
          <span className="fw-bold" style={{ color: 'var(--ip-azul-950)' }}>IDEAPRO</span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#ideaproNav"
          aria-controls="ideaproNav"
          aria-expanded="false"
          aria-label="Abrir menú"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse justify-content-end" id="ideaproNav">
          <ul className="navbar-nav align-items-lg-center">
            {NAV_ITEMS.map((item) => (
              <li className="nav-item" key={item.label}>
                <a className="nav-link" href={item.href}>{item.label}</a>
              </li>
            ))}
            {!publicUser ? (
              <>
                <li className="nav-item ms-lg-3">
                  <Link to="/login" className="nav-link d-inline-block">Iniciar sesión</Link>
                </li>
                <li className="nav-item">
                  <Link to="/registro" className="nav-link d-inline-block">Registrarse</Link>
                </li>
              </>
            ) : (
              <li className="nav-item ms-lg-3 d-flex align-items-center gap-2">
                <span className="nav-link small text-secondary">Hola, {publicUser.nombre}</span>
                <button type="button" className="btn btn-link nav-link small p-0" onClick={cerrarSesionPublica}>
                  Cerrar sesión
                </button>
              </li>
            )}
            <li className="nav-item">
              <Link to="/admin/login" className="nav-link d-inline-block small text-secondary">
                Acceso interno
              </Link>
            </li>
            <li className="nav-item ms-lg-2">
              <Link to="/agente" className="btn ip-btn-primary btn-sm">
                Diagnostica tu empresa
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
