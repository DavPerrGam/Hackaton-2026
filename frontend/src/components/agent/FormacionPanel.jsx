import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient.js';

export default function FormacionPanel({ diagnosticoId }) {
  const [data, setData] = useState({ formaciones: [], progreso: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    axiosClient.get(`/agente/formaciones?diagnosticoId=${diagnosticoId}`)
      .then((response) => setData(response.data))
      .catch((err) => setError(err.message));
  }, [diagnosticoId]);

  async function iniciar(formacionId) {
    try {
      const response = await axiosClient.post(`/agente/formaciones/${formacionId}/progreso`, { diagnosticoId });
      setData((actual) => ({ ...actual, progreso: [response.data, ...actual.progreso] }));
    } catch (err) { setError(err.message); }
  }

  async function completar(progreso) {
    try {
      const response = await axiosClient.patch(`/agente/formaciones/progreso/${progreso.id}`, { estado: 'completada', resultado: 'Completada por la empresa' });
      setData((actual) => ({ ...actual, progreso: actual.progreso.map((item) => item.id === response.data.id ? response.data : item) }));
    } catch (err) { setError(err.message); }
  }

  return (
    <section className="mt-4">
      <h5 className="mb-3">Formación para cerrar brechas</h5>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {!data.formaciones.length && <div className="ip-card p-4 small text-secondary">No hay formaciones configuradas para esta ruta.</div>}
      {data.formaciones.map((formacion) => {
        const progreso = data.progreso.find((item) => item.formacion_id === formacion.id);
        return <div className="ip-card p-3 mb-2" key={formacion.id}><div className="d-flex justify-content-between gap-3"><div><strong>{formacion.nombre}</strong><div className="small text-secondary">{formacion.descripcion}</div>{formacion.objetivo && <div className="small mt-2"><strong>Objetivo:</strong> {formacion.objetivo}</div>}{formacion.evidencia_requerida && <div className="small text-secondary"><strong>Evidencia:</strong> {formacion.evidencia_requerida}</div>}{formacion.duracion_horas && <div className="small text-secondary">Duración estimada: {formacion.duracion_horas} horas</div>}</div>{progreso ? <span className="ip-badge-nivel">{progreso.estado}</span> : <button type="button" className="btn ip-btn-primary btn-sm" onClick={() => iniciar(formacion.id)}>Iniciar</button>}</div>{progreso && progreso.estado !== 'completada' && <button type="button" className="btn btn-outline-primary btn-sm mt-2" onClick={() => completar(progreso)}>Marcar completada</button>}</div>;
      })}
    </section>
  );
}
