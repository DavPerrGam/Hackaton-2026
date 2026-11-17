import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient.js';

export default function AlertasOportunidad({ diagnosticoId }) {
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    axiosClient.get(`/agente/alertas?diagnosticoId=${diagnosticoId}`)
      .then(({ data }) => setAlertas(data))
      .catch(() => setAlertas([]));
  }, [diagnosticoId]);

  async function marcarLeida(alerta) {
    await axiosClient.patch(`/agente/alertas/${alerta.id}/leida`, { diagnosticoId });
    setAlertas((actuales) => actuales.map((item) => item.id === alerta.id ? { ...item, estado: 'leida' } : item));
  }

  if (!alertas.length) return null;

  return (
    <section className="mt-4">
      <h5 className="mb-3">Alertas de oportunidades</h5>
      <div className="ip-card p-4">
        {alertas.map((alerta) => (
          <div className="d-flex justify-content-between align-items-start gap-3 border-bottom py-2" key={alerta.id}>
            <div>
              <strong>{alerta.titulo}</strong>
              <div className="small text-secondary">{alerta.mensaje}</div>
              {alerta.oportunidades?.nombre && <div className="small">{alerta.oportunidades.nombre}</div>}
            </div>
            {alerta.estado === 'pendiente' && <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => marcarLeida(alerta)}>Marcar leída</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
