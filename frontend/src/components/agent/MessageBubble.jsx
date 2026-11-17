export default function MessageBubble({ role, content }) {
  const texto = typeof content === 'string'
    ? content
    : content?.reply || content?.output || content?.text || content?.message || JSON.stringify(content);

  // El rol "bloque" no es un mensaje: es el separador que anuncia la
  // etapa del protocolo Nexus en la que entra la conversación.
  if (role === 'bloque') {
    return (
      <div className="d-flex align-items-center gap-2 my-3 text-secondary">
        <span className="flex-grow-1 border-top" />
        <span className="small text-uppercase" style={{ letterSpacing: '.06em' }}>{texto}</span>
        <span className="flex-grow-1 border-top" />
      </div>
    );
  }

  return (
    <div className={`ip-bubble ${role === 'user' ? 'ip-bubble-user' : 'ip-bubble-agent'}`}>
      {texto}
    </div>
  );
}
