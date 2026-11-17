import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient.js';

const ESTADOS = {
  pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada', bloqueada: 'Bloqueada',
};

export default function SeguimientoOportunidad({ diagnosticoId }) {
  const [oportunidades, setOportunidades] = useState([]);
  const [seguimiento, setSeguimiento] = useState(null);
  const [perfilamiento, setPerfilamiento] = useState({ problemaPublico: '', territorio: '' });
  const [resultado, setResultado] = useState({ resultado: 'no_adjudicada', dificultades: '', aprendizajes: '', nuevasBrechas: [] });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    axiosClient.get(`/agente/oportunidades?diagnosticoId=${diagnosticoId}`)
      .then(({ data }) => setOportunidades(data.data || []))
      .catch((err) => setError(err.message));
  }, [diagnosticoId]);

  const cambiarPerfil = (campo) => (event) => setPerfilamiento((actual) => ({ ...actual, [campo]: event.target.value }));

  async function iniciarSeguimiento(oportunidad) {
    setCargando(true); setError(null); setMensaje(null);
    try {
      const { data } = await axiosClient.post(`/agente/diagnostico/${diagnosticoId}/oportunidades/${oportunidad.id}`, { perfilamiento });
      setSeguimiento(data);
      setMensaje('Seguimiento DURANTE iniciado. Ya puedes organizar requisitos, documentos y fechas.');
    } catch (err) { setError(err.message); } finally { setCargando(false); }
  }

  async function cambiarTarea(tarea) {
    try {
      const { data } = await axiosClient.patch(`/agente/tareas/${tarea.id}`, { estado: tarea.estado === 'completada' ? 'pendiente' : 'completada' });
      setSeguimiento((actual) => ({ ...actual, tareas: actual.tareas.map((item) => item.id === data.id ? data : item) }));
    } catch (err) { setError(err.message); }
  }

  async function guardarResultado(event) {
    event.preventDefault(); setCargando(true); setError(null);
    try {
      await axiosClient.post(`/agente/postulaciones/${seguimiento.postulacion.id}/resultados`, resultado);
      setMensaje('Resultado EXPOST registrado. Las nuevas brechas quedan disponibles para la siguiente ruta.');
    } catch (err) { setError(err.message); } finally { setCargando(false); }
  }

  return (
    <section className="mt-4">
      <h5 className="mb-3">Acompañamiento de oportunidad</h5>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {mensaje && <div className="alert alert-success py-2 small">{mensaje}</div>}
      {!seguimiento && oportunidades.length > 0 && (
        <div className="ip-card p-4">
          <p className="small text-secondary">Selecciona una oportunidad abierta. El encaje se calcula con tu diagnóstico, requisitos y brechas.</p>
          <div className="row g-3 mb-3">
            <div className="col-md-6"><label className="form-label small">Problema público que resuelve</label><input className="form-control" value={perfilamiento.problemaPublico} onChange={cambiarPerfil('problemaPublico')} /></div>
            <div className="col-md-6"><label className="form-label small">Entidad o territorio objetivo</label><input className="form-control" value={perfilamiento.territorio} onChange={cambiarPerfil('territorio')} /></div>
          </div>
          {oportunidades.map((oportunidad) => (
            <div className="border rounded p-3 mb-2" key={oportunidad.id}>
              <div className="d-flex justify-content-between gap-3"><strong>{oportunidad.nombre}</strong><span className="ip-badge-nivel">{oportunidad.encaje?.porcentaje ?? 0}%</span></div>
              <div className="small text-secondary">{oportunidad.entidad || 'Entidad por confirmar'} · {oportunidad.territorio || 'Territorio por confirmar'}</div>
              <button type="button" className="btn ip-btn-primary btn-sm mt-2" onClick={() => iniciarSeguimiento(oportunidad)} disabled={cargando}>Preparar oportunidad</button>
            </div>
          ))}
        </div>
      )}
      {!seguimiento && oportunidades.length === 0 && <div className="ip-card p-4 small text-secondary">No hay oportunidades reales abiertas para mostrar en este momento.</div>}
      {seguimiento && (
        <div className="ip-card p-4">
          <div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><strong>{seguimiento.postulacion.oportunidades?.nombre}</strong><div className="small text-secondary">Fase {seguimiento.postulacion.fase} · {seguimiento.postulacion.porcentaje_encaje}% de encaje</div></div><span className="ip-badge-nivel">{seguimiento.postulacion.estado}</span></div>
          <h6>Requisitos y tareas</h6>
          {seguimiento.tareas.map((tarea) => <div className="d-flex align-items-center gap-2 border-bottom py-2" key={tarea.id}><input type="checkbox" checked={tarea.estado === 'completada'} onChange={() => cambiarTarea(tarea)} /><span className={tarea.estado === 'completada' ? 'text-decoration-line-through' : ''}>{tarea.titulo}</span><small className="text-secondary ms-auto">{ESTADOS[tarea.estado]}</small></div>)}
          <h6 className="mt-4">EXPOST: resultado y aprendizajes</h6>
          <form onSubmit={guardarResultado}>
            <select className="form-select mb-2" value={resultado.resultado} onChange={(event) => setResultado((actual) => ({ ...actual, resultado: event.target.value }))}><option value="adjudicada">Adjudicada</option><option value="no_adjudicada">No adjudicada</option><option value="cancelada">Cancelada</option><option value="sin_respuesta">Sin respuesta</option></select>
            <textarea className="form-control mb-2" placeholder="Dificultades encontradas" value={resultado.dificultades} onChange={(event) => setResultado((actual) => ({ ...actual, dificultades: event.target.value }))} />
            <textarea className="form-control mb-2" placeholder="Aprendizajes y nuevas brechas" value={resultado.aprendizajes} onChange={(event) => setResultado((actual) => ({ ...actual, aprendizajes: event.target.value }))} />
            <button className="btn ip-btn-primary btn-sm" disabled={cargando}>Registrar resultado EXPOST</button>
          </form>
        </div>
      )}
    </section>
  );
}
