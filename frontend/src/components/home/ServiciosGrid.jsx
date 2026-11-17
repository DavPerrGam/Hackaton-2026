import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient.js';

const CURRENCY = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function ServiciosGrid() {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axiosClient
      .get('/catalogo')
      .then((res) => setServicios(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <section id="servicios" className="py-5 py-lg-6" style={{ background: 'var(--ip-gris-100)' }}>
      <div className="container py-4">
        <div className="text-center mb-5">
          <span className="ip-section-title">Portafolio</span>
          <h2 className="mt-2">Servicios del ecosistema IDEAPRO</h2>
          <p className="text-secondary mx-auto" style={{ maxWidth: 640 }}>
            Este es el catálogo completo. Tu agente de diagnóstico solo te recomendará los
            que realmente correspondan a tu momento actual.
          </p>
        </div>

        {cargando && <p className="text-center text-secondary">Cargando catálogo…</p>}
        {error && (
          <p className="text-center text-danger">
            No pudimos cargar el catálogo en vivo ({error}). Verifica que el backend esté corriendo.
          </p>
        )}

        <div className="row g-4">
          {servicios.map((s) => (
            <div className="col-md-6 col-lg-4" key={s.id}>
              <div className="ip-card p-4 d-flex flex-column">
                <span className="badge text-uppercase mb-2" style={{ background: 'var(--ip-azul-100)', color: 'var(--ip-azul-800)', width: 'fit-content' }}>
                  {s.eje_relacionado}
                </span>
                <h5>{s.nombre_servicio}</h5>
                <p className="text-secondary small flex-grow-1">{s.descripcion_corta || s.descripcion}</p>
                <div className="d-flex justify-content-between align-items-center small text-secondary mt-2">
                  <span><i className="bi bi-clock me-1" />{s.duracion_semanas} sem.</span>
                  {s.precio_referencia_cop && <span>{CURRENCY.format(s.precio_referencia_cop)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
