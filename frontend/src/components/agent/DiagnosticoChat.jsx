import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient.js';
import MessageBubble from './MessageBubble.jsx';

export default function DiagnosticoChat({ diagnosticoId }) {
  const [mensaje, setMensaje] = useState('');
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);

  const adjuntar = async (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    try {
      const { data } = await axiosClient.post(`/agente/diagnostico/${diagnosticoId}/archivos`, formulario);
      setArchivos((actuales) => [...actuales, data.documento]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  if (!localStorage.getItem('ideapro_public_token')) return <Navigate to="/login" replace />;

  const enviar = async (event) => {
    event.preventDefault();
    const texto = mensaje.trim();
    if (!texto || cargando) return;

    setMensaje('');
    setError(null);
    setHistorial((actual) => [...actual, { role: 'user', content: texto }]);
    setCargando(true);

    try {
      const documentos = archivos.map((archivo) => archivo.nombre_original).join(', ');
      const contexto = documentos ? `\n\nDocumentos adjuntos disponibles: ${documentos}` : '';
      const { data } = await axiosClient.post(`/agente/diagnostico/${diagnosticoId}/chat`, {
        mensaje: `${texto}${contexto}`,
      });
      setHistorial((actual) => [...actual, { role: 'agent', content: data.reply }]);
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem('ideapro_public_token');
        localStorage.removeItem('ideapro_public_user');
        setSesionExpirada(true);
      }
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="mt-5">
      <h5 className="mb-3">¿Tienes preguntas sobre tu diagnóstico?</h5>
      <div className="ip-chat-shell bg-white">
        <div className="ip-chat-header">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 36, height: 36, background: 'var(--ip-naranja-500)', color: 'var(--ip-azul-950)', fontWeight: 800 }}
          >
            IA
          </div>
          <div>
            <div className="fw-semibold">Asistente IDEAPRO</div>
            <div className="small opacity-75">Consulta tu resultado y tu ruta recomendada</div>
          </div>
        </div>
        <div className="ip-chat-body" style={{ minHeight: 180, maxHeight: 360 }}>
          {historial.length === 0 && (
            <MessageBubble role="agent" content="Puedo explicarte tu índice, tus ejes críticos o cualquiera de los servicios recomendados. ¿Qué quieres saber?" />
          )}
          {historial.map((item, index) => (
            <MessageBubble key={`${item.role}-${index}`} role={item.role} content={item.content} />
          ))}
          {cargando && <MessageBubble role="agent" content="Escribiendo…" />}
          {error && (
            <div className="alert alert-danger py-2 small mb-0">
              {error}
              {sesionExpirada && (
                <div className="mt-2">
                  <a href="/login" className="alert-link">Inicia sesión nuevamente para continuar.</a>
                </div>
              )}
            </div>
          )}
          {archivos.length > 0 && (
            <div className="small text-secondary mt-2">
              Documentos: {archivos.map((archivo) => archivo.nombre_original).join(', ')}
            </div>
          )}
        </div>
        <form className="p-3 border-top d-flex gap-2 flex-wrap" onSubmit={enviar}>
          <label className="btn btn-outline-secondary" title="Adjuntar documento">
            <i className="bi bi-paperclip me-1" />
            {subiendo ? 'Subiendo…' : 'Adjuntar'}
            <input
              type="file"
              className="d-none"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              onChange={adjuntar}
              disabled={cargando || subiendo || sesionExpirada}
            />
          </label>
          <input
            className="form-control"
            style={{ flex: '1 1 260px' }}
            value={mensaje}
            onChange={(event) => setMensaje(event.target.value)}
            placeholder="Pregunta sobre tu resultado…"
            disabled={cargando || sesionExpirada}
          />
          <button className="btn ip-btn-primary" type="submit" disabled={cargando || sesionExpirada || !mensaje.trim()}>
            Enviar
          </button>
        </form>
      </div>
    </section>
  );
}
