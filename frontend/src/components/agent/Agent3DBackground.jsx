import { useEffect, useRef } from 'react';

/**
 * Fondo decorativo con capas de texto "IDEAPRO" en 3D (CSS transforms puros,
 * sin librerías externas). Sigue sutilmente el movimiento del mouse para dar
 * sensación de profundidad, inspirado en la referencia de "3D component"
 * usada como hero de landing pages.
 */
export default function Agent3DBackground({ word = 'IDEAPRO' }) {
  const tiltRef = useRef(null);

  useEffect(() => {
    const tilt = tiltRef.current;
    if (!tilt) return;

    const handleMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 2; // -1 a 1
      const y = (e.clientY / innerHeight - 0.5) * 2;
      tilt.style.setProperty('--ip-3d-rx', `${(-y * 6).toFixed(2)}deg`);
      tilt.style.setProperty('--ip-3d-ry', `${(x * 8).toFixed(2)}deg`);
    };

    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div className="ip-agent-3d" aria-hidden="true">
      <div className="ip-agent-3d-tilt" ref={tiltRef}>
        <div className="ip-agent-3d-float">
          <span className="ip-agent-3d-word ip-agent-3d-word--back">{word}</span>
          <span className="ip-agent-3d-word ip-agent-3d-word--mid">{word}</span>
          <span className="ip-agent-3d-word ip-agent-3d-word--front">{word}</span>
        </div>
      </div>
    </div>
  );
}
