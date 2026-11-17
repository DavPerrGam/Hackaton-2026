import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAgent } from '../../hooks/useAgent.js';
import MessageBubble from './MessageBubble.jsx';
import StepInput from './StepInput.jsx';
import DiagnosticoResumen from './DiagnosticoResumen.jsx';

export default function ChatAgent() {
  const {
    pregunta, historial, totalPasos, pasoActual, bloque,
    completada, resultado, cargando, error, bloqueada, iniciar, responder,
  } = useAgent();

  if (!localStorage.getItem('ideapro_public_token')) return <Navigate to="/login" replace />;

  const bodyRef = useRef(null);
  const iniciadoRef = useRef(false);

  useEffect(() => {
    if (!iniciadoRef.current) {
      iniciadoRef.current = true;
      iniciar();
    }
  }, [iniciar]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [historial]);

  if (resultado) {
    return <DiagnosticoResumen resultado={resultado} />;
  }

  const progreso = totalPasos ? Math.min(100, Math.round(((pasoActual - 1) / totalPasos) * 100)) : 0;

  return (
    <div className="ip-chat-shell bg-white">
      <div className="ip-chat-header">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center"
          style={{ width: 36, height: 36, background: 'var(--ip-naranja-500)', color: 'var(--ip-azul-950)', fontWeight: 800 }}
        >
          IA
        </div>
        <div className="flex-grow-1">
          <div className="fw-semibold">IDEAPRO Intelligence AI</div>
          <div className="small opacity-75">
            {bloque ? `Etapa: ${bloque}` : 'Consultor estratégico de valor público'}
          </div>
          <div className="ip-progress-track mt-1">
            <div className="ip-progress-fill" style={{ width: `${progreso}%` }} />
          </div>
        </div>
        {totalPasos > 0 && !completada && (
          <span className="small">Paso {pasoActual} de {totalPasos}</span>
        )}
      </div>

      <div className="ip-chat-body" ref={bodyRef}>
        {historial.map((msg, idx) => (
          <MessageBubble key={idx} role={msg.role} content={msg.content} />
        ))}
        {cargando && <MessageBubble role="agent" content="Escribiendo…" />}
        {error && (
          <div className="alert alert-danger py-2 small mt-2 d-flex justify-content-between align-items-center gap-2">
            <span>{error}</span>
            {!bloqueada && (
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={iniciar} disabled={cargando}>
                Reintentar
              </button>
            )}
          </div>
        )}
      </div>

      {pregunta && !completada && !bloqueada && (
        <div className="p-3 border-top">
          <StepInput pregunta={pregunta} onSubmit={responder} disabled={cargando} />
        </div>
      )}
    </div>
  );
}
