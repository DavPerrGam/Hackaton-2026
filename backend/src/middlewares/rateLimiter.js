import rateLimit from 'express-rate-limit';

// El endpoint de inicio de sesión del agente es público: lo protegemos
// de scraping/abuso sin exigir login, y el de login admin se protege
// contra fuerza bruta a nivel de red además del bloqueo por cuenta.
//
// El tope se calibra contra la longitud REAL de la conversación: el
// protocolo Nexus recorre unas 40 preguntas y buena parte son de sí/no,
// que se responden de un clic. Un usuario ágil supera con facilidad 30
// peticiones en un minuto, así que ese límite cortaba conversaciones
// legítimas a mitad del diagnóstico. 120/min deja fluir la entrevista
// completa y sigue siendo un techo bajo frente a un scraper.
export const agentPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en un minuto.' },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso, intenta de nuevo en un minuto.' },
});
