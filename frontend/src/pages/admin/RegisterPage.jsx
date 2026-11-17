import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', confirmacion: '' });
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cambiar = (campo) => (e) => setForm((actual) => ({ ...actual, [campo]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmacion) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setCargando(true);
    try {
      const { data } = await axiosClient.post('/auth/registro', {
        nombre: form.nombre,
        correo: form.correo,
        password: form.password,
      });
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
        <span className="ip-section-title d-block mt-4 mb-2">Nueva cuenta</span>
        <h4 className="mb-1">Regístrate en IDEAPRO</h4>
          <p className="text-secondary small mb-4">Regístrate para acceder al diagnóstico de tu empresa. El panel interno requiere una cuenta de analista.</p>
        <form onSubmit={onSubmit}>
          <div className="mb-3 ip-field">
            <label className="form-label small">Nombre completo</label>
            <input className="form-control" value={form.nombre} onChange={cambiar('nombre')} required />
          </div>
          <div className="mb-3 ip-field">
            <label className="form-label small">Correo</label>
            <input type="email" className="form-control" value={form.correo} onChange={cambiar('correo')} required />
          </div>
          <div className="mb-3 ip-field">
            <label className="form-label small">Contraseña</label>
            <input type="password" minLength="8" className="form-control" value={form.password} onChange={cambiar('password')} required />
          </div>
          <div className="mb-3 ip-field">
            <label className="form-label small">Confirmar contraseña</label>
            <input type="password" minLength="8" className="form-control" value={form.confirmacion} onChange={cambiar('confirmacion')} required />
          </div>
          {error && <div key={error} className="alert alert-danger py-2 small ip-shake">{error}</div>}
          <button type="submit" className="btn ip-btn-primary w-100" disabled={cargando}>
            {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="text-center text-secondary small mt-4 mb-0">
          ¿Ya tienes cuenta? <Link to="/login" className="ip-auth-link">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}