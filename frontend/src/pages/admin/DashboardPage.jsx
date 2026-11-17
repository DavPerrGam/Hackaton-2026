import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

const NIVEL_LABEL = {
  inicial: 'Inicial', exploracion: 'Exploración',
  en_desarrollo: 'En desarrollo', preparacion: 'Preparación',
  intermedio: 'Intermedio', lista_para_explorar: 'Lista para explorar',
  avanzado: 'Avanzado', preparada: 'Preparada', consolidada: 'Consolidada',
};

export default function DashboardPage() {
  const { admin, logout } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);
  const [nuevaOportunidad, setNuevaOportunidad] = useState({ nombre: '', entidad: '', territorio: '', fechaCierre: '', requisitos: '{}' });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      axiosClient.get('/admin/empresas'),
      axiosClient.get('/admin/usuarios-publicos'),
      axiosClient.get('/admin/oportunidades'),
    ])
      .then(([empresasRes, usuariosRes, oportunidadesRes]) => {
        setEmpresas(empresasRes.data.data);
        setUsuarios(usuariosRes.data.data);
        setOportunidades(oportunidadesRes.data.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ip-gris-100)' }}>
      <nav className="ip-navbar navbar px-4 py-3">
        <span className="fw-bold" style={{ color: 'var(--ip-azul-950)' }}>Panel IDEAPRO — Empresas diagnosticadas</span>
        <div className="d-flex align-items-center gap-3">
          <span className="small text-secondary">{admin?.nombre} ({admin?.rol})</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={logout}>Cerrar sesión</button>
        </div>
      </nav>

      <div className="container py-4">
        {cargando && <p>Cargando…</p>}
        {error && <div className="alert alert-danger">{error}</div>}

        {!cargando && !error && (
          <>
          <div className="table-responsive ip-card mb-4">
            <div className="p-3 border-bottom">
              <h5 className="mb-1">Empresas diagnosticadas</h5>
              <span className="small text-secondary">Seguimiento de resultados y oportunidades.</span>
            </div>
            <table className="table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Sector</th>
                  <th>Canal</th>
                  <th>Índice IDEAPRO</th>
                  <th>Nivel</th>
                  <th>Eje crítico</th>
                  <th>Fecha diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.empresa_id}>
                    <td>{e.empresa_nombre}</td>
                    <td>{e.sector_nombre || '—'}</td>
                    <td className="text-capitalize">{e.canal_entrada}</td>
                    <td>{e.indice_ideapro ?? '—'}</td>
                    <td>{e.nivel_madurez_global ? NIVEL_LABEL[e.nivel_madurez_global] : '—'}</td>
                    <td className="text-capitalize">{e.eje_critico_identificado || '—'}</td>
                    <td>{e.fecha_diagnostico ? new Date(e.fecha_diagnostico).toLocaleDateString('es-CO') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-responsive ip-card">
            <div className="p-3 border-bottom">
              <h5 className="mb-1">Registros públicos</h5>
              <span className="small text-secondary">Personas que se registraron en la plataforma pública.</span>
            </div>
            <table className="table mb-0 align-middle">
              <thead><tr><th>Nombre</th><th>Correo</th><th>Estado</th><th>Registro</th></tr></thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>{usuario.nombre}</td>
                    <td>{usuario.correo}</td>
                    <td className="text-capitalize">{usuario.estado}</td>
                    <td>{new Date(usuario.created_at).toLocaleDateString('es-CO')}</td>
                  </tr>
                ))}
                {usuarios.length === 0 && <tr><td colSpan="4" className="text-secondary">Aún no hay registros.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="ip-card mt-4 p-3">
            <h5>Oportunidades reales</h5>
            <form className="row g-2 mb-3" onSubmit={async (event) => {
              event.preventDefault();
              try {
                const response = await axiosClient.post('/admin/oportunidades', {
                  ...nuevaOportunidad,
                  requisitos: JSON.parse(nuevaOportunidad.requisitos || '{}'),
                });
                setOportunidades((actual) => [response.data, ...actual]);
                setNuevaOportunidad({ nombre: '', entidad: '', territorio: '', fechaCierre: '', requisitos: '{}' });
              } catch (err) { setError(err.message); }
            }}>
              <div className="col-md-3"><input className="form-control" placeholder="Nombre" value={nuevaOportunidad.nombre} onChange={(event) => setNuevaOportunidad({ ...nuevaOportunidad, nombre: event.target.value })} required /></div>
              <div className="col-md-2"><input className="form-control" placeholder="Entidad" value={nuevaOportunidad.entidad} onChange={(event) => setNuevaOportunidad({ ...nuevaOportunidad, entidad: event.target.value })} /></div>
              <div className="col-md-2"><input className="form-control" placeholder="Territorio" value={nuevaOportunidad.territorio} onChange={(event) => setNuevaOportunidad({ ...nuevaOportunidad, territorio: event.target.value })} /></div>
              <div className="col-md-3"><input className="form-control" placeholder='Requisitos JSON: {"legal":50}' value={nuevaOportunidad.requisitos} onChange={(event) => setNuevaOportunidad({ ...nuevaOportunidad, requisitos: event.target.value })} /></div>
              <div className="col-md-2"><button className="btn ip-btn-primary w-100">Registrar</button></div>
            </form>
            <div className="small text-secondary">{oportunidades.length} oportunidades registradas. La fuente SECOP II se identifica en el registro y no se simula.</div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
