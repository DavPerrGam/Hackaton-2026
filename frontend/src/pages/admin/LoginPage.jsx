import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      await login(correo, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="ip-auth-page d-flex align-items-center justify-content-center p-3">
      <div className="ip-auth-card ip-card bg-white">
        <Link to="/" className="ip-auth-brand text-decoration-none">
          <span className="ip-auth-mark">IP</span>
          <span>IDEAPRO</span>
        </Link>
        <span className="ip-section-title d-block mt-4 mb-2">Acceso interno</span>
        <h4 className="mb-1">Panel IDEAPRO</h4>
        <p className="text-secondary small mb-4">Gestiona el seguimiento de las empresas diagnosticadas. Este acceso es solo para analistas.</p>
        <form onSubmit={onSubmit}>
          <div className="mb-3 ip-field">
            <label className="form-label small">Correo</label>
            <input type="email" className="form-control" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
          </div>
          <div className="mb-3 ip-field">
            <label className="form-label small">Contraseña</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div key={error} className="alert alert-danger py-2 small ip-shake">{error}</div>}
          <button type="submit" className="btn ip-btn-primary w-100" disabled={cargando}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <p className="text-center text-secondary small mt-4 mb-0">
          ¿Buscas el diagnóstico público? <Link to="/agente" className="ip-auth-link">Ir al agente</Link>
        </p>
      </div>
    </div>
  );
}
