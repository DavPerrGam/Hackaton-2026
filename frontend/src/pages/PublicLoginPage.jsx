import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient.js';

export default function PublicLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ correo: '', password: '' });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cambiar = (campo) => (e) => setForm((actual) => ({ ...actual, [campo]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const { data } = await axiosClient.post('/auth/login-publico', form);
      localStorage.setItem('ideapro_public_user', JSON.stringify(data.usuario));
      localStorage.setItem('ideapro_public_token', data.token);
      navigate('/agente');
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
        <span className="ip-section-title d-block mt-4 mb-2">Acceso público</span>
        <h4 className="mb-1">Inicia sesión para continuar</h4>
        <p className="text-secondary small mb-4">Necesitas una cuenta para realizar el diagnóstico de tu empresa.</p>
        <form onSubmit={onSubmit}>
          <div className="mb-3 ip-field">
            <label className="form-label small">Correo</label>
            <input type="email" className="form-control" value={form.correo} onChange={cambiar('correo')} required />
          </div>
          <div className="mb-3 ip-field">
            <label className="form-label small">Contraseña</label>
            <input type="password" className="form-control" value={form.password} onChange={cambiar('password')} required />
          </div>
          {error && <div key={error} className="alert alert-danger py-2 small ip-shake">{error}</div>}
          <button type="submit" className="btn ip-btn-primary w-100" disabled={cargando}>
            {cargando ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="text-center text-secondary small mt-4 mb-0">
          ¿Aún no tienes cuenta? <Link to="/registro" className="ip-auth-link">Registrarte</Link>
        </p>
        <p className="text-center text-secondary small mt-2 mb-0">
          <Link to="/admin/login" className="ip-auth-link">Acceso interno de analistas</Link>
        </p>
      </div>
    </div>
  );
}
