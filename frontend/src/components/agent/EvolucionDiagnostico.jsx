import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient.js';

const EJES = ['oferta', 'experiencia', 'operativa', 'legal', 'financiera', 'comercial'];

export default function EvolucionDiagnostico({ diagnosticoId }) {
  const [evolucion, setEvolucion] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    axiosClient.get(`/agente/diagnostico/${diagnosticoId}/evolucion`)
      .then(({ data }) => setEvolucion(data))
      .catch((err) => setError(err.message));
  }, [diagnosticoId]);

  if (error || evolucion.length < 2) return null;

  return (
    <section className="mt-4">
      <h5 className="mb-3">Evolución de tu preparación</h5>
      <div className="ip-card p-4">
        {evolucion.map((diagnostico) => (
          <div className="border-bottom py-3" key={diagnostico.id}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong>{new Date(diagnostico.created_at).toLocaleDateString()}</strong>
              <span className="ip-badge-nivel">{diagnostico.indice_ideapro}/1000</span>
            </div>
            <div className="small text-secondary">
              {EJES.map((eje) => {
                const cambio = diagnostico.cambios?.[eje] || 0;
                return <span className="me-3" key={eje}>{eje}: {cambio > 0 ? '+' : ''}{cambio}</span>;
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
